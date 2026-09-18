/**
 * Chart of accounts + posting engine.
 *
 * Single source of truth: every financial document (invoice, bill, payment,
 * expense, transfer) is projected into balanced journal entries. Reports never
 * recompute money independently — they aggregate journal lines, so the ledger,
 * trial balance, P&L, balance sheet and dashboard always reconcile.
 */
import { all, get, insert, run } from "./db";
import { daysBetween, today } from "./dates";
import { can, type Perm } from "./auth";

export type LineIn = { accountId: number; debit?: number; credit?: number; memo?: string; currency?: string; fxRate?: number; amountForeign?: number };

export const NATURAL_DEBIT: Record<string, boolean> = { asset: true, expense: true, liability: false, equity: false, revenue: false };

export function ensureCoa(companyId: number) {
  const exists = get(`SELECT id FROM accounts WHERE company_id=? LIMIT 1`, companyId);
  if (exists) return;
  for (const a of DEFAULT_COA) {
    insert(`INSERT INTO accounts (company_id, code, name, type, subtype, is_system, description) VALUES (?,?,?,?,?,1,?)`,
      companyId, a.code, a.name, a.type, a.subtype ?? null, a.desc ?? null);
  }
}

export const DEFAULT_COA: { code: string; name: string; type: string; subtype?: string; desc?: string }[] = [
  { code: "1000", name: "Cash on Hand", type: "asset", subtype: "cash" },
  { code: "1010", name: "Bank — Primary (UZS)", type: "asset", subtype: "bank" },
  { code: "1020", name: "Bank — Foreign Currency (USD)", type: "asset", subtype: "bank" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "ar", desc: "Money customers owe you. Driven by invoices and payments." },
  { code: "1200", name: "Prepaid Expenses", type: "asset", subtype: "prepaid" },
  { code: "1290", name: "Uncategorized Suspense", type: "asset", subtype: "suspense", desc: "Temporary bucket for bank lines that still need a category." },
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "ap", desc: "Money you owe suppliers. Driven by bills and supplier payments." },
  { code: "2100", name: "Tax Payable (VAT)", type: "liability", subtype: "tax", desc: "Collected output tax minus recoverable input tax." },
  { code: "2200", name: "Accrued Expenses", type: "liability", subtype: "accrued" },
  { code: "2300", name: "Loans Payable", type: "liability", subtype: "debt" },
  { code: "3000", name: "Owner's Capital", type: "equity", subtype: "capital" },
  { code: "3100", name: "Retained Earnings", type: "equity", subtype: "retained" },
  { code: "4000", name: "Sales Revenue", type: "revenue", subtype: "sales" },
  { code: "4100", name: "Other Income", type: "revenue", subtype: "other_income" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense", subtype: "cogs" },
  { code: "6100", name: "Salaries & Wages", type: "expense", subtype: "category" },
  { code: "6150", name: "Social Contributions", type: "expense", subtype: "category" },
  { code: "6200", name: "Rent", type: "expense", subtype: "category" },
  { code: "6250", name: "Utilities", type: "expense", subtype: "category" },
  { code: "6300", name: "Marketing", type: "expense", subtype: "category" },
  { code: "6400", name: "Transport & Fuel", type: "expense", subtype: "category" },
  { code: "6500", name: "Software & Subscriptions", type: "expense", subtype: "category" },
  { code: "6600", name: "Office Supplies", type: "expense", subtype: "category" },
  { code: "6700", name: "Bank Fees", type: "expense", subtype: "category" },
  { code: "6800", name: "Taxes & Licenses", type: "expense", subtype: "category" },
  { code: "6900", name: "Other Expenses", type: "expense", subtype: "category" },
];

export function accountBySubtype(companyId: number, subtype: string): any {
  const a = get<any>(`SELECT * FROM accounts WHERE company_id=? AND subtype=? AND archived=0 ORDER BY code LIMIT 1`, companyId, subtype);
  if (!a) throw new Error(`Account for subtype "${subtype}" is missing. Open Settings → Chart of Accounts.`);
  return a;
}
export function accountIdByCode(companyId: number, code: string): number | null {
  return get<any>(`SELECT id FROM accounts WHERE company_id=? AND code=?`, companyId, code)?.id ?? null;
}

