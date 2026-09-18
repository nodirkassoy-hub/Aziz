/**
 * Reporting layer. Everything aggregates posted journal lines for the current
 * company. No invented values: if there is no data, reports show zero.
 */
import { all, get, run, insert } from "./db";
import { today } from "./dates";

/* ---------------- Trial Balance ---------------- */
export function trialBalance(companyId: number, opts: { from?: string | null; to?: string } = {}) {
  const to = opts.to ?? today();
  const from = opts.from ?? null;
  const rows = all<any>(
    `SELECT a.id AS account_id, a.code, a.name, a.type, a.subtype,
       COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END),0)  AS debit,
       COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END),0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines l ON l.account_id = a.id AND l.company_id = ?
     LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.status='posted' AND e.date <= ? AND (? IS NULL OR e.date >= ?)
     WHERE a.company_id = ? AND a.archived = 0
     GROUP BY a.id HAVING debit != 0 OR credit != 0
     ORDER BY a.code`,
    companyId, to, from, from, companyId);
  const rowsOut = rows.map(r => {
    const debitFirst = r.type === "asset" || r.type === "expense";
    const net = r.debit - r.credit;
    return {
      ...r,
      balance: debitFirst ? net : -net,
      display_debit: debitFirst ? Math.max(net, 0) : Math.max(-net, 0),
      display_credit: debitFirst ? Math.max(-net, 0) : Math.max(net, 0),
    };
  });
  const totalDebit = rowsOut.reduce((s, r) => s + r.display_debit, 0);
  const totalCredit = rowsOut.reduce((s, r) => s + r.display_credit, 0);
  return { rows: rowsOut, totalDebit, totalCredit, balanced: totalDebit === totalCredit, to, from };
}

/* ---------------- P&L ---------------- */
export function profitAndLoss(companyId: number, from: string, to: string, compare?: { from: string; to: string } | null) {
  const cur = plSection(companyId, from, to);
  const prev = compare ? plSection(companyId, compare.from, compare.to) : null;
  const mk = (accs: any[]) => accs.map(a => ({
    ...a, pct: cur.revenue ? (a.net / cur.revenue) * 100 : null,
    prev: prev ? (prev.byAcc[a.account_id]?.net ?? 0) : null,
  }));
  return {
    from, to,
    revenue: mk(cur.revenueAccs), cogs: mk(cur.cogsAccs), opex: mk(cur.opexAccs), other: mk(cur.otherAccs),
    revenueTotal: cur.revenue, cogsTotal: cur.cogs, grossProfit: cur.gross, opexTotal: cur.opex,
    operatingProfit: cur.operating, otherTotal: cur.otherIncome - cur.otherExpense,
    netProfit: cur.net, prevNet: prev?.net ?? null,
    prevRevenue: prev?.revenue ?? null,
    totalsBy: cur, prevTotalsBy: prev,
  };
}
function plSection(companyId: number, from: string, to: string) {
  const rows = all<any>(
    `SELECT a.id AS account_id, a.code, a.name, a.type, a.subtype, COALESCE(SUM(l.credit - l.debit),0) AS net
     FROM accounts a JOIN journal_lines l ON l.account_id=a.id JOIN journal_entries e ON e.id=l.entry_id
     WHERE a.company_id=? AND e.status='posted' AND e.date>=? AND e.date<=?
     GROUP BY a.id ORDER BY a.code`, companyId, from, to);
  const revenueAccs = rows.filter(r => r.type === "revenue" && r.subtype !== "other_income");
  const otherAccs = rows.filter(r => r.type === "revenue" && r.subtype === "other_income");
  const cogsAccs = rows.filter(r => r.type === "expense" && r.subtype === "cogs");
  const opexAccs = rows.filter(r => r.type === "expense" && r.subtype !== "cogs")
    .map(r => ({ ...r, net: -r.net })).sort((a, b) => b.net - a.net);
  const byAcc: any = {}; for (const r of rows) byAcc[r.account_id] = { net: r.net };
  for (const r of opexAccs) byAcc[r.account_id] = { net: r.net };
  const revenue = revenueAccs.reduce((s, r) => s + r.net, 0);
  const cogs = cogsAccs.reduce((s, r) => s + -r.net, 0);
  const otherIncome = otherAccs.reduce((s, r) => s + r.net, 0);
  const opex = opexAccs.reduce((s, r) => s + r.net, 0);
  const gross = revenue - cogs;
  const operating = gross - opex;
  return { revenue, cogs, gross, opex, operating, otherIncome, otherExpense: 0, net: operating + otherIncome,
    revenueAccs, cogsAccs, opexAccs, otherAccs, byAcc };
}

