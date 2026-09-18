/** Server-side view helpers shared by pages (KPI payloads, selectors). */
import { all, get } from "./db";
import { resolvePeriod, monthStart, addMonths, today, monthEnd } from "./dates";
import { periodKpis, monthlySeries, expenseByCategory, cashBalanceAt, overdueDocs, trialBalance, partyBalances } from "./reports";
import { convert } from "./ctx";
import type { SessionUser } from "./auth";

export function kpiSet(user: SessionUser) {
  const cid = user.companyId;
  const p = resolvePeriod(user.period);
  const cur = periodKpis(cid, p.from, p.to);
  const prev = periodKpis(cid, p.prevFrom, p.prevTo);
  const series = monthlySeries(cid, 7, p.to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const pct = (now: number, before: number) => (before !== 0 ? (now - before) / Math.abs(before) : now !== 0 ? 1 : 0);
  const spark = (sel: (s: any) => number) => [...series.map(sel), 0].slice(0, 7);
  const last = series.length - 1;
  const cards = [
    { key: "revenue", label: "Revenue", value: conv(cur.revenue), prev: conv(prev.revenue), pct: pct(cur.revenue, prev.revenue), spark: spark(s => s.revenue), accent: "#1a9e83" },
    { key: "expenses", label: "Expenses", value: conv(cur.expenses), prev: conv(prev.expenses), pct: pct(cur.expenses, prev.expenses), spark: spark(s => s.expenses), accent: "#d64550", invert: true },
    { key: "gross", label: "Gross Profit", value: conv(cur.gross), prev: conv(prev.gross), pct: pct(cur.gross, prev.gross), spark: spark(s => s.gross), accent: "#3c6df0" },
    { key: "net", label: "Net Profit", value: conv(cur.net), prev: conv(prev.net), pct: pct(cur.net, prev.net), spark: spark(s => s.net), accent: "#8b5cf6" },
    { key: "cash", label: "Cash Balance", value: conv(cashBalanceAt(cid, today())), prev: conv(cashBalanceAt(cid, today().slice(0, 7) === p.to.slice(0, 7) ? addDaysSafe(monthStart(p.to), -1) : p.to)), pct: null, spark: series.map(s => s.inflow - s.outflow), accent: "#0ea5e9", asOf: true },
    { key: "ar", label: "Accounts Receivable", value: conv(cur.ar), prev: conv(prev.ar), pct: pct(cur.ar, prev.ar), spark: spark(s => s.revenue), accent: "#b45309", invert: true },
    { key: "ap", label: "Accounts Payable", value: conv(cur.ap), prev: conv(prev.ap), pct: pct(cur.ap, prev.ap), spark: spark(s => s.expenses), accent: "#f472b6", invert: true },
    { key: "tax", label: "Tax Liability", value: conv(cur.taxLiab), prev: conv(prev.taxLiab), pct: pct(cur.taxLiab, prev.taxLiab), spark: spark(s => Math.max(0, s.net * 0.12)), accent: "#64748b", tax: true },
  ];
  return { cards: cards.map(c => ({ ...c, prevPct: c.pct })), period: p, raw: cur, disp };
}
function addDaysSafe(s: string, n: number) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export function tbStatus(cid: number) {
  const tb = trialBalance(cid, { to: today() });
  return { balanced: tb.balanced, debit: tb.totalDebit, credit: tb.totalCredit };
}
export function topCategory(cid: number, from: string, to: string) {
  const rows = expenseByCategory(cid, from, to);
  return rows[0] ?? null;
}
export function overdueSummary(cid: number) {
  const rows = overdueDocs(cid, "invoice");
  return { count: rows.length, total: rows.reduce((s, r) => s + (r.total_base - r.paid), 0), rows: rows.slice(0, 6) };
}