/* ---------------- period locks ---------------- */
export function lockInfo(companyId: number) {
  const c = get<any>(`SELECT lock_date FROM companies WHERE id=?`, companyId);
  const locks = all<any>(`SELECT * FROM period_locks WHERE company_id=?`, companyId);
  return { lockDate: (c?.lock_date as string | null) ?? null, periods: locks };
}
export function assertPeriodOpen(companyId: number, date: string, role: string | null) {
  if (!role || can(role, "override_lock" as Perm)) return;
  const { lockDate } = lockInfo(companyId);
  if (lockDate && date <= lockDate) {
    throw new LockError(`The books are locked through ${lockDate}. Ask an owner/administrator to unlock the period or choose a later date.`);
  }
  const period = date.slice(0, 7);
  const pl = get<any>(`SELECT * FROM period_locks WHERE company_id=? AND period=? AND status IN ('closed','locked')`, companyId, period);
  if (pl) throw new LockError(`Period ${period} is ${pl.status}. Posted records in a ${pl.status} period cannot be modified without authorization.`);
}
export class LockError extends Error {}

/* ---------------- numbering ---------------- */
const NO_FIELD: Record<string, [string, string]> = {
  invoice: ["next_invoice_no", "invoice_prefix"], quote: ["next_quote_no", "quote_prefix"],
  bill: ["next_bill_no", "bill_prefix"], sales_order: ["next_order_no", "invoice_prefix"],
  purchase_order: ["next_po_no", "bill_prefix"], credit_note: ["next_invoice_no", "invoice_prefix"],
  je: ["next_je_no", "invoice_prefix"], payment: ["next_payment_no", "invoice_prefix"],
};
export function nextNumber(companyId: number, kind: keyof typeof NO_FIELD): string {
  const [seqField, preField] = NO_FIELD[kind as string] ?? NO_FIELD.invoice;
  const c = get<any>(`SELECT ${seqField} AS seq, ${preField} AS pre FROM companies WHERE id=?`, companyId);
  const seq = (c?.seq ?? 1);
  const prefix = String(c?.pre || "DOC").toUpperCase().replace(/\s|_/g, "");
  run(`UPDATE companies SET ${seqField}=? WHERE id=?`, seq + 1, companyId);
  const year = today().slice(0, 4);
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

/* ---------------- journal core ---------------- */
export function postEntry(o: {
  companyId: number; date: string; description: string; ref?: string;
  sourceKind: string; sourceId?: number | null; lines: LineIn[]; userId?: number | null;
}): number {
  const totalDebit = o.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = o.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    const diff = Math.abs(totalDebit - totalCredit);
    throw new Error(`UNBALANCED_ENTRY: debits ${totalDebit} vs credits ${totalCredit} (difference ${(diff / 100).toFixed(2)}). Every entry must balance.`);
  }
  if (totalDebit === 0) throw new Error("EMPTY_ENTRY: journal entry has no amount.");
  const no = nextNumber(o.companyId, "je");
  const id = insert(
    `INSERT INTO journal_entries (company_id, entry_no, date, description, ref, source_kind, source_id, status, period, created_by, posted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    o.companyId, no, o.date, o.description, o.ref ?? null, o.sourceKind, o.sourceId ?? null, "posted", o.date.slice(0, 7), o.userId ?? null
  );
  for (const l of o.lines) {
    insert(`INSERT INTO journal_lines (entry_id, company_id, account_id, debit, credit, memo, currency, fx_rate, amount_foreign)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      id, o.companyId, l.accountId, l.debit ?? 0, l.credit ?? 0, l.memo ?? null,
      l.currency ?? "UZS", l.fxRate ?? 1, l.amountForeign ?? 0);
  }
  return id;
}
export function draftEntry(o: { companyId: number; date: string; description: string; ref?: string; sourceKind: string; sourceId?: number | null; lines: LineIn[]; userId?: number | null }): number {
  const id = insert(
    `INSERT INTO journal_entries (company_id, entry_no, date, description, ref, source_kind, source_id, status, period, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    o.companyId, "DRAFT", o.date, o.description, o.ref ?? null, o.sourceKind, o.sourceId ?? null, "draft", o.date.slice(0, 7), o.userId ?? null);
  for (const l of o.lines) {
    insert(`INSERT INTO journal_lines (entry_id, company_id, account_id, debit, credit, memo, currency, fx_rate, amount_foreign) VALUES (?,?,?,?,?,?,?,?,?)`,
      id, o.companyId, l.accountId, l.debit ?? 0, l.credit ?? 0, l.memo ?? null, l.currency ?? "UZS", l.fxRate ?? 1, l.amountForeign ?? 0);
  }
  return id;
}
export function postDraft(entryId: number, role: string | null) {
  const e = get<any>(`SELECT * FROM journal_entries WHERE id=?`, entryId);
  if (!e) throw new Error("Entry not found");
  assertPeriodOpen(e.company_id, e.date, role);
  const lines = all<any>(`SELECT * FROM journal_lines WHERE entry_id=?`, entryId);
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) throw new Error("UNBALANCED_ENTRY: cannot post — total debit and total credit do not match.");
  if (totalDebit === 0) throw new Error("EMPTY_ENTRY: cannot post an entry without amounts.");
  const no = e.entry_no === "DRAFT" ? nextNumber(e.company_id, "je") : e.entry_no;
  run(`UPDATE journal_entries SET status='posted', posted_at=datetime('now'), entry_no=? WHERE id=?`, no, entryId);
  return no;
}
export function unpostEntry(entryId: number, role: string | null) {
  const e = get<any>(`SELECT * FROM journal_entries WHERE id=?`, entryId);
  if (!e) throw new Error("Entry not found");
  if (e.source_kind !== "manual") throw new Error("Entries generated by documents must be changed on the document (cancel / void), not in the journal.");
  assertPeriodOpen(e.company_id, e.date, role);
  run(`UPDATE journal_entries SET status='draft', posted_at=NULL, entry_no='DRAFT' WHERE id=?`, entryId);
}

/* ---------------- balances ---------------- */
/** Net balance of one account in its natural sign. Base currency minor units. */
export function accountBalance(companyId: number, accountId: number, opts: { from?: string | null; to?: string | null } = {}): number {
  const acc = get<any>(`SELECT type FROM accounts WHERE id=?`, accountId);
  const debitsFirst = acc ? NATURAL_DEBIT[acc.type] : true;
  const expr = debitsFirst ? "(l.debit - l.credit)" : "(l.credit - l.debit)";
  const row = get<any>(
    `SELECT COALESCE(SUM(${expr}),0) AS v FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id
     WHERE l.company_id=? AND l.account_id=? AND e.status='posted'
       AND (? IS NULL OR e.date >= ?) AND (? IS NULL OR e.date <= ?)`,
    companyId, accountId, opts.from ?? null, opts.from ?? null, opts.to ?? null, opts.to ?? null);
  return row?.v ?? 0;
}
export function balancesByType(companyId: number, asOf: string, from?: string | null) {
  return all<any>(
    `SELECT a.id, a.code, a.name, a.type, a.subtype,
       COALESCE(SUM(CASE WHEN e.date >= ? THEN l.debit ELSE 0 END),0) AS debit,
       COALESCE(SUM(CASE WHEN e.date >= ? THEN l.credit ELSE 0 END),0) AS credit,
       COALESCE(SUM(l.debit),0) AS tdebit, COALESCE(SUM(l.credit),0) AS tcredit
     FROM accounts a
     LEFT JOIN journal_lines l ON l.account_id=a.id AND l.company_id=?
     LEFT JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date <= ?
     WHERE a.company_id=? AND a.archived=0
     GROUP BY a.id ORDER BY a.code`,
    from ?? "2000-01-01", from ?? "2000-01-01", companyId, asOf, companyId);
}

/* ---------------- document money (derived from lines) ---------------- */
export function computeDocTotals(items: { qty: number; unit_price: number; discount_pct: number; tax_pct: number }[]) {
  let subtotal = 0, discount = 0, tax = 0;
  for (const it of items) {
    const gross = Math.round((it.qty || 0) * (it.unit_price || 0));
    const disc = Math.round(gross * ((it.discount_pct || 0) / 100));
    const net = gross - disc;
    subtotal += net; discount += disc;
    tax += Math.round(net * ((it.tax_pct || 0) / 100));
  }
  return { subtotal, discount, tax, total: subtotal + tax };
}

/* ---------------- postings for documents ---------------- */
export function postInvoiceJE(docId: number, userId: number | null, role: string | null) {
  const doc = get<any>(`SELECT * FROM trade_docs WHERE id=?`, docId);
  if (!doc || doc.je_id) return doc?.je_id ?? null;
  const cid = doc.company_id;
  assertPeriodOpen(cid, doc.date, role);
  const ar = accountBySubtype(cid, "ar");
  const rev = accountBySubtype(cid, "sales");
  const taxAcc = accountIdByCode(cid, "2100");
  const isCredit = doc.kind === "credit_note";
  const sign = isCredit ? -1 : 1;
  const TB = doc.total_base || doc.total, SB = doc.subtotal_base || doc.subtotal, XB = doc.tax_base ?? doc.tax;
  if (TB <= 0) return null;
  const lines: LineIn[] = [
    { accountId: ar.id, debit: sign * TB, credit: 0, memo: doc.number, currency: doc.currency, fxRate: doc.fx_rate, amountForeign: sign * doc.total },
    { accountId: rev.id, debit: 0, credit: sign * SB, memo: doc.number },
  ];
  if (XB > 0 && taxAcc) lines.push({ accountId: taxAcc, debit: 0, credit: sign * XB, memo: `Tax on ${doc.number}` });
  const je = postEntry({
    companyId: cid, date: doc.date, ref: doc.number, userId,
    description: isCredit ? `Credit note ${doc.number}` : `Invoice ${doc.number}`,
    sourceKind: isCredit ? "credit_note" : "invoice", sourceId: doc.id, lines,
  });
  if (isCredit && doc.credit_note_of) {
    run(`UPDATE trade_docs SET total_base=MAX(0, total_base - ?), total=MAX(0, total - ?), subtotal_base=MAX(0, subtotal_base - ?), subtotal=MAX(0, subtotal - ?), updated_at=datetime('now') WHERE id=?`,
      TB, doc.total, SB, doc.subtotal, doc.credit_note_of);
    recalcDocStatus(doc.credit_note_of);
  }
  return je;
}
export function postBillJE(docId: number, userId: number | null, role: string | null) {
  const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND kind='bill'`, docId);
  if (!doc || doc.je_id) return doc?.je_id ?? null;
  const cid = doc.company_id;
  assertPeriodOpen(cid, doc.date, role);
  const ap = accountBySubtype(cid, "ap");
  const taxAcc = accountIdByCode(cid, "2100");
  const items = all<any>(`SELECT * FROM trade_doc_items WHERE doc_id=?`, docId);
  const lines: LineIn[] = [];
  const fx = doc.fx_rate && doc.fx_rate !== 1 ? doc.fx_rate : 1;
  for (const it of items) {
    const acc = it.account_id || accountIdByCode(cid, "6900")!;
    const amt = Math.round(it.amount * fx), tax = Math.round(it.tax_amount * fx);
    if (amt !== 0) lines.push({ accountId: acc, debit: amt, credit: 0, memo: it.description });
    if (tax > 0 && taxAcc) lines.push({ accountId: taxAcc, debit: tax, credit: 0, memo: `Input tax — ${it.description}` });
  }
  if (!lines.length) return null;
  lines.push({ accountId: ap.id, debit: 0, credit: doc.total_base || doc.total, memo: doc.number });
  return postEntry({ companyId: cid, date: doc.date, ref: doc.number, userId, description: `Bill ${doc.number}`, sourceKind: "bill", sourceId: doc.id, lines });
}
export function postPaymentJE(paymentId: number, userId: number | null, role: string | null) {
  const p = get<any>(`SELECT * FROM payments WHERE id=?`, paymentId);
  if (!p || p.je_id) return p?.je_id ?? null;
  const cid = p.company_id;
  assertPeriodOpen(cid, p.date, role);
  const targetAcc = linkedLedgerAccount(p.account_id) ?? accountBySubtype(cid, "bank").id;
  const ar = accountBySubtype(cid, "ar");
  const ap = accountBySubtype(cid, "ap");
  const lines: LineIn[] = [];
  if (p.direction === "in") {
    lines.push({ accountId: targetAcc, debit: p.amount, credit: 0, memo: `Payment ${p.number ?? ""}`, currency: p.currency, fxRate: p.fx_rate, amountForeign: p.amount_foreign });
    const alloc = get<any>(`SELECT COALESCE(SUM(amount),0) AS v FROM payment_allocations WHERE payment_id=? AND doc_id IS NOT NULL`, paymentId)?.v ?? 0;
    const rest = p.amount - alloc;
    if (alloc > 0) lines.push({ accountId: ar.id, debit: 0, credit: alloc, memo: "Applied to invoices" });
    if (rest > 0) lines.push({ accountId: ar.id, debit: 0, credit: rest, memo: "On account (prepayment)" });
    else if (rest < 0) lines.push({ accountId: ar.id, debit: -rest, credit: 0, memo: "Over-application" });
  } else {
    const allocDocs = get<any>(`SELECT COALESCE(SUM(amount),0) AS v FROM payment_allocations WHERE payment_id=? AND doc_id IS NOT NULL`, paymentId)?.v ?? 0;
    const allocExp = get<any>(`SELECT COALESCE(SUM(pa.amount),0) AS v FROM payment_allocations pa JOIN expenses ex ON ex.id=pa.expense_id WHERE pa.payment_id=?`, paymentId)?.v ?? 0;
    const apTotal = allocDocs + allocExp;
    const rest = p.amount - apTotal;
    if (apTotal > 0) lines.push({ accountId: ap.id, debit: apTotal, credit: 0, memo: "Applied to bills & expenses" });
    if (rest > 0) lines.push({ accountId: ap.id, debit: rest, credit: 0, memo: "Advance to supplier" });
    else if (rest < 0) lines.push({ accountId: ap.id, debit: 0, credit: -rest, memo: "Advance applied" });
    lines.push({ accountId: targetAcc, debit: 0, credit: p.amount, memo: `Payment ${p.number ?? ""}` });
  }
  return postEntry({
    companyId: cid, date: p.date, ref: p.reference ?? p.number ?? undefined, userId,
    description: p.direction === "in" ? `Customer payment ${p.number ?? ""}` : `Supplier payment ${p.number ?? ""}`,
    sourceKind: "payment", sourceId: p.id, lines,
  });
}
export function linkedLedgerAccount(bankAccountId: number): number | null {
  const row = get<any>(`SELECT a.id FROM bank_accounts ba JOIN accounts a ON a.id=ba.account_id AND a.company_id=ba.company_id WHERE ba.id=?`, bankAccountId);
  return row?.id ?? null;
}

