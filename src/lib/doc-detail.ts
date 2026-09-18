import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { can } from "@/lib/auth";
import { fmtMoney } from "@/lib/money";

export function docDetail(kindScope: "sales" | "purchases", id: number) {
  const user = requireUser();
  const cid = user.companyId;
  const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=? AND kind IN ('invoice','quote','sales_order','credit_note','bill','purchase_order')`, id, cid);
  if (!doc) return null;
  const items = all<any>(`SELECT * FROM trade_doc_items WHERE doc_id=? ORDER BY sort, id`, id);
  const partyTable = ["invoice", "quote", "sales_order", "credit_note"].includes(doc.kind) ? "customers" : "suppliers";
  const party = get<any>(`SELECT * FROM ${partyTable} WHERE id=?`, doc.party_id);
  const isSales = partyTable === "customers";
  const area = isSales ? "sales" : "purchases";
  const payments = all<any>(
    `SELECT p.*, COALESCE(SUM(pa.amount),0) AS applied FROM payments p JOIN payment_allocations pa ON pa.payment_id=p.id
     WHERE p.company_id=? AND pa.doc_id=? GROUP BY p.id ORDER BY p.date`, cid, id);
  const origin = doc.origin_doc_id ? get<any>(`SELECT id, kind, number, status, total, currency FROM trade_docs WHERE id=?`, doc.origin_doc_id) : null;
  const children = all<any>(`SELECT id, kind, number, status, total, currency FROM trade_docs WHERE origin_doc_id=? AND company_id=?`, id, cid);
  const creditNotes = all<any>(`SELECT id, number, total, status FROM trade_docs WHERE company_id=? AND kind='credit_note' AND credit_note_of=?`, cid, id);
  const open = doc.total_base - doc.paid;
  const je = doc.je_id ? get<any>(`SELECT e.*, (SELECT COALESCE(SUM(debit),0) FROM journal_lines WHERE entry_id=e.id) AS debit FROM journal_entries e WHERE e.id=?`, doc.je_id) : null;
  const perms = {
    edit: doc.status === "draft" && can(user.role, "edit", area as any),
    create: can(user.role, "create", area as any),
    post: can(user.role, "post", area as any) || can(user.role, "create", area as any),
    pay: can(user.role, "create", area as any) && isSales,
    payOut: can(user.role, "create", area as any) && !isSales,
    del: doc.status === "draft" && can(user.role, "delete", area as any),
    cn: doc.kind === "invoice" && can(user.role, "create", area as any),
    approve: can(user.role, "approve", area as any),
    export: can(user.role, "export"),
  };
  const company = {
    name: user.company.name, legal_name: user.company.legal_name, tax_id: user.company.tax_id, address: user.company.address,
    phone: user.company.phone, email: user.company.email, bank_name: user.company.bank_name, bank_account_no: user.company.bank_account_no, bank_currency: user.company.bank_currency,
    accent_color: user.company.accent_color, invoice_layout: user.company.invoice_layout, tax_registration: user.company.tax_registration,
    logo_url: user.company.logo_doc_id ? `/api/files/${user.company.logo_doc_id}` : null,
  };
  const files = all<any>(`SELECT * FROM files WHERE company_id=? AND entity_kind=? AND entity_id=?`, cid, doc.kind, id);
  return { user, cid, doc, items, party, isSales, payments, origin, children, creditNotes, open, je, perms, company, files };
}