/* ---------------- Balance Sheet ---------------- */
export function balanceSheet(companyId: number, asOf: string) {
  const rows = all<any>(
    `SELECT a.id AS account_id, a.code, a.name, a.type, a.subtype,
       COALESCE(SUM(l.debit - l.credit),0) AS net
     FROM accounts a JOIN journal_lines l ON l.account_id=a.id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date <= ?
     WHERE a.company_id=? GROUP BY a.id ORDER BY a.code`, asOf, companyId);
  const pl = plSection(companyId, fiscalYearStart(companyId, asOf), asOf);
  const assets = rows.filter(r => r.type === "asset" && r.net !== 0).map(r => ({ ...r, value: r.net }));
  const liab = rows.filter(r => r.type === "liability" && r.net !== 0).map(r => ({ ...r, value: -r.net }));
  const eq = rows.filter(r => r.type === "equity" && r.net !== 0).map(r => ({ ...r, value: -r.net }));
  const totalAssets = assets.reduce((s, r) => s + r.value, 0);
  const totalLiab = liab.reduce((s, r) => s + r.value, 0);
  const equityBooks = eq.reduce((s, r) => s + r.value, 0);
  const currentEarnings = pl.net; // revenue - expenses, computed from the same ledger
  const totalEquity = equityBooks + currentEarnings;
  return { assets, liabilities: liab, equity: eq, totalAssets, totalLiabilities: totalLiab,
    currentEarnings, totalEquity, balanced: totalAssets === totalLiab + totalEquity, asOf };
}
export function fiscalYearStart(companyId: number, date: string) {
  const m = get<any>(`SELECT fiscal_year_start_month AS m FROM companies WHERE id=?`)?.m ?? 1;
  const y = Number(date.slice(0, 4));
  const mm = Number(date.slice(5, 7));
  const year = mm >= m ? y : y - 1;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

/* ---------------- Cash Flow Statement (indirect method) ---------------- */
export function cashFlowStatement(companyId: number, from: string, to: string) {
  // operating = net profit adjusted; but simpler & exact: movements in cash accounts come from non-cash lines.
  // We derive directly from journal lines touching cash/bank accounts — classification by counterparty account type.
  const movements = all<any>(
    `SELECT e.date, e.id AS entry_id, e.description, e.source_kind, e.ref,
       a.code AS cash_code, a.name AS cash_name, l.debit - l.credit AS delta,
       cl.account_id AS other_acc, cl.debit - cl.credit AS other_delta,
       a2.code AS other_code, a2.name AS other_name, a2.type AS other_type, a2.subtype AS other_subtype
     FROM journal_lines l
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     JOIN accounts a ON a.id=l.account_id
     JOIN journal_lines cl ON cl.entry_id=e.id AND cl.id != l.id
     JOIN accounts a2 ON a2.id=cl.account_id
     WHERE l.company_id=? AND a.type='asset' AND a.subtype IN ('cash','bank')
       AND a2.subtype NOT IN ('cash','bank')
       AND e.date>=? AND e.date<=?
     ORDER BY e.date, e.id, cl.id`, companyId, from, to);
  const buckets = { operating: 0, investing: 0, financing: 0 } as any;
  for (const mv of movements) {
    // entry balances => cash change attributed to this counterparty line = -(other line change)
    const cls = classifyCounter(mv.other_type, mv.other_subtype, mv.other_code);
    buckets[cls] += -mv.other_delta;
  }
  const closing = cashBalanceAt(companyId, to);
  const netChange = buckets.operating + buckets.investing + buckets.financing;
  return {
    operating: buckets.operating, investing: buckets.investing, financing: buckets.financing,
    netChange, opening: closing - netChange, closing, movements, from, to,
  };
}
function classifyCounter(type: string, subtype: string, code: string): "operating" | "investing" | "financing" {
  if (type === "revenue" || type === "expense") return "operating";
  if (subtype === "ar" || subtype === "ap" || subtype === "tax" || subtype === "accrued" || subtype === "prepaid" || code === "1290") return "operating";
  if (type === "liability" && subtype === "debt") return "financing";
  if (type === "equity") return "financing";
  return "investing";
}
export function cashBalanceAt(companyId: number, asOf: string) {
  const r = get<any>(
    `SELECT COALESCE(SUM(l.debit - l.credit),0) AS v
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date <= ?
     WHERE l.company_id=? AND a.subtype IN ('cash','bank')`, asOf, companyId);
  return r?.v ?? 0;
}

/* ---------------- GL ---------------- */
export function generalLedger(companyId: number, opts: { accountId?: number | null; from?: string | null; to?: string | null; limit?: number; offset?: number; search?: string | null }) {
  const params: any[] = [companyId];
  let where = `WHERE l.company_id=?`;
  if (opts.accountId) { where += ` AND l.account_id=?`; params.push(opts.accountId); }
  if (opts.from) { where += ` AND e.date>=?`; params.push(opts.from); }
  if (opts.to) { where += ` AND e.date<=?`; params.push(opts.to); }
  if (opts.search) { where += ` AND (e.description LIKE ? OR e.ref LIKE ? OR l.memo LIKE ?)`; const s = `%${opts.search}%`; params.push(s, s, s); }
  const limit = opts.limit ?? 500;
  const rows = all<any>(
    `SELECT e.id AS entry_id, e.entry_no, e.date, e.description, e.ref, e.status AS entry_status, e.source_kind, e.source_id,
       l.id AS line_id, a.code, a.name AS account, l.debit, l.credit, l.memo, l.currency, l.fx_rate, l.amount_foreign
     FROM journal_lines l
     JOIN journal_entries e ON e.id=l.entry_id
     JOIN accounts a ON a.id=l.account_id
     ${where}
     ORDER BY e.date, e.id, l.id
     LIMIT ? OFFSET ?`, ...params, limit, opts.offset ?? 0);
  return rows;
}
export function glCount(companyId: number, opts: { from?: string | null; to?: string | null }) {
  const r = get<any>(
    `SELECT COUNT(*) AS n FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id
     WHERE l.company_id=? ${opts.from ? "AND e.date>=?" : ""} ${opts.to ? "AND e.date<=?" : ""}`,
    companyId, ...(opts.from ? [opts.from] : []), ...(opts.to ? [opts.to] : []));
  return r?.n ?? 0;
}

/* ---------------- KPIs for dashboard ---------------- */
export function periodKpis(companyId: number, from: string, to: string) {
  const rows = all<any>(
    `SELECT a.type, a.subtype, COALESCE(SUM(l.credit - l.debit),0) AS net
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND e.date>=? AND e.date<=?
     GROUP BY a.type, a.subtype`, companyId, from, to);
  const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + r.net, 0);
  const revenue = sum(r => r.type === "revenue" && r.subtype !== "other_income");
  const cogs = -sum(r => r.type === "expense" && r.subtype === "cogs");
  const opex = -sum(r => r.type === "expense" && r.subtype !== "cogs");
  const expenses = cogs + opex;
  const gross = revenue - cogs;
  const net = revenue - expenses;
  const cash = cashBalanceAt(companyId, to);
  const ar = -sum(r => r.subtype === "ar");
  const ap = -sum(r => r.subtype === "ap");
  const taxLiab = -sum(r => r.subtype === "tax");
  const debt = -sum(r => r.subtype === "debt");
  return { revenue, expenses, gross, net, cash, ar, ap, taxLiab, debt,
    otherIncome: sum(r => r.type === "revenue" && r.subtype === "other_income") };
}