/* expense posting */
export function postExpenseJE(expenseId: number, userId: number | null, role: string | null) {
  const ex = get<any>(`SELECT * FROM expenses WHERE id=?`, expenseId);
  if (!ex || ex.je_id) return ex?.je_id ?? null;
  const cid = ex.company_id;
  assertPeriodOpen(cid, ex.date, role);
  const catAcc = ex.category_account_id || accountIdByCode(cid, "6900")!;
  const taxAcc = accountIdByCode(cid, "2100");
  const lines: LineIn[] = [
    { accountId: catAcc, debit: ex.amount, credit: 0, memo: ex.description || "Expense" },
  ];
  if (ex.tax > 0 && taxAcc) lines.push({ accountId: taxAcc, debit: ex.tax, credit: 0, memo: "Input tax" });
  const pay = ex.account_id ? linkedLedgerAccount(ex.account_id) : null;
  if (ex.account_id && pay) lines.push({ accountId: pay, debit: 0, credit: ex.amount + ex.tax, memo: ex.description || "Expense" });
  else lines.push({ accountId: accountBySubtype(cid, "ap").id, debit: 0, credit: ex.amount + ex.tax, memo: ex.description || "Expense (unpaid)" });
  return postEntry({ companyId: cid, date: ex.date, userId, description: `Expense — ${ex.description || "Uncategorized"}`, sourceKind: "expense", sourceId: ex.id, lines });
}

