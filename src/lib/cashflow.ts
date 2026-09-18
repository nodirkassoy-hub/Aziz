/** Cash-flow: actuals from the ledger (cash/bank account lines) + deterministic forecast. */
import { all, get, insert, run } from "./db";
import { addDays, iso, today } from "./dates";
import { postExpenseJE } from "./postings";

export function cashSeries(companyId: number, from: string, to: string, grain: "day" | "week" | "month") {
  const rows = all<any>(
    `SELECT e.date,
       COALESCE(SUM(l.debit),0)  AS inflow,
       COALESCE(SUM(l.credit),0) AS outflow
     FROM journal_lines l
     JOIN accounts a ON a.id=l.account_id AND a.company_id=?
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND a.subtype IN ('cash','bank') AND e.date>=? AND e.date<=?
     GROUP BY e.date ORDER BY e.date`,
    companyId, companyId, from, to);
  const keyOf = (date: string) => {
    if (grain === "day") return date;
    if (grain === "month") return date.slice(0, 7);
    const d = new Date(date + "T00:00:00Z");
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1)); // Monday of week
    return iso(d);
  };
  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const r of rows) {
    const k = keyOf(r.date);
    const cur = map.get(k) ?? { inflow: 0, outflow: 0 };
    cur.inflow += r.inflow; cur.outflow += r.outflow;
    map.set(k, cur);
  }
  const out: { key: string; inflow: number; outflow: number; net: number; opening: number; closing: number }[] = [];
  let open = openingCashAt(companyId, from);
  const seen = new Set<string>();
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 4000) {
    const key = keyOf(cur);
    if (!seen.has(key)) {
      seen.add(key);
      const v = map.get(key) ?? { inflow: 0, outflow: 0 };
      const net = v.inflow - v.outflow;
      out.push({ key, inflow: v.inflow, outflow: v.outflow, net, opening: open, closing: open + net });
      open += net;
    }
    cur = grain === "month" ? iso(addMonths1(cur)) : grain === "week" ? addDays(cur, 7) : addDays(cur, 1);
  }
  return { rows: out, opening: out.length ? out[0].opening : open };
}
function addMonths1(date: string) { const d = new Date(date.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); return d; }

export function openingCashAt(companyId: number, from: string) {
  const r = get<any>(
    `SELECT COALESCE(SUM(l.debit - l.credit),0) AS v
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.company_id=?
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date < ?
     WHERE l.company_id=? AND a.subtype IN ('cash','bank')`, companyId, from, companyId);
  return r?.v ?? 0;
}
export function cashAt(companyId: number, asOf: string) {
  const r = get<any>(
    `SELECT COALESCE(SUM(l.debit - l.credit),0) AS v
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.company_id=?
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date <= ?
     WHERE l.company_id=? AND a.subtype IN ('cash','bank')`, companyId, asOf, companyId);
  return r?.v ?? 0;
}

/**
 * Forecast = current cash + committed outflows (unpaid bills + recurring) − expected inflows (open AR).
 * Scenarios apply transparent, labelled collection factors to expected AR.
 */
