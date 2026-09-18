"use client";
/** Receipt → expense extraction. Never auto-posts: everything shown here is a proposal the user confirms. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";
import { Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { AlertTriangle, ScanLine, Upload } from "lucide-react";
import { parseMoney } from "@/lib/money";
import { today } from "@/lib/dates";

export function OcrPanel({ banks, suppliers, categories, onDone }: { banks: any[]; suppliers: any[]; categories: any[]; onDone?: () => void }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [fileId, setFileId] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paste, setPaste] = useState("");
  const [job, setJob] = useState<{ jobId: number; status: string; confidence?: number; note?: string } | null>(null);
  const [ex, setEx] = useState<any>(null);
  const [form, setForm] = useState({ amount: "", tax: "", date: today(), description: "", category_code: "6900", supplier_id: "", account_id: "" as number | string, tax_pct: "" });

  async function upload(f: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("kind", "receipt");
      const r = await fetch("/api/files", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { ui.toast("error", d.error ?? "Upload failed"); return; }
      setFileId(d.id); setFileName(d.name);
    } finally { setUploading(false); }
  }

  async function extract() {
    if (!fileId && !paste.trim()) { ui.toast("error", "Attach a receipt file or paste its text first."); return; }
    const d = await post("/api/ocr", { action: "extract", file_id: fileId, paste_text: paste || undefined });
    if (!d) return;
    setJob({ jobId: d.jobId, status: d.status, confidence: d.confidence, note: d.extraction?.note });
    const e = d.extraction ?? {};
    setEx(e);
    setForm(f => ({
      ...f,
      amount: e.amount ? String(e.amount / 100) : "",
      tax: e.tax ? String(e.tax / 100) : "",
      date: e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : today(),
      description: e.vendor ? `Receipt — ${e.vendor}` : f.description,
      tax_pct: e.tax && e.amount ? String(Math.round((e.tax / e.amount) * 1000) / 10) : f.tax_pct,
    }));
    ui.toast("info", d.message ?? "Extracted — review before posting.");
  }

  async function submit() {
    const amount = parseMoney(form.amount || "0");
    if (amount <= 0) { ui.toast("error", "Enter the total amount (in minor units it must be positive)."); return; }
    let tax = parseMoney(form.tax || "0");
    if (!tax && form.tax_pct) tax = Math.round(amount * (parseFloat(form.tax_pct) / 100));
    const d = await post("/api/ocr", {
      action: "post", job_id: job?.jobId, amount, tax, date: form.date, description: form.description || null,
      category_code: form.category_code, supplier_id: form.supplier_id ? +form.supplier_id : null,
      account_id: form.account_id ? +form.account_id : null,
    });
    if (d?.expense_id) { ui.toast("success", d.message); onDone?.(); router.push("/app/purchases/expenses"); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: "var(--warn-soft, rgba(245,158,11,.12))", color: "var(--warn)" }}>
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>Extraction is a <b>proposal</b>. Nothing posts to the ledger until you confirm every field below.</span>
      </div>
      {!job ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--line)" }}>
              <ScanLine size={22} className="mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
              <div className="text-[13px] font-medium">Attach receipt</div>
              <div className="mb-2 text-[11.5px]" style={{ color: "var(--muted)" }}>PDF or image · text-based PDFs extract best</div>
              <label className="btn-outline btn-sm inline-flex cursor-pointer">
                <Upload size={14} /> {uploading ? "Uploading…" : fileName ?? "Choose file"}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
            </div>
            <div>
              <div className="text-[13px] font-medium">…or paste receipt text</div>
              <textarea className="input mt-1.5 h-[104px] resize-y font-mono text-[12px]" placeholder={"OOO SMART-TECH\nInvoice 4471 · 12.09.2026\nTotal: 2 345 000 so'm\nVAT 12%: 345 000"}
                value={paste} onChange={(e) => setPaste(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Submit busy={busy || uploading} onClick={extract}>Extract fields</Submit>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>{fileName ? `“${fileName}” attached` : "no file attached"}</span>
          </div>
          <FormError />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="chip chip-info">{job.status === "extracted" ? `extracted · ${Math.round((job.confidence ?? 0) * 100)}% confidence` : "needs manual review"}</span>
            {job.note && <span style={{ color: "var(--muted)" }}>{job.note}</span>}
            <button className="btn-ghost btn-sm ml-auto" onClick={() => { setJob(null); setEx(null); }}>↺ Start over</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Total amount *" hint={ex?.amount ? `extracted: ${(ex.amount / 100).toLocaleString("en-US")}` : "not detected — type it"}>
              <TextInput inputMode="decimal" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Tax amount" hint={ex?.tax ? `extracted: ${(ex.tax / 100).toLocaleString("en-US")}` : "leave empty + set % below"}>
              <div className="flex gap-2">
                <TextInput inputMode="decimal" value={form.tax} onChange={(e: any) => setForm({ ...form, tax: e.target.value })} />
                <TextInput className="!w-24" inputMode="decimal" placeholder="% " value={form.tax_pct} onChange={(e: any) => setForm({ ...form, tax_pct: e.target.value })} />
              </div>
            </Field>
            <Field label="Date"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Description"><TextInput value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" /></Field>
            <Field label="Expense category">
              <Select value={form.category_code} onChange={(e: any) => setForm({ ...form, category_code: e.target.value })}
                options={categories.map((a: any) => ({ v: a.code, label: `${a.code} · ${a.name}` }))} />
            </Field>
            <Field label="Supplier (optional)">
              <Select value={form.supplier_id} onChange={(e: any) => setForm({ ...form, supplier_id: e.target.value })}
                options={[{ v: "", label: "— none —" }, ...suppliers.map((s: any) => ({ v: s.id, label: s.name }))]} />
            </Field>
            <Field label="Paid from" hint="Leave as “not paid yet” to keep it on supplier credit (AP)">
              <Select value={form.account_id} onChange={(e: any) => setForm({ ...form, account_id: e.target.value })}
                options={[{ v: "", label: "Not paid yet (on credit)" }, ...banks.map((b: any) => ({ v: b.id, label: b.name }))]} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Submit busy={busy} onClick={submit}>Confirm &amp; post expense</Submit>
            <FormError />
          </div>
        </>
      )}
    </div>
  );
}
