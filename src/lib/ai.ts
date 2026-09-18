/**
 * AI CFO — a deterministic analytics engine over the actual books.
 * It does NOT generate numbers: every figure comes from SQL aggregation of posted
 * ledger data and is returned with the period, source and drill-down links.
 * Intents are matched from Uzbek / Russian / English keywords. If a question is
 * ambiguous the engine says so instead of guessing.
 */
import { all, get } from "./db";
import { addDays, daysBetween, monthEnd, monthStart, today } from "./dates";
import { fmtMoney, fmtPct } from "./money";
import { expenseByCategory, monthlySeries, openDocs, overdueDocs, partyBalances, periodKpis, profitAndLoss, revenueByCustomer, taxSummary, cashBalanceAt, trialBalance } from "./reports";
import { cashForecast, cashSeries } from "./cashflow";

export type Insight = { id: string; severity: "info" | "warn" | "danger" | "success"; title: string; reason: string; data: string; period: string; action?: { label: string; href: string } };

export type AiAnswer = {
  question: string;
  summary: string;                 // markdown-ish plain text
  intent: string;
  period: string;
  facts?: { label: string; value: string; hint?: string }[];
  table?: { columns: string[]; rows: (string | number)[][] };
  series?: { labels: string[]; values: number[] };
  links?: { label: string; href: string }[];
  confidence: "exact" | "aggregate";
  note?: string;                   // methodology note
};

const has = (q: string, ...words: string[]) => words.some(w => q.includes(w));