export function postTransferJE(o: { companyId: number; date: string; fromBankId: number; toBankId: number; amount: number; memo?: string; userId?: number | null; role: string | null }) {
  assertPeriodOpen(o.companyId, o.date, o.role);
  const fromAcc = linkedLedgerAccount(o.fromBankId);
  const toAcc = linkedLedgerAccount(o.toBankId);
  if (!fromAcc || !toAcc) throw new Error("Bank accounts must be linked to ledger accounts. Check Settings → Bank accounts.");
  const lines: LineIn[] = [
    { accountId: toAcc, debit: o.amount, credit: 0, memo: o.memo || "Transfer in" },
    { accountId: fromAcc, debit: 0, credit: o.amount, memo: o.memo || "Transfer out" },
  ];
  return postEntry({ companyId: o.companyId, date: o.date, userId: o.userId ?? null, description: o.memo || "Transfer between accounts", sourceKind: "transfer", sourceId: null, lines });
}

export function postOpeningBalance(companyId: number, accountId: number, amountMinor: number, date: string, userId: number | null) {
  const eq = accountBySubtype(companyId, "capital");
  if (amountMinor === 0) return null;
  return postEntry({
    companyId, date, userId, description: "Opening balance", sourceKind: "opening", sourceId: accountId,
    lines: amountMinor > 0
      ? [{ accountId, debit: amountMinor, credit: 0 }, { accountId: eq.id, debit: 0, credit: amountMinor }]
      : [{ accountId, debit: 0, credit: -amountMinor }, { accountId: eq.id, debit: -amountMinor, credit: 0 }],
  });
}

