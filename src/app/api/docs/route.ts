import { NextResponse } from "next/server";
import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { computeDocTotals, nextNumber, postInvoiceJE, postBillJE, recalcDocStatus, assertPeriodOpen, postEntry } from "@/lib/postings";
import { notifyUser, today, addDays } from "@/lib/_helpers";

type Item = { id?: number; description: string; qty: number; unit_price: number; discount_pct?: number; tax_pct?: number; tax_rate_id?: number | null; account_id?: number | null };

function resolveTotals(items: Item[], currency: string, fx: number) {
  const tot = computeDocTotals(items.map(i => ({ qty: +i.qty || 0, unit_price: +i.unit_price || 0, discount_pct: +(i.discount_pct ?? 0) || 0, tax_pct: +(i.tax_pct ?? 0) || 0 })));
  return { ...tot, base: { subtotal: Math.round(tot.subtotal * fx), discount: Math.round(tot.discount * fx), tax: Math.round(tot.tax * fx), total: Math.round(tot.total * fx) } };
}

export const POST = handler(async ({ user, body }) => {
  const action = body.action ?? "create";
  const cid = user.companyId;
  const kind = ["quote", "sales_order", "invoice", "bill", "purchase_order", "credit_note"].includes(body.kind) ? body.kind : bad("Unknown document kind.");

  if (action === "create") {
    return runInTransaction(() => {
      assertPeriodOpen(cid, body.date ?? today(), user.role);
      const currency = body.currency || user.company.base_currency || "UZS";
      const fx = currency === user.company.base_currency ? 1 : +body.fx_rate || 1;
      const items: Item[] = (body.items ?? []).filter((i: any) => String(i.description ?? "").trim());
      if (!items.length) bad("Add at least one line item.");
      const partyTable = kind === "invoice" || kind === "quote" || kind === "sales_order" ? "customers" : "suppliers";
      const party = get<any>(`SELECT * FROM ${partyTable} WHERE id=? AND company_id=?`, body.party_id, cid);
      if (!party) bad("Pick a customer/supplier first.");
      const { subtotal, discount, tax, total, base } = resolveTotals(items, currency, fx);
      const number = body.number || nextNumber(cid, kind as any);
      const due = body.due_date || addDays(body.date ?? today(), user.company.payment_terms_days ?? 14);
      const id = insert(
        `INSERT INTO trade_docs (company_id, kind, number, status, party_id, party_type, date, due_date, currency, fx_rate,
          subtotal, discount, tax, total, subtotal_base, discount_base, tax_base, total_base, paid, notes, terms, origin_doc_id, created_by, customer_id, supplier_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`,
        cid, kind, number, "draft", party.id, partyTable === "customers" ? "customer" : "supplier", body.date ?? today(), due,
        currency, fx, subtotal, discount, tax, total, base.subtotal, base.discount, base.tax, base.total,
        body.notes || null, body.terms || `Net ${user.company.payment_terms_days ?? 14}`, body.origin_doc_id || null, user.id,
        partyTable === "customers" ? party.id : null, partyTable === "suppliers" ? party.id : null);
      saveItems(id, items);
      // credit notes post immediately with negative amounts
      if (kind === "credit_note") {
        run(`UPDATE trade_docs SET total=-total, subtotal=-subtotal, tax=-tax, total_base=-total_base, subtotal_base=-subtotal_base, tax_base=-tax_base, status='sent', credit_note_of=? WHERE id=?`, body.origin_doc_id ?? null, id);
        const je = postInvoiceJE(id, user.id, user.role);
        run(`UPDATE trade_docs SET je_id=? WHERE id=?`, je, id);
      }
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: kind, entityId: id, summary: `${kind} ${number} created (draft)`, new: { total } });
      return { id, number, message: `${labelOf(kind)} ${number} created as draft.` };
    });
  }

  if (action === "update") {
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Document not found.");
    if (doc.status !== "draft") bad("Only drafts can be edited. To change a posted document, create a credit note or cancel first.");
    return runInTransaction(() => {
      assertPeriodOpen(cid, body.date ?? doc.date, user.role);
      const currency = body.currency || doc.currency;
      const fx = currency === user.company.base_currency ? 1 : +body.fx_rate || 1;
      const items: Item[] = (body.items ?? []).filter((i: any) => String(i.description ?? "").trim());
      if (!items.length) bad("Add at least one line item.");
      const { subtotal, discount, tax, total, base } = resolveTotals(items, currency, fx);
      run(`UPDATE trade_docs SET party_id=?, party_type=?, date=?, due_date=?, currency=?, fx_rate=?, subtotal=?, discount=?, tax=?, total=?, subtotal_base=?, discount_base=?, tax_base=?, total_base=?, notes=?, terms=?, updated_at=datetime('now') WHERE id=?`,
        +body.party_id || doc.party_id, doc.party_type, body.date ?? doc.date, body.due_date ?? doc.due_date, currency, fx,
        subtotal, discount, tax, total, base.subtotal, base.discount, base.tax, base.total, body.notes ?? doc.notes, body.terms ?? doc.terms, doc.id);
      run(`DELETE FROM trade_doc_items WHERE doc_id=?`, doc.id);
      saveItems(doc.id, items);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: doc.kind, entityId: doc.id, summary: `${doc.number} draft edited`, old: { total: doc.total }, new: { total } });
      return { message: `${doc.number} updated.` };
    });
  }

  if (action === "issue") {
    // send / accept / mark posted — triggers journal projection for invoice & bill
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Document not found.");
    return runInTransaction(() => {
      assertPeriodOpen(cid, doc.date, user.role);
      let je = doc.je_id;
      if (doc.kind === "invoice") je = postInvoiceJE(doc.id, user.id, user.role);
      if (doc.kind === "bill") je = postBillJE(doc.id, user.id, user.role);
      const status = doc.kind === "quote" ? "sent" : doc.kind === "purchase_order" || doc.kind === "sales_order" ? "open" : "sent";
      run(`UPDATE trade_docs SET status=?, je_id=?, updated_at=datetime('now') WHERE id=?`, status, je, doc.id);
      if (["invoice", "bill"].includes(doc.kind)) recalcDocStatus(doc.id);
      const party = get<any>(`SELECT name FROM ${doc.party_type === "customer" ? "customers" : "suppliers"} WHERE id=?`, doc.party_id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: doc.kind === "quote" ? "sent" : "posted", entityKind: doc.kind, entityId: doc.id, summary: `${doc.number} ${status} (${party?.name ?? ""})` });
      if (doc.kind === "invoice" && body.send_email) {
        insert(`INSERT INTO email_log (company_id, doc_id, to_addr, subject, body) VALUES (?,?,?,?,?)`,
          cid, doc.id, get<any>(`SELECT email FROM customers WHERE id=?`, doc.party_id)?.email ?? "—",
          `Invoice ${doc.number} from ${user.company.name}`, `Please find invoice ${doc.number} attached (demo delivery — mail provider not connected).`);
      }
      if (body.send_email && doc.kind === "invoice") notifyUsers(cid, "sent", "success", `${doc.number} sent`, `Invoice emailed to ${party?.name}.`, `/app/sales/invoices/${doc.id}`);
      return { message: `${doc.number} ${status === "sent" ? "issued" : status}. ${["invoice", "bill"].includes(doc.kind) ? "Journal entry posted." : ""}`, status };
    });
  }

  if (action === "convert") {
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Document not found.");
    return runInTransaction(() => {
      const target = doc.kind === "quote" ? (body.to === "invoice" ? "invoice" : "sales_order") : doc.kind === "sales_order" ? "invoice" : doc.kind === "purchase_order" ? "bill" : bad("Cannot convert this document.");
      const number = nextNumber(cid, target as any);
      const id = insert(
        `INSERT INTO trade_docs (company_id, kind, number, status, party_id, party_type, date, due_date, currency, fx_rate, subtotal, discount, tax, total, subtotal_base, discount_base, tax_base, total_base, paid, notes, terms, origin_doc_id, created_by, customer_id, supplier_id)
         SELECT ?,?,?,'draft',party_id,party_type,?,?,currency,fx_rate,subtotal,discount,tax,total,subtotal_base,discount_base,tax_base,total_base,0,notes,terms,?,?,?,customer_id,supplier_id
         FROM trade_docs WHERE id=?`,
        cid, target, number, today(), addDays(today(), user.company.payment_terms_days ?? 14), doc.id, user.id, doc.id);
      run(`INSERT INTO trade_doc_items (doc_id, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort)
           SELECT ?, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort FROM trade_doc_items WHERE doc_id=?`, id, doc.id);
      run(`UPDATE trade_docs SET status='converted', updated_at=datetime('now') WHERE id=?`, doc.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "converted", entityKind: doc.kind, entityId: doc.id, summary: `${doc.number} converted to ${number}` });
      return { id, number, message: `Converted to ${target.replace("_", " ")} ${number} (draft). Review and issue it.`, to: target };
    });
  }

  if (action === "record_status") { // accepted/declined for quotes, open for PO/SO
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    const status = ["accepted", "declined", "open", "sent"].includes(body.status) ? body.status : bad("Invalid status.");
    run(`UPDATE trade_docs SET status=?, updated_at=datetime('now') WHERE id=?`, status, doc.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: doc.kind, entityId: doc.id, summary: `${doc.number} marked ${status}` });
    return { message: `${doc.number} marked ${status}.` };
  }

  if (action === "cancel") {
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    return runInTransaction(() => {
      if (doc.paid > 0) bad("Document has payments registered. Remove or reassign them first, or issue a credit note.");
      assertPeriodOpen(cid, doc.date, user.role);
      if (doc.je_id) {
        const rev = get<any>(`SELECT * FROM journal_lines WHERE entry_id=?`, doc.je_id);
        if (!rev) bad("Journal entry not found for reversal.");
        const lines = all<any>(`SELECT * FROM journal_lines WHERE entry_id=?`, doc.je_id)
          .map(l => ({ accountId: l.account_id, debit: l.credit, credit: l.debit, memo: `Void of ${doc.number}` }));
        const revId = postEntry({ companyId: cid, date: today(), description: `Void ${doc.number}`, ref: doc.number, sourceKind: "manual", sourceId: doc.id, lines, userId: user.id });
        run(`UPDATE journal_entries SET reversed_by=? WHERE id=?`, revId, doc.je_id);
      }
      run(`UPDATE trade_docs SET status='cancelled', void_reason=?, updated_at=datetime('now') WHERE id=?`, body.reason ?? null, doc.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "cancelled", entityKind: doc.kind, entityId: doc.id, summary: `${doc.number} cancelled${body.reason ? ` — ${body.reason}` : ""}` });
      return { message: `${doc.number} cancelled.${doc.je_id ? " Reversing entry posted to keep the audit clean." : ""}` };
    });
  }

  if (action === "duplicate") {
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    return runInTransaction(() => {
      const number = nextNumber(cid, doc.kind as any);
      const id = insert(
        `INSERT INTO trade_docs (company_id, kind, number, status, party_id, party_type, date, due_date, currency, fx_rate, subtotal, discount, tax, total, subtotal_base, discount_base, tax_base, total_base, paid, notes, terms, created_by, customer_id, supplier_id)
         SELECT ?,?,?, 'draft', party_id, party_type, ?, ?, currency, fx_rate, subtotal, discount, tax, total, subtotal_base, discount_base, tax_base, total_base, 0, notes, terms, ?, customer_id, supplier_id FROM trade_docs WHERE id=?`,
        cid, doc.kind, number, today(), addDays(today(), user.company.payment_terms_days ?? 14), user.id, doc.id);
      run(`INSERT INTO trade_doc_items (doc_id, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort)
           SELECT ?, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort FROM trade_doc_items WHERE doc_id=?`, id, doc.id);
      return { id, number, message: `Duplicated as ${number} (draft).` };
    });
  }

  if (action === "delete") {
    const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    if (doc.status !== "draft") bad("Only drafts can be deleted. Posted documents keep their history — cancel them instead.");
    runInTransaction(() => {
      run(`DELETE FROM trade_doc_items WHERE doc_id=?`, doc.id);
      run(`DELETE FROM trade_docs WHERE id=?`, doc.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: doc.kind, entityId: doc.id, summary: `Draft ${doc.number} deleted` });
    });
    return { message: `Draft ${doc.number} deleted.` };
  }

  bad(`Unknown action: ${action}`);
});

