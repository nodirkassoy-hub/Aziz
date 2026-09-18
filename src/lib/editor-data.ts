import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { can } from "@/lib/auth";
import { makeNewState, type EditorState } from "@/lib/doc-state";
import { today, addDays } from "@/lib/dates";
import { minorToInput } from "@/lib/money";

export function editorData(kind: string, docId?: number, preset?: { party_id?: number }) {
  const user = requireUser();
  const cid = user.companyId;
  const isSales = kind === "invoice" || kind === "quote" || kind === "sales_order";
  const parties = isSales
    ? all<any>(`SELECT id, name, currency FROM customers WHERE company_id=? AND archived=0 ORDER BY name`, cid)
    : all<any>(`SELECT id, name, currency FROM suppliers WHERE company_id=? AND archived=0 ORDER BY name`, cid);
  const taxRates = all<any>(`SELECT id, name, rate_pct, applies FROM tax_rates WHERE company_id=? AND archived=0 ORDER BY is_default DESC, rate_pct`, cid);
  const accounts = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND type='expense' AND archived=0 ORDER BY code`, cid);
  const company = {
    name: user.company.name, legal_name: user.company.legal_name, tax_id: user.company.tax_id, address: user.company.address,
    phone: user.company.phone, email: user.company.email, bank_name: user.company.bank_name, bank_account_no: user.company.bank_account_no,
    bank_currency: user.company.bank_currency, accent_color: user.company.accent_color, invoice_layout: user.company.invoice_layout,
    tax_authority: user.company.tax_authority, tax_registration: user.company.tax_registration,
    logo_url: user.company.logo_doc_id ? `/api/files/${user.company.logo_doc_id}` : null,
    base_currency: user.company.base_currency, payment_terms_days: user.company.payment_terms_days ?? 14,
  };
  const permArea = isSales ? "sales" : "purchases";
  const canPost = can(user.role, "post", permArea as any) || can(user.role, "create", permArea as any);
  let state: EditorState;
  let existing: any = null;
  if (docId) {
    existing = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, docId, cid);
    if (!existing) return null;
    const items = all<any>(`SELECT * FROM trade_doc_items WHERE doc_id=? ORDER BY sort, id`, docId);
    state = {
      kind, docId, status: existing.status, number: existing.number,
      party_id: existing.party_id, currency: existing.currency, fx_rate: existing.fx_rate,
      date: existing.date, due_date: existing.due_date ?? "", notes: existing.notes ?? "", terms: existing.terms ?? "",
      items: items.map((i: any) => ({ id: i.id, description: i.description, qty: i.qty, unit_price: i.unit_price, discount_pct: i.discount_pct, tax_pct: i.tax_pct, tax_rate_id: i.tax_rate_id, account_id: i.account_id })),
    };
  } else {
    const defaultTax = taxRates.find((t: any) => t.is_default)?.rate_pct ?? 0;
    state = makeNewState(kind, company.base_currency, company.payment_terms_days, {
      party_id: preset?.party_id,
      items: [{ description: "", qty: 1, unit_price: 0, discount_pct: 0, tax_pct: defaultTax, tax_rate_id: taxRates.find((t: any) => t.is_default)?.id ?? null }],
    });
  }
  return { user, state, parties, taxRates, accounts, company, canPost, kind, title: titleOf(kind, !!docId), existing, isSales };
}
function titleOf(kind: string, edit: boolean) {
  const names: Record<string, string> = { invoice: "Invoice", quote: "Quote", sales_order: "Sales order", bill: "Bill", purchase_order: "Purchase order", credit_note: "Credit note" };
  return `${edit ? "Edit draft " : "New "}${names[kind] ?? kind}`;
}