/** monthly aggregates for sparklines & trends (last N months) */
export function monthlySeries(companyId: number, months: number, end?: string) {
  const to = end ?? today();
  const from = (() => { const d = new Date(to + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - (months - 1)); d.setUTCDate(1); return d.toISOString().slice(0, 10); })();
  const rows = all<any>(
    `SELECT substr(e.date,1,7) AS m, a.type, a.subtype, COALESCE(SUM(l.credit - l.debit),0) AS net
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND e.date>=? AND e.date<=?
     GROUP BY m, a.type, a.subtype ORDER BY m`, companyId, from, to);
  const out: { m: string; revenue: number; expenses: number; gross: number; net: number; inflow: number; outflow: number }[] = [];
  const monthMap = new Map<string, any>();
  for (const r of rows) {
    if (!monthMap.has(r.m)) monthMap.set(r.m, { m: r.m, revenue: 0, cogs: 0, expense: 0, inflow: 0, outflow: 0 });
    const o = monthMap.get(r.m);
    if (r.type === "revenue" && r.subtype !== "other_income") o.revenue += r.net;
    else if (r.type === "revenue") o.revenue += r.net;
    else if (r.type === "expense" && r.subtype === "cogs") o.cogs += -r.net;
    else if (r.type === "expense") o.expense += -r.net;
  }
  // cash movement per month
  const cash = all<any>(
    `SELECT substr(e.date,1,7) AS m, COALESCE(SUM(CASE WHEN (a.subtype='cash' OR a.subtype='bank') AND l.debit>0 THEN l.debit ELSE 0 END),0) AS inflow,
       COALESCE(SUM(CASE WHEN (a.subtype='cash' OR a.subtype='bank') THEN l.credit ELSE 0 END),0) AS outflow
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND e.date>=? AND e.date<=? AND a.subtype IN ('cash','bank')
     GROUP BY m`, companyId, from, to);
  const cashMap = new Map(cash.map((c: any) => [c.m, c]));
  const d = new Date(from + "T00:00:00Z"); const toYm = to.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= toYm) {
    const m = d.toISOString().slice(0, 7);
    const o = monthMap.get(m) ?? { revenue: 0, cogs: 0, expense: 0 };
    const c = cashMap.get(m) ?? { inflow: 0, outflow: 0 };
    out.push({ m, revenue: o.revenue, expenses: o.cogs + o.expense, gross: o.revenue - o.cogs, net: o.revenue - o.cogs - o.expense, inflow: c.inflow, outflow: c.outflow });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/** category expense totals for a period (for insights & pie) */
export function expenseByCategory(companyId: number, from: string, to: string) {
  return all<any>(
    `SELECT a.id AS account_id, a.code, a.name, COALESCE(SUM(l.debit - l.credit),0) AS total
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND a.type='expense' AND e.date>=? AND e.date<=?
     GROUP BY a.id HAVING total>0 ORDER BY total DESC`, companyId, from, to);
}
export function revenueByCustomer(companyId: number, from: string, to: string) {
  return all<any>(
    `SELECT c.id, c.name, SUM(d.total_base) AS total, COUNT(*) AS docs
     FROM trade_docs d JOIN customers c ON c.id=d.party_id
     WHERE d.company_id=? AND d.kind IN ('invoice','credit_note') AND d.status!='draft' AND d.status!='cancelled'
       AND d.date>=? AND d.date<=?
     GROUP BY c.id ORDER BY total DESC LIMIT 10`, companyId, from, to);
}
export function taxSummary(companyId: number, from: string, to: string) {
  const rows = all<any>(
    `SELECT COALESCE(SUM(CASE WHEN l.credit>l.debit THEN l.credit-l.debit ELSE 0 END),0) AS collected,
       COALESCE(SUM(CASE WHEN l.debit>l.credit THEN l.debit-l.credit ELSE 0 END),0) AS paid
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND a.subtype='tax' AND e.date>=? AND e.date<=?`, companyId, from, to);
  const r = rows[0] ?? { collected: 0, paid: 0 };
  return { collected: r.collected, paid: r.paid, net: r.collected - r.paid, from, to };
}

/* ---------------- AR / AP from documents (matches ledger by construction) ---------------- */
export function openDocs(companyId: number, kind: "invoice" | "bill", opts: { overdueOnly?: boolean; partyId?: number | null } = {}) {
  return all<any>(
    `SELECT d.*, COALESCE(c.name, s.name) AS party_name, (d.total_base - d.paid) AS outstanding
     FROM trade_docs d
     LEFT JOIN customers c ON c.id=d.party_id AND d.kind='invoice'
     LEFT JOIN suppliers s ON s.id=d.party_id AND d.kind='bill'
     WHERE d.company_id=? AND d.kind=? AND d.status IN ('sent','partial','overdue') AND (d.total_base-d.paid)>0 ${opts.overdueOnly ? "AND d.due_date < ?" : ""} ${opts.partyId ? "AND d.party_id=?" : ""}
     ORDER BY d.due_date`, companyId, kind, ...(opts.overdueOnly ? [today()] : []), ...(opts.partyId ? [opts.partyId] : []));
}
export function overdueDocs(companyId: number, kind: "invoice" | "bill") {
  return all<any>(
    `SELECT d.*, COALESCE(c.name, s.name) AS party_name, (d.total-d.paid) AS outstanding,
       CAST(julianday('now') - julianday(d.due_date) AS INTEGER) AS days_overdue, d.total_base
     FROM trade_docs d
     LEFT JOIN customers c ON c.id=d.party_id AND d.kind='invoice'
     LEFT JOIN suppliers s ON s.id=d.party_id AND d.kind='bill'
     WHERE d.company_id=? AND d.kind=? AND d.due_date<? AND d.status IN ('sent','partial','overdue')
     ORDER BY d.due_date`, companyId, kind, today());
}

/* ---------------- notifications triggers ---------------- */
export function scanAlerts(companyId: number) {
  const alerts: { kind: string; severity: string; title: string; body: string; link: string }[] = [];
  const t = today();
  const ov = get<any>(`SELECT COUNT(*) AS n, COALESCE(SUM(total_base-paid),0) AS v FROM trade_docs WHERE company_id=? AND kind='invoice' AND due_date<? AND status IN ('sent','partial','overdue')`, companyId, t);
  if (ov?.n) alerts.push({ kind: "invoice_overdue", severity: "danger", title: `${ov.n} invoice${ov.n > 1 ? "s" : ""} overdue`, body: `${(ov.v / 100).toLocaleString("en-US")} in receivables past due.`, link: "/app/sales/receivables" });
  const pay = get<any>(`SELECT COUNT(*) AS n, COALESCE(SUM(total_base-paid),0) AS v FROM trade_docs WHERE company_id=? AND kind='bill' AND due_date>=? AND due_date<=date('now','+14 days') AND status IN ('sent','partial')`, companyId, t);
  if (pay?.n) alerts.push({ kind: "upcoming_bills", severity: "warn", title: `${pay.n} bill${pay.n > 1 ? "s" : ""} due within 14 days`, body: `${(pay.v / 100).toLocaleString("en-US")} of payables coming up.`, link: "/app/purchases/payables" });
  const appr = get<any>(`SELECT COUNT(*) AS n FROM expenses WHERE company_id=? AND status='pending_approval'`, companyId);
  if (appr?.n) alerts.push({ kind: "approval", severity: "warn", title: `${appr.n} expense${appr.n > 1 ? "s" : ""} awaiting approval`, body: "Your approval is required before posting.", link: "/app/purchases/expenses" });
  const unrecon = get<any>(`SELECT COUNT(*) AS n FROM bank_lines WHERE company_id=? AND status='unmatched'`, companyId);
  if (unrecon?.n) alerts.push({ kind: "reconciliation", severity: "info", title: `${unrecon.n} bank transactions need review`, body: "Unreconciled lines are open in the bank feed.", link: "/app/accounting/reconciliation" });
  // low cash: cash < 2x avg monthly opex
  const kpi = periodKpis(companyId, t.slice(0, 7) + "-01", t);
  const series = monthlySeries(companyId, 3, t);
  const avgBurn = series.reduce((s, m) => s + m.outflow, 0) / Math.max(1, series.length);
  if (kpi.cash < avgBurn * 1.5 && avgBurn > 0) alerts.push({ kind: "low_cash", severity: "danger", title: "Low cash balance", body: `Cash covers about ${kpi.cash / Math.max(1, avgBurn / 30)} days at current outflow.`, link: "/app/finance/cash-flow" });
  // tax deadline (monthly VAT config in settings; only remind if configured)
  const c = get<any>(`SELECT settings_json FROM companies WHERE id=?`, companyId);
  let taxDay = 0; try { taxDay = JSON.parse(c?.settings_json || "{}")?.tax_reminder_day ?? 0; } catch { /* noop */ }
  if (taxDay > 0) {
    const nextDue = `${t.slice(0, 7)}-${String(taxDay).padStart(2, "0")}`;
    const due = t <= nextDue ? nextDue : (() => { const d = new Date(t + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(Math.min(taxDay, 28)); return d.toISOString().slice(0, 10); })();
    const daysLeft = Math.round((new Date(due).getTime() - new Date(t).getTime()) / 86400000);
    if (daysLeft <= 7) alerts.push({ kind: "tax_deadline", severity: "warn", title: `Tax filing in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, body: `VAT payable currently ${(taxSummary(companyId, t.slice(0, 7) + "-01", t).net / 100).toLocaleString("en-US")}.`, link: "/app/reports/tax" });
  }
  // period closing reminder for prior month with open period
  const prev = (() => { const d = new Date(t + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const openPrev = get<any>(`SELECT 1 AS x FROM period_locks WHERE company_id=? AND period=? AND status='open'`, companyId, prev);
  const hasPrevActivity = get<any>(`SELECT COUNT(*) AS n FROM journal_entries WHERE company_id=? AND period=?`, companyId, prev)?.n ?? 0;
  if (!openPrev && hasPrevActivity && Number(t.slice(8, 10)) > 10) alerts.push({ kind: "period_close", severity: "info", title: `Close period ${prev}?`, body: "Consider closing the previous period once banking is reconciled.", link: "/app/settings/accounting" });
  return alerts;
}
export function pushAlertsAsNotifications(companyId: number) {
  for (const a of scanAlerts(companyId)) {
    const dup = get(`SELECT id FROM notifications WHERE company_id=? AND kind=? AND title=? AND read_at IS NULL AND created_at > datetime('now','-1 day')`, companyId, a.kind, a.title);
    if (dup) continue;
    insert(`INSERT INTO notifications (company_id, kind, severity, title, body, link) VALUES (?,?,?,?,?,?)`,
      companyId, a.kind, a.severity, a.title, a.body, a.link);
  }
}
export function notifyUser(companyId: number, userId: number, o: { kind: string; severity?: string; title: string; body?: string; link?: string }) {
  insert(`INSERT INTO notifications (company_id, user_id, kind, severity, title, body, link) VALUES (?,?,?,?,?,?,?)`,
    companyId, userId, o.kind, o.severity ?? "info", o.title, o.body ?? null, o.link ?? null);
}

/* ---------------- customer / supplier ledgers ---------------- */
export function partyBalances(companyId: number, partyType: "customer" | "supplier", partyId: number) {
  const kind = partyType === "customer" ? "invoice" : "bill";
  const billed = get<any>(`SELECT COALESCE(SUM(total_base),0) AS v, COUNT(*) AS n FROM trade_docs WHERE company_id=? AND kind=? AND party_id=? AND status!='draft' AND status!='cancelled'`, companyId, kind, partyId);
  const paid = get<any>(
    `SELECT COALESCE(SUM(pa.amount),0) AS v FROM payment_allocations pa JOIN trade_docs d ON d.id=pa.doc_id
     JOIN payments p ON p.id=pa.payment_id WHERE d.company_id=? AND d.kind=? AND d.party_id=? AND p.direction=?`,
    companyId, kind, partyId, partyType === "customer" ? "in" : "out");
  const exp = partyType === "supplier" ? get<any>(`SELECT COALESCE(SUM(amount+tax),0) AS v FROM expenses WHERE company_id=? AND supplier_id=? AND account_id IS NULL AND status='posted'`, companyId, partyId)?.v ?? 0 : 0;
  return {
    billed: billed?.v ?? 0, count: billed?.n ?? 0,
    paid: (paid?.v ?? 0) + exp,
    outstanding: Math.max(0, (billed?.v ?? 0) + exp - (paid?.v ?? 0)),
  };
}

/* ---------------- statement (customer/supplier) ---------------- */
export function partyStatement(companyId: number, partyType: "customer" | "supplier", partyId: number, from: string, to: string) {
  const kind = partyType === "customer" ? "invoice" : "bill";
  const dir = partyType === "customer" ? "in" : "out";
  const docs = all<any>(
    `SELECT d.id, d.kind, d.number, d.date, d.due_date, d.total_base AS amount, d.status, NULL AS paid_here
     FROM trade_docs d WHERE d.company_id=? AND d.kind=? AND d.party_id=? AND d.status!='draft' AND d.date<=?`, companyId, kind, partyId, to);
  const pays = all<any>(
    `SELECT p.id, 'payment' AS kind, p.number, p.date, NULL AS due_date, p.amount, 'ok' AS status
     FROM payments p JOIN payment_allocations pa ON pa.payment_id=p.id JOIN trade_docs d2 ON d2.id=pa.doc_id
     WHERE p.company_id=? AND p.direction=? AND d2.party_id=? AND p.date<=?
     GROUP BY p.id`, companyId, dir, partyId, to);
  const rows = [...docs, ...pays].sort((a, b) => (a.date + String(a.id)).localeCompare(b.date + String(b.id)));
  let bal = 0;
  const out = rows.map(r => {
    if (r.kind === "payment") bal -= r.amount; else bal += r.amount;
    return { ...r, balance: bal, signed: r.kind === "payment" ? -r.amount : r.amount };
  }).filter(r => r.date >= from || r.balance !== 0);
  return { rows: out, closing: bal };
}