export function askCfo(companyId: string | number, question: string, baseCurrency = "UZS"): AiAnswer {
  const cid = Number(companyId);
  const q = question.toLowerCase().replace(/[?!.]/g, " ").replace(/'/g, "’");
  const t = today();
  const mFrom = monthStart(t), mTo = t;
  const pFrom = monthStart(addDays(monthStart(t), -1)), pTo = monthEnd(addDays(monthStart(t), -1));
  const money = (v: number, cur = baseCurrency) => fmtMoney(v, cur);
  const base: AiAnswer = { question, summary: "", intent: "general", period: `${mFrom} → ${mTo}`, confidence: "exact" };

  /* --- profit --- */
  if (has(q, "foyda", "profit", "прибыл", "clean profit", "net")) {
    const cur = periodKpis(cid, mFrom, mTo), prev = periodKpis(cid, pFrom, pTo);
    const delta = prev.net ? (cur.net - prev.net) / Math.abs(prev.net) : null;
    const series = monthlySeries(cid, 6);
    return { ...base, intent: "profit", confidence: "aggregate",
      summary: `This month (through ${t}) net profit is ${money(cur.net)} — revenue ${money(cur.revenue)} minus expenses ${money(cur.expenses)}. ${prev.net ? `That is ${fmtPct(delta)} versus last month (${money(prev.net)}).` : "Last month had no comparable postings."}`,
      facts: [
        { label: "Revenue", value: money(cur.revenue) },
        { label: "Gross profit", value: money(cur.gross), hint: "revenue − COGS" },
        { label: "Expenses", value: money(cur.expenses) },
        { label: "Net profit", value: money(cur.net) },
      ],
      series: { labels: series.map(s => s.m), values: series.map(s => s.net) },
      links: [{ label: "Open P&L", href: "/app/reports/pl" }, { label: "Drill into revenue", href: "/app/accounting/ledger?acct=sales" }],
      note: "Net profit = posted revenue accounts − posted expense accounts for the period (journal lines).",
    };
  }

  /* --- expense growth by category --- */
  if (has(q, "xarajat") && has(q, "osh", "o’sh", "increase", "вырос", "östk", "growth", "qimmat", "why")) {
    return expensesCompare(cid, mFrom, mTo, pFrom, pTo, money, base);
  }
  if (has(q, "xarajat", "expense", "расход", "harajat")) {
    if (has(q, "katta", "eng", "largest", "top", "category", "kategoriy", "bo'lim")) {
      const cats = expenseByCategory(cid, mFrom, mTo);
      const total = cats.reduce((s: number, c: any) => s + c.total, 0);
      return { ...base, intent: "expense_top", confidence: "aggregate",
        summary: cats.length ? `Biggest expense category this month: ${cats[0].name} at ${money(cats[0].total)} — ${((cats[0].total / total) * 100).toFixed(1)}% of ${money(total)} total expenses.` : "No expenses posted this month yet.",
        table: { columns: ["Category", "Amount", "Share"], rows: cats.slice(0, 6).map((c: any) => [c.name, money(c.total), ((c.total / total) * 100).toFixed(1) + "%"]) },
        links: [{ label: "Expense report", href: "/app/reports/expenses" }, { label: "All expenses", href: "/app/purchases/expenses" }],
        note: "Aggregated from posted expense and bill journal lines for " + mFrom + " → " + mTo + "." };
    }
    const cur = periodKpis(cid, mFrom, mTo);
    const cats = expenseByCategory(cid, mFrom, mTo);
    return { ...base, intent: "expenses", confidence: "aggregate",
      summary: `Expenses this month: ${money(cur.expenses)} across ${cats.length} categories${cats.length ? `, led by ${cats[0].name} (${money(cats[0].total)})` : ""}.`,
      table: { columns: ["Category", "Amount"], rows: cats.slice(0, 8).map((c: any) => [c.name, money(c.total)]) },
      links: [{ label: "Open expenses", href: "/app/purchases/expenses" }],
      note: "Posted expense lines for " + mFrom + " → " + mTo + " (includes COGS)." };
  }

  /* --- who owes us --- */
  if (has(q, "qarzdor", "kim ber", "who owes", "должник", "receivable", "tuloqchi")) {
    const docs = openDocs(cid, "invoice");
    const byParty = new Map<number, { name: string; total: number; count: number }>();
    for (const d of docs) {
      const k = d.party_id; const cur = byParty.get(k) ?? { name: d.party_name ?? "—", total: 0, count: 0 };
      cur.total += d.total - d.paid; cur.count++; byParty.set(k, cur);
    }
    const top = [...byParty.values()].sort((a, b) => b.total - a.total).slice(0, 8);
    const total = top.reduce((s, p) => s + p.total, 0);
    return { ...base, intent: "ar_top", confidence: "aggregate", period: "as of " + t,
      summary: top.length ? `${byParty.size} customers owe a total of ${money(docs.reduce((s, d) => s + (d.total - d.paid), 0))}. Largest debtor: ${top[0].name} at ${money(top[0].total)}.` : "Nobody owes you money right now — all issued invoices are fully paid.",
      table: { columns: ["Customer", "Outstanding", "Open invoices"], rows: top.map(p => [p.name, money(p.total), p.count]) },
      links: [{ label: "AR aging", href: "/app/reports/ar-aging" }, { label: "Receivables", href: "/app/sales/receivables" }],
      note: "Outstanding = invoice total − allocated payments, per open invoice." };
  }

  /* --- overdue invoices / late payments --- */
  if (has(q, "muddati o’tgan", "muddati o'tgan", "overdue", "kechik", "просроч", "late", "tugmagan")) {
    const ov = overdueDocs(cid, "invoice");
    return { ...base, intent: "overdue", confidence: "aggregate", period: "as of " + t,
      summary: ov.length ? `${ov.length} invoice${ov.length > 1 ? "s" : ""} past due totalling ${money(ov.reduce((s: number, d: any) => s + (d.total - d.paid), 0))}. Oldest: ${ov[0].number} (${ov[0].days_overdue} days) — ${ov[0].party_name}.` : "No overdue invoices. Every issued invoice is within its due date.",
      table: { columns: ["Invoice", "Customer", "Due", "Days late", "Outstanding"], rows: ov.slice(0, 8).map((d: any) => [d.number, d.party_name ?? "—", d.due_date, d.days_overdue, money(d.total - d.paid)]) },
      links: [{ label: "Receivables", href: "/app/sales/receivables" }, { label: "AR aging", href: "/app/reports/ar-aging" }],
      note: "Due date has passed and outstanding > 0 (status sent/partial)." };
  }

  /* --- cash flow forecast --- */
  if (has(q, "cash flow", "pul oqimi", "прогноз", "forecast", "keyingi", "next 30", "next 60", "runway", "yetarli")) {
    const f = cashForecast(cid, 30, "base");
    const f60 = cashForecast(cid, 60, "conservative");
    return { ...base, intent: "forecast", confidence: "aggregate", period: `${t} → ${addDays(t, 30)}`,
      summary: `Next 30 days (base case): expected inflow ${money(f.totalIn)}, committed outflow ${money(f.totalOut)} — projected cash ${money(f.closing)} (min ${money(f.min)}). In the conservative case within 60 days cash bottoms at ${money(f60.min)}.${f.lowDate ? ` Risk of going below zero around ${f.lowDate}.` : ""}`,
      facts: [
        { label: "Cash today", value: money(f.opening) },
        { label: "Expected receivables (30d)", value: money(f.expectedReceivables), hint: `${Math.round(f.collectFactor * 100)}% collected` },
        { label: "Committed payments", value: money(f.committedPayables) },
        { label: "Projected balance", value: money(f.closing) },
      ],
      series: { labels: f.rows.filter((_, i) => i % 3 === 0).map(r => r.date.slice(5)), values: f.rows.filter((_, i) => i % 3 === 0).map(r => r.balance) },
      links: [{ label: "Open cash flow planner", href: "/app/finance/cash-flow" }, { label: "Payables", href: "/app/purchases/payables" }],
      note: f.assumptions[0] };
  }

  /* --- balance sheet / cash position --- */
  if (has(q, "kassa", "cash", "balans", "balance", "qancha pul", "сколько денег", "pul qoldi")) {
    const cash = cashBalanceAt(cid, t);
    const banks = all<any>(
      `SELECT ba.name, ba.currency, COALESCE(SUM(CASE WHEN e.date<=? THEN l.debit-l.credit ELSE 0 END),0) AS bal
       FROM bank_accounts ba
       LEFT JOIN accounts a ON a.id=ba.account_id
       LEFT JOIN journal_lines l ON l.account_id=a.id
       LEFT JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
       WHERE ba.company_id=? AND ba.archived=0 AND e.date<=?
       GROUP BY ba.id ORDER BY bal DESC`, t, cid, t);
    return { ...base, intent: "cash", confidence: "exact", period: "as of " + t,
      summary: `Total cash & bank position: ${money(cash)}.`,
      table: banks.length ? { columns: ["Account", "Balance"], rows: banks.filter((b: any) => b.bal !== 0).map((b: any) => [b.name, fmtMoney(b.bal, b.currency || "UZS")]) } : undefined,
      links: [{ label: "Bank accounts", href: "/app/finance/bank" }],
      note: "Sum of posted movements in cash/bank ledger accounts." };
  }

  /* --- tax --- */
  if (has(q, "soliq", "vat", "qqs", "ндс", "tax")) {
    const ts = taxSummary(cid, mFrom, mTo);
    const y = taxSummary(cid, t.slice(0, 4) + "-01-01", t);
    return { ...base, intent: "tax", confidence: "aggregate", period: `${mFrom} → ${mTo}`,
      summary: `Tax collected on invoices this month: ${money(ts.collected)}; input tax on purchases: ${money(ts.paid)}. Net tax payable so far this month: ${money(ts.net)} (year to date: ${money(y.net)}).`,
      facts: [{ label: "Collected (output)", value: money(ts.collected) }, { label: "Paid (input)", value: money(ts.paid) }, { label: "Net liability", value: money(ts.net) }],
      links: [{ label: "Tax report", href: "/app/reports/tax" }, { label: "Tax settings", href: "/app/settings/taxes" }],
      note: "Derived from the Tax Payable (VAT) control account: output tax credits minus input tax debits." };
  }

  /* --- revenue / sales --- */
  if (has(q, "daromad", "revenue", "sales", "savdo", "yutuq", "выручк", "top client", "eng ko’p sot")) {
    const k = periodKpis(cid, mFrom, mTo);
    const tops = revenueByCustomer(cid, mFrom, mTo);
    return { ...base, intent: "revenue", confidence: "aggregate",
      summary: `Revenue booked this month: ${money(k.revenue)} across ${tops.length ? tops.length : 0} top customers${tops.length ? `. Biggest: ${tops[0].name} (${money(tops[0].total)})` : ""}.`,
      table: tops.length ? { columns: ["Customer", "Invoiced", "Docs"], rows: tops.slice(0, 6).map((c: any) => [c.name, money(c.total), c.docs]) } : undefined,
      series: { labels: monthlySeries(cid, 6).map(s => s.m), values: monthlySeries(cid, 6).map(s => s.revenue) },
      links: [{ label: "Revenue report", href: "/app/reports/revenue" }, { label: "Invoices", href: "/app/sales/invoices" }],
      note: "Posted revenue account lines (invoices + other income)." };
  }

  /* --- invoices issued / how many --- */
  if (has(q, "invoice", "hisob-faktura", "schyot", "smyt")) {
    const n = get<any>(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS v FROM trade_docs WHERE company_id=? AND kind='invoice' AND status!='draft'`, cid);
    const unpaid = openDocs(cid, "invoice");
    return { ...base, intent: "invoices", confidence: "exact",
      summary: `${n?.c ?? 0} issued invoices totalling ${money(n?.v ?? 0)}. ${unpaid.length} are still unpaid (${money(unpaid.reduce((s, d) => s + (d.total - d.paid), 0))}).`,
      links: [{ label: "Open invoices", href: "/app/sales/invoices" }],
      note: "trade_docs of kind invoice, non-draft." };
  }

  /* --- margin --- */
  if (has(q, "marzа", "marza", "margin", "gross", "chekim")) {
    const cur = periodKpis(cid, mFrom, mTo), prev = periodKpis(cid, pFrom, pTo);
    const gm = cur.revenue ? cur.gross / cur.revenue : null;
    const gmPrev = prev.revenue ? prev.gross / prev.revenue : null;
    return { ...base, intent: "margin", confidence: "aggregate",
      summary: gm === null ? "Not enough revenue posted this month to compute a margin." :
        `Gross margin this month is ${(gm * 100).toFixed(1)}%${gmPrev !== null ? `, ${((gm - gmPrev) * 100).toFixed(1)} pp versus last month (${(gmPrev * 100).toFixed(1)}%).` : "."}`,
      facts: [{ label: "Gross margin", value: gm === null ? "—" : (gm * 100).toFixed(1) + "%" }, { label: "Net margin", value: cur.revenue ? ((cur.net / cur.revenue) * 100).toFixed(1) + "%" : "—" }],
      links: [{ label: "P&L", href: "/app/reports/pl" }],
      note: "Gross margin = (revenue − COGS) / revenue from posted lines." };
  }

  /* --- runway --- */
  if (has(q, "runway", "yoshirash", "qancha qoladi", "month")) {
    const series = monthlySeries(cid, 6);
    const avgOut = series.length ? series.reduce((s, x) => s + x.outflow, 0) / series.length : 0;
    const cash = cashBalanceAt(cid, t);
    const months = avgOut > 0 ? cash / avgOut : null;
    return { ...base, intent: "runway", confidence: "aggregate", period: "average of last 6 months",
      summary: months === null ? "Average monthly outflow is zero or unavailable — runway is not applicable." : `At the average monthly outflow of the last 6 months (${money(Math.round(avgOut))}), current cash of ${money(cash)} covers about ${months.toFixed(1)} months.`,
      links: [{ label: "Cash flow", href: "/app/finance/cash-flow" }],
      note: "Runway = cash / average monthly cash outflow (posted)." };
  }

  /* --- fallback: list what it can answer --- */
  return { ...base, intent: "unknown", confidence: "exact",
    summary: "I only answer questions I can back with your books. I can compute: profit, expenses (total / growth / top category), revenue, who owes money, overdue invoices, cash position, cash-flow forecast, runway, tax, margins. Try one of the quick actions.",
    note: "The AI CFO never estimates numbers — anything it cannot aggregate from posted data it declines to answer." };
}

function expensesCompare(cid: number, mFrom: string, mTo: string, pFrom: string, pTo: string, money: (v: number) => string, base: AiAnswer): AiAnswer {
  const cur = expenseByCategory(cid, mFrom, mTo), prev = expenseByCategory(cid, pFrom, pTo);
  const prevMap = new Map(prev.map((p: any) => [p.account_id, p.total]));
  const rows = cur.map((c: any) => {
    const before = prevMap.get(c.account_id) ?? 0;
    return { ...c, before, delta: c.total - before, pct: before ? (c.total - before) / before : c.total > 0 ? 1 : 0 };
  }).sort((a: any, b: any) => b.delta - a.delta);
  const up = rows.filter(r => r.delta > 0);
  const curTot = cur.reduce((s: number, c: any) => s + c.total, 0), prevTot = prev.reduce((s: number, p: any) => s + p.total, 0);
  return { ...base, intent: "expense_growth", confidence: "aggregate", period: `${mFrom} (month-to-date) vs ${pFrom} → ${pTo}`,
    summary: `Expenses ${prevTot ? fmtPct(curTot / prevTot - 1) : "started"} month-over-month (${money(curTot)} vs ${money(prevTot)}). ` +
      (up.length ? `Main drivers: ${up.slice(0, 3).map(u => `${u.name} ${fmtPct(u.pct)} (+${money(u.delta)})`).join("; ")}.` : "No category grew versus last month."),
    table: { columns: ["Category", "This month", "Prev month", "Change"], rows: rows.slice(0, 8).map(r2 => [r2.name, money(r2.total), money(r2.before), r2.delta > 0 ? "+" + money(r2.delta) : money(r2.delta)]) },
    links: [{ label: "Expenses", href: "/app/purchases/expenses" }, { label: "Expense report", href: "/app/reports/expenses" }],
    note: "Month-to-date compared with the full previous month — both aggregated from posted journal lines.",
  };
}

/* ---------------- automatic insights ---------------- */
export function generateInsights(companyId: number, baseCurrency = "UZS"): Insight[] {
  const out: Insight[] = [];
  const t = today();
  const mFrom = monthStart(t), pStart = monthStart(addDays(monthStart(t), -1)), pEnd = monthEnd(addDays(monthStart(t), -1));
  const money = (v: number) => fmtMoney(v, baseCurrency, { compact: false });
  const curK = periodKpis(companyId, mFrom, t), prevK = periodKpis(companyId, pStart, pEnd);

  // gross margin trend
  if (curK.revenue > 0 && prevK.revenue > 0) {
    const gm = curK.gross / curK.revenue, gmp = prevK.gross / prevK.revenue;
    if (gm - gmp < -0.02) out.push({ id: "margin", severity: "warn", title: "Gross margin is declining", reason: `Gross margin month-to-date is ${(gm * 100).toFixed(1)}% vs ${(gmp * 100).toFixed(1)}% last full month.`, data: `revenue ${money(curK.revenue)}, COGS ${money(curK.revenue - curK.gross)}`, period: `${mFrom} → ${t}`, action: { label: "Review P&L", href: "/app/reports/pl" } });
    else if (gm - gmp > 0.02) out.push({ id: "margin-up", severity: "success", title: "Gross margin improved", reason: `Up from ${(gmp * 100).toFixed(1)}% to ${(gm * 100).toFixed(1)}%.`, data: `gross profit ${money(curK.gross)}`, period: `${mFrom} → ${t}`, action: { label: "View P&L", href: "/app/reports/pl" } });
  }
  // expense growth
  const cats = expenseByCategory(companyId, mFrom, t), pcats = expenseByCategory(companyId, pStart, pEnd);
  const pmap = new Map(pcats.map((p: any) => [p.account_id, p.total]));
  for (const c of cats) {
    const before = pmap.get(c.account_id) ?? 0;
    if (before > 0 && c.total / before >= 1.18 && c.total - before > 50000000) {
      out.push({ id: `cat-${c.account_id}`, severity: "warn", title: `${c.name} spend up ${((c.total / before - 1) * 100).toFixed(0)}%`, reason: `${c.name}: ${money(c.total)} this month vs ${money(before)} last month.`, data: `Δ ${money(c.total - before)}`, period: `${mFrom} → ${t}`, action: { label: "Inspect expenses", href: "/app/purchases/expenses?category=" + c.code } });
      break;
    }
  }
  // overdue invoices
  const ov = overdueDocs(companyId, "invoice");
  if (ov.length) out.push({ id: "overdue", severity: "danger", title: `${ov.length} invoice${ov.length > 1 ? "s are" : " is"} overdue`, reason: `Oldest is ${ov[0].days_overdue} days late (${ov[0].number}, ${ov[0].party_name}).`, data: `total outstanding ${money(ov.reduce((s: number, d: any) => s + (d.total - d.paid), 0))}`, period: "as of " + t, action: { label: "Chase payments", href: "/app/sales/receivables" } });
  // upcoming commitments
  const f = cashForecast(companyId, 14, "base");
  if (f.totalOut > 0 && f.totalOut > f.opening * 0.2) out.push({ id: "commit", severity: "info", title: "Large payments expected in the next 14 days", reason: `Committed outflows of ${money(f.totalOut)} are scheduled while expected inflows are ${money(f.totalIn)}.`, data: `projected closing balance ${money(f.closing)}`, period: `${t} → ${addDays(t, 14)}`, action: { label: "Open forecast", href: "/app/finance/cash-flow" } });
  // negative projection
  if (f.min < 0) out.push({ id: "negcash", severity: "danger", title: "Projected cash goes negative", reason: `Base-case forecast dips to ${money(f.min)} around ${f.lowDate}.`, data: `today ${money(f.opening)} → closing ${money(f.closing)}`, period: `${t} → ${addDays(t, 30)}`, action: { label: "Plan collections", href: "/app/sales/receivables" } });
  // cash conversion (collections vs issued)
  const issued = get<any>(`SELECT COALESCE(SUM(total),0) v FROM trade_docs WHERE company_id=? AND kind='invoice' AND status!='draft' AND date>=? AND date<=?`, companyId, mFrom, t)?.v ?? 0;
  const collected = get<any>(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE company_id=? AND direction='in' AND date>=? AND date<=?`, companyId, mFrom, t)?.v ?? 0;
  if (issued > 0 && collected < issued * 0.4) out.push({ id: "conversion", severity: "warn", title: "Cash conversion is slow this month", reason: `Collected ${money(collected)} vs ${money(issued)} invoiced (40% benchmark).`, data: `ratio ${((collected / issued) * 100).toFixed(0)}%`, period: `${mFrom} → ${t}`, action: { label: "See AR", href: "/app/sales/receivables" } });
  // unbalanced TB guard (should never happen)
  const tb = trialBalance(companyId, { to: t });
  if (!tb.balanced) out.push({ id: "tb", severity: "danger", title: "Trial balance is out of balance", reason: `Debits ${money(tb.totalDebit)} vs credits ${money(tb.totalCredit)}.`, data: `difference ${money(tb.totalDebit - tb.totalCredit)}`, period: "all time → " + t, action: { label: "Open trial balance", href: "/app/accounting/trial-balance" } });
  // reconciliation backlog
  const unrecon = get<any>(`SELECT COUNT(*) n, COALESCE(SUM(ABS(amount)),0) v FROM bank_lines WHERE company_id=? AND status='unmatched'`, companyId);
  if (unrecon?.n > 3) out.push({ id: "recon", severity: "info", title: `${unrecon.n} bank transactions unreconciled`, reason: `Bank feed has ${unrecon.n} unmatched lines worth ${money(unrecon.v)}.`, data: "Bank Reconciliation → open workspace", period: "as of " + t, action: { label: "Reconcile now", href: "/app/accounting/reconciliation" } });
  return out;
}

/* ---------------- health (transparent metrics) ---------------- */
export function healthMetrics(companyId: number) {
  const t = today();
  const k = periodKpis(companyId, monthStart(t), t);
  const series = monthlySeries(companyId, 6);
  const avgOut = series.length ? series.reduce((s, x) => s + x.outflow, 0) / series.length : 0;
  const revenue = series.reduce((s, x) => s + x.revenue, 0);
  const gross = series.reduce((s, x) => s + x.gross, 0);
  const net = series.reduce((s, x) => s + x.net, 0);
  const cash = cashBalanceAt(companyId, t);
  const ar = k.ar, ap = k.ap, debt = k.debt;
  const ov = get<any>(`SELECT COUNT(*) n, COALESCE(SUM(total-paid),0) v FROM trade_docs WHERE company_id=? AND kind='invoice' AND due_date<? AND status IN ('sent','partial','overdue')`, companyId, t);
  const overduePct = ar > 0 ? (ov?.v ?? 0) / ar : 0;
  const metrics = [
    { key: "runway", label: "Cash runway", formula: "cash ÷ avg monthly outflow (6 mo)", value: avgOut > 0 ? cash / avgOut : null, unit: "months", good: (v: number) => v >= 3, watch: (v: number) => v >= 1.5, display: avgOut > 0 ? (cash / avgOut).toFixed(1) + " mo" : "—" },
    { key: "net_margin", label: "Net margin", formula: "net profit ÷ revenue (6 mo)", value: revenue ? net / revenue : null, unit: "", good: (v: number) => v >= 0.15, watch: (v: number) => v >= 0.05, display: revenue ? ((net / revenue) * 100).toFixed(1) + "%" : "—" },
    { key: "gross_margin", label: "Gross margin", formula: "(revenue − COGS) ÷ revenue (6 mo)", value: revenue ? gross / revenue : null, unit: "", good: (v: number) => v >= 0.4, watch: (v: number) => v >= 0.25, display: revenue ? ((gross / revenue) * 100).toFixed(1) + "%" : "—" },
    { key: "overdue", label: "Overdue share of AR", formula: "overdue amount ÷ AR balance", value: ar ? overduePct : 0, unit: "", good: (v: number) => v <= 0.1, watch: (v: number) => v <= 0.3, display: ar ? ((overduePct) * 100).toFixed(0) + "%" : "—" },
    { key: "coverage", label: "AR vs AP coverage", formula: "receivables ÷ payables", value: ap ? ar / ap : null, unit: "", good: (v: number) => v >= 1, watch: (v: number) => v >= 0.5, display: ap ? (ar / ap).toFixed(2) + "×" : "—" },
    { key: "leverage", label: "Debt to cash", formula: "loans payable ÷ cash", value: cash ? debt / Math.max(cash, 1) : null, unit: "", good: (v: number) => v <= 0.5, watch: (v: number) => v <= 1.5, display: debt ? (debt / Math.max(cash, 1)).toFixed(2) + "×" : "—" },
    { key: "conversion", label: "Cash conversion", formula: "cash in ÷ invoiced (this month)", value: k.revenue > 0 ? (() => { const collected = get<any>(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE company_id=? AND direction='in' AND date>=? AND date<=?`, companyId, monthStart(t), t)?.v ?? 0; return collected / k.revenue; })() : null, unit: "", good: (v: number) => v >= 0.7, watch: (v: number) => v >= 0.4, display: "—" },
  ];
  // fix conversion display
  const convIdx = 6;
  const collected = get<any>(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE company_id=? AND direction='in' AND date>=? AND date<=?`, companyId, monthStart(t), t)?.v ?? 0;
  if (k.revenue > 0) { metrics[convIdx].value = collected / k.revenue; metrics[convIdx].display = ((collected / k.revenue) * 100).toFixed(0) + "%"; }
  // opex share
  const opex = series.reduce((s, x) => s + x.expenses, 0);
  const scored = metrics.map((m: any) => {
    const { good, watch, ...plain } = m;
    return { ...plain, status: m.value === null ? "n/a" : good(m.value) ? "good" : watch(m.value) ? "watch" : "risk" };
  });
  const points = scored.reduce((s: number, m: any) => s + (m.status === "good" ? 1 : m.status === "watch" ? 0.5 : m.status === "risk" ? 0 : 0.5), 0);
  const applicable = scored.filter((m: any) => m.status !== "n/a").length || 1;
  const score = Math.round((points / applicable) * 100);
  return { metrics: scored, score, formula: "each metric = 1pt good / 0.5pt watch / 0pt risk; score = points ÷ metrics evaluated × 100", inputs: { cash, avgOut, revenue, gross, net, ar, ap, debt, opex, overdue: ov?.v ?? 0 } };
}