export function cashForecast(companyId: number, horizonDays = 60, scenario: "base" | "optimistic" | "conservative" = "base") {
  const t = today();
  const cashNow = cashAt(companyId, t);
  const collectFactor = scenario === "base" ? 0.85 : scenario === "optimistic" ? 1.0 : 0.6;
  const ar = all<any>(
    `SELECT d.party_id, COALESCE(c.name,'—') AS name, d.due_date, (d.total_base-d.paid) AS outstanding
     FROM trade_docs d LEFT JOIN customers c ON c.id=d.party_id
     WHERE d.company_id=? AND d.kind='invoice' AND d.status IN ('sent','partial','overdue') AND (d.total_base-d.paid)>0`, companyId);
  const bills = all<any>(
    `SELECT d.party_id, COALESCE(s.name,'—') AS name, d.due_date, (d.total_base-d.paid) AS outstanding
     FROM trade_docs d LEFT JOIN suppliers s ON s.id=d.party_id
     WHERE d.company_id=? AND d.kind='bill' AND d.status IN ('sent','partial') AND (d.total_base-d.paid)>0`, companyId);
  const recurring = all<any>(
    `SELECT e.supplier_id AS party_id, COALESCE(s.name,'—') AS name, e.amount+e.tax AS outstanding, e.recur_freq, e.recur_dom
     FROM expenses e LEFT JOIN suppliers s ON s.id=e.supplier_id
     WHERE e.company_id=? AND e.recur_freq IS NOT NULL AND (e.recur_ends IS NULL OR e.recur_ends>=?) AND e.status='posted'`, companyId, t);
  const daily = new Map<string, { inflow: number; outflow: number }>();
  const day = (date: string | null) => {
    const k = !date || date < t ? t : date > addDays(t, horizonDays) ? addDays(t, horizonDays) : date;
    let cur = daily.get(k); if (!cur) { cur = { inflow: 0, outflow: 0 }; daily.set(k, cur); } return cur;
  };
  for (const d of ar) day(d.due_date).inflow += Math.round(d.outstanding * collectFactor);
  for (const b of bills) day(b.due_date).outflow += b.outstanding;
  for (const r2 of recurring) {
    let d = nextRecurDate(r2.recur_freq, r2.recur_dom, t);
    let guard = 0;
    while (d <= addDays(t, horizonDays) && guard++ < 240) {
      day(d).outflow += r2.outstanding;
      d = nextRecurDate(r2.recur_freq, r2.recur_dom, addDays(d, 1));
    }
  }
  const rows: { date: string; inflow: number; outflow: number; net: number; balance: number }[] = [];
  let bal = cashNow;
  for (let i = 0; i <= horizonDays; i++) {
    const d = addDays(t, i);
    const v = daily.get(d) ?? { inflow: 0, outflow: 0 };
    bal += v.inflow - v.outflow;
    rows.push({ date: d, inflow: v.inflow, outflow: v.outflow, net: v.inflow - v.outflow, balance: bal });
  }
  const minBal = Math.min(...rows.map(r => r.balance), cashNow);
  const lowIdx = rows.findIndex(r => r.balance < 0);
  return {
    horizonDays, scenario, collectFactor,
    opening: cashNow, rows, closing: bal, min: minBal,
    lowDate: lowIdx >= 0 ? rows[lowIdx].date : null,
    totalIn: rows.reduce((s, r) => s + r.inflow, 0),
    totalOut: rows.reduce((s, r) => s + r.outflow, 0),
    expectedReceivables: ar.reduce((s: number, a2: any) => s + a2.outstanding, 0),
    committedPayables: bills.reduce((s: number, b2: any) => s + b2.outstanding, 0),
    assumptions: [
      `Expected receivables valued at ${Math.round(collectFactor * 100)}% collection probability (${scenario} scenario).`,
      "Overdue invoices are assumed to be collected within the forecast window.",
      "Committed payments = unpaid bills; recurring expenses projected at their last posted amount.",
      "This is a projection computed from your ledger — not a guarantee of future balances.",
    ],
  };
}

export function nextRecurDate(freq: string | null, dom: number | null, from: string): string {
  const start = from;
  if (freq === "weekly") {
    const d = new Date(start + "T00:00:00Z");
    const diff = (1 - d.getUTCDay() + 7) % 7; // next Monday (or today)
    return addDays(start, diff || 7);
  }
  const stepM = freq === "quarterly" ? 3 : freq === "yearly" ? 12 : 1;
  const day = Math.min(Math.max(dom || 1, 1), 28);
  const y = Number(start.slice(0, 4)); const m = Number(start.slice(5, 7));
  let cand = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (cand < start) {
    const d2 = new Date(Date.UTC(y, m - 1 + stepM, 1));
    cand = `${d2.getUTCFullYear()}-${String(d2.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return cand;
}

/** Materialize due recurring expenses once per period (idempotent, called on list load). */
export function ensureRecurringDue(companyId: number) {
  const t = today();
  const templates = all<any>(`SELECT e.* FROM expenses e WHERE e.company_id=? AND e.recur_freq IS NOT NULL
    AND e.status='posted' AND (e.recur_ends IS NULL OR e.recur_ends>=?)`, companyId, t);
  let created = 0;
  for (const src of templates) {
    const group = src.recur_group ?? `tpl-${src.id}`;
    const last = get<any>(`SELECT date FROM expenses WHERE company_id=? AND recur_group=? ORDER BY date DESC LIMIT 1`, companyId, group);
    const lastDate = last?.date ?? src.date;
    const next = nextRecurDate(src.recur_freq, src.recur_dom, addDays(lastDate, 1));
    if (next <= t && (src.recur_ends == null || next <= src.recur_ends)) {
      const dup = get(`SELECT id FROM expenses WHERE company_id=? AND recur_group=? AND date=?`, companyId, group, next);
      if (dup) continue;
      const id = insert(
        `INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, tax_pct, tax_rate_id, account_id, status, created_by, recur_freq, recur_dom, recur_ends, recur_group)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        companyId, next, src.supplier_id, src.category_account_id, src.description || "Recurring expense",
        src.amount, src.tax, src.tax_pct, src.tax_rate_id, src.account_id, "posted", src.created_by,
        src.recur_freq, src.recur_dom, src.recur_ends, group);
      run(`UPDATE expenses SET recur_group=? WHERE id=? OR id=?`, group, id, src.id);
      try { postExpenseJE(id, src.created_by, null); } catch { /* period locked or unbalanced — leave for accountant */ }
      created++;
    }
  }
  return created;
}