function saveItems(docId: number, items: Item[]) {
  items.forEach((it, idx) => {
    const amount = Math.round((+it.qty || 0) * (+it.unit_price || 0));
    const net = Math.round(amount * (1 - (+(it.discount_pct ?? 0) || 0) / 100));
    const tax_amount = Math.round(net * (+(it.tax_pct ?? 0) || 0) / 100);
    insert(`INSERT INTO trade_doc_items (doc_id, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      docId, it.description, +it.qty || 0, +it.unit_price || 0, +(it.discount_pct ?? 0) || 0, it.tax_rate_id ?? null, +(it.tax_pct ?? 0) || 0, net, tax_amount, it.account_id ?? null, idx);
  });
}
function labelOf(kind: string) { return ({ invoice: "Invoice", quote: "Quote", bill: "Bill", sales_order: "Sales order", purchase_order: "PO", credit_note: "Credit note" } as any)[kind] ?? kind; }
export function notifyUsers(cid: number, kind: string, severity: string, title: string, body: string, link: string) {
  for (const m of all<any>(`SELECT user_id FROM memberships WHERE company_id=? AND role IN ('owner','cfo','chief_accountant','accountant','finance_manager')`, cid)) {
    notifyUser(cid, m.user_id, { kind, severity, title, body, link });
  }
}

export const GET = handler(async ({ user, req }) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q");
  if (!q) return { items: [] };
  const like = `%${q}%`;
  const table = sp.get("kind") === "supplier" ? { t: "suppliers", href: "/app/purchases/suppliers/" } : { t: "customers", href: "/app/sales/customers/" };
  return { items: all(`SELECT id, name, phone, email FROM ${table.t} WHERE company_id=? AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY name LIMIT 8`, user.companyId, like, like, like).map((r: any) => ({ ...r, href: table.href + r.id })) };
});