/* invoice status sync — status is derived from payment coverage + due date */
export function recalcDocStatus(docId: number) {
  const d = get<any>(`SELECT * FROM trade_docs WHERE id=?`, docId);
  if (!d) return;
  if (d.status === "cancelled" || !["invoice", "bill", "credit_note"].includes(d.kind)) return;
  const out = (d.total_base || d.total) - d.paid;
  let status = d.status;
  if (d.status !== "draft") {
    if (out <= 0) status = "paid";
    else if (d.due_date && today() > d.due_date && out > 0) status = "overdue";
    else if (d.paid > 0) status = "partial";
    else status = "sent";
  }
  run(`UPDATE trade_docs SET status=?, updated_at=datetime('now') WHERE id=?`, status, docId);
}

export function agingFor(companyId: number, kind: "invoice" | "bill", partyId?: number | null) {
  const t = today();
  const docs = all<any>(
    `SELECT id, number, date, due_date, total, total_base, paid, party_id FROM trade_docs
     WHERE company_id=? AND kind=? AND status IN ('sent','partial','overdue') AND ((total_base) - paid) > 0 ${partyId ? "AND party_id=?" : ""}`,
    ...(partyId ? [companyId, kind, partyId] : [companyId, kind]));
  const buckets = [{ label: "Current", lo: -1e9, hi: 0 }, { label: "1–30 days", lo: 1, hi: 30 }, { label: "31–60 days", lo: 31, hi: 60 }, { label: "61–90 days", lo: 61, hi: 90 }, { label: "90+ days", lo: 91, hi: 1e9 }];
  const out = buckets.map(b => ({ ...b, total: 0, count: 0, docs: [] as any[] }));
  for (const doc of docs) {
    const age = daysBetween(doc.due_date || doc.date, t);
    const bi = Math.max(0, buckets.findIndex(b => age >= b.lo && age <= b.hi));
    out[bi].total += (doc.total_base || doc.total) - doc.paid;
    out[bi].count++;
    out[bi].docs.push({ ...doc, outstanding: (doc.total_base || doc.total) - doc.paid, age });
  }
  return out;
}
