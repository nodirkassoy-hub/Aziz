/**
 * Receipt extraction. This runs a REAL, deterministic extractor over receipt text
 * (pasted content or PDF text layers when readable); when a binary OCR provider is
 * not connected (images/photos), the pipeline returns needs_review with guided
 * fields instead of pretending. Nothing is ever posted without confirmation
 * unless the company explicitly enables auto-post.
 */
import { handler, bad } from "@/lib/api";
import { all, get, insert, run } from "@/lib/db";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { today } from "@/lib/dates";
import { audit } from "@/lib/auth";
import { postExpenseJE, accountIdByCode } from "@/lib/postings";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  if (body.action === "extract") {
    const f = get<any>(`SELECT * FROM files WHERE id=? AND company_id=?`, body.file_id, cid);
    let text = "";
    let source = "";
    if (body.paste_text) { text = String(body.paste_text).slice(0, 20000); source = "pasted text"; }
    else if (f && f.mime === "application/pdf") {
      const buf = fs.readFileSync(path.join(UPLOADS_DIR, f.storage_name));
      text = extractPdfText(buf); source = "PDF text layer";
    } else if (f) { source = "image"; }
    if (!text.trim()) {
      const jobId = insert(`INSERT INTO ocr_jobs (company_id, file_id, status, extracted_json, confidence, created_by) VALUES (?,?,?,?,?,?)`,
        cid, f?.id ?? null, "needs_review", JSON.stringify({ note: source === "image" ? "No OCR engine connected for images — fill the fields below; they're pre-seeded from the file name where possible." : "No readable text layer — enter amounts manually.", vendor: f ? vendorFromName(f.name) : null, date: today() }), 0, user.id);
      return {
        jobId, status: "needs_review" as const, source,
        extraction: { vendor: f ? vendorFromName(f.name) : null, date: today(), amount: null, tax: null, category: null, reference: null },
        message: source === "image"
          ? "Photo received. A binary OCR provider isn't connected in this deployment, so review & confirm the details — they'll be extracted automatically once a provider is configured."
          : "Could not read a text layer — fill in the values manually.",
      };
    }
    const ex = extractFields(text);
    const conf = ["vendor", "date", "amount"].reduce((s, k) => s + (ex as any)[k] ? 0.33 : 0, 0);
    const jobId = insert(`INSERT INTO ocr_jobs (company_id, file_id, status, extracted_json, confidence, created_by) VALUES (?,?, 'extracted', ?, ?, ?)`,
      cid, f?.id ?? null, JSON.stringify(ex), conf, user.id);
    return { jobId, status: "extracted" as const, source, extraction: ex, message: "Values extracted — review before posting." };
  }

  if (body.action === "post") {
    const job = get<any>(`SELECT * FROM ocr_jobs WHERE id=? AND company_id=?`, body.job_id, cid) ?? bad("Job not found.");
    if (job.status === "posted") bad("This receipt was already posted.");
    const amount = Math.round(+body.amount || 0);
    if (amount <= 0) bad("Enter the amount before posting.");
    const tax = Math.round(+body.tax || 0);
    const catCode = body.category_code || "6900";
    const catAcc = accountIdByCode2(cid, catCode) ?? accountIdByCode(cid, "6900")!;
    const exId = insert(`INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, account_id, receipt_doc_id, status, created_by)
      VALUES (?,?,?,?,?,?,?,?,?, 'posted', ?)`,
      cid, body.date || today(), body.supplier_id || null, catAcc, body.description || `Receipt: ${job.file_id ? get<any>(`SELECT name FROM files WHERE id=?`, job.file_id)?.name ?? "scanned" : "scanned"}`,
      amount, tax, body.account_id ? +body.account_id : null, job.file_id, user.id);
    const je = postExpenseJE(exId, user.id, user.role);
    run(`UPDATE expenses SET je_id=? WHERE id=?`, je, exId);
    run(`UPDATE ocr_jobs SET status='posted', created_expense_id=?, extracted_json=json_set(extracted_json,'$.posted',1) WHERE id=?`, exId, job.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "expense", entityId: exId, summary: `Expense posted from receipt scan (confirmed by user) — ${(amount / 100).toLocaleString("en-US")}` });
    if (job.file_id) run(`UPDATE files SET entity_kind='expense', entity_id=? WHERE id=?`, exId, job.file_id);
    return { expense_id: exId, message: "Receipt posted to the ledger." };
  }
  bad("Unknown action.");
}, { perm: "create", area: "purchases" });

function accountIdByCode2(cid: number, code: string) { return all<any>(`SELECT id, code FROM accounts WHERE company_id=? AND type='expense'`, cid).find(a => a.code === code)?.id ?? null; }

/* deterministic extractor */
export function extractFields(text: string) {
  const t = text.replace(/\r/g, "");
  const dateM = t.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
  let date = today();
  if (dateM) {
    const raw = dateM[0];
    if (raw.includes("-") && raw.length === 10) date = raw;
    else {
      const parts = raw.split(/[./-]/).map((x: string) => parseInt(x, 10));
      if (parts[2] > 31) date = `${String(parts[2]).length === 2 ? "20" + parts[2] : parts[2]}-${String(parts[1]).padStart(2, "0")}-${String(parts[0]).padStart(2, "0")}`;
      else date = `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
    }
  }
  // total/amount: prefer explicit TOTAL line, else largest currency amount
  let amount = 0, tax = 0;
  const lines = t.split("\n").map(l => l.trim()).filter(Boolean);
  const totalLine = lines.find(l => /^(total|grand total|amount due|итого|jami|to'lov|jemi)/i.test(l));
  const moneyRe = /([0-9][0-9\s.,]*)\s*(UZS|so'm|сум|USD|\$|EUR|€)?/gi;
  const grabFrom = (s: string) => { const m = s.match(moneyRe); if (!m) return 0; let best = 0; for (const x of m) { const v = parseMoney(x); if (v > best) best = v; } return best; };
  if (totalLine) amount = grabFrom(totalLine);
  if (!amount) {
    let best = 0;
    for (const l of lines) { const v = grabFrom(l); if (v > best) best = v; }
    amount = best;
  }
  const vatLine = lines.find(l => /(VAT|QQS|qqs|НДС|tax|soliq)/i.test(l) && /[0-9]/.test(l));
  if (vatLine) tax = grabFrom(vatLine);
  const vendor = (lines.find(l => l.length > 2 && l.length < 60 && !/[0-9]{4}/.test(l) && /(ООО|LLC|MCHJ|JSC|ЧП|xk|company|llc|jsc)/i.test(l)) ?? lines[0] ?? "")?.slice(0, 60).replace(/[|:_]+$/, "").trim() || null;
  const ref = (t.match(/(?:invoice|счёт|number|№|#|dok)[ :#]*([A-Za-z0-9-]{3,20})/i) ?? [])[1] ?? null;
  const categoryGuess = /fuel|benzin|yoqilg'i|transport|taksi/i.test(t) ? "6400" : /software|subscription|internet|hosting/i.test(t) ? "6500" : /market|reklam|ads|ad /i.test(t) ? "6300" : /rent|ijarar|ijara|office/i.test(t) ? "6200" : /elektr|gaz|utilit|suv|light/i.test(t) ? "6250" : /bank|komiss|fee/i.test(t) ? "6700" : null;
  return { vendor, date, amount: amount || null, tax: tax || null, reference: ref, category: categoryGuess, description: vendor ? `Receipt — ${vendor}` : "Receipt" };
}
function vendorFromName(name: string) {
  const clean = name.replace(/\.[a-z]+$/i, "").replace(/[_\-.]+/g, " ").replace(/\d{6,}/g, "").trim();
  return clean ? clean.slice(0, 50) : null;
}
/** Best-effort PDF text layer extractor (works for uncompressed/ToUnicode-free streams of simple PDFs). */
function extractPdfText(buf: Buffer): string {
  const s = buf.toString("latin1");
  const parts: string[] = [];
  const re = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let m;
  while ((m = re.exec(s)) && parts.length < 400) parts.push(m[1].replace(/\\([()\\])/g, "$1"));
  return parts.join("\n");
}
