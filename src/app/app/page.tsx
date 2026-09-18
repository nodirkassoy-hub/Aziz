import Link from "next/link";
import { requireUser } from "@/lib/ctx";
import { get, all } from "@/lib/db";
import { resolvePeriod, today, fmtDate, addDays, monthStart, addMonths } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { monthlySeries, overdueDocs, openDocs, cashFlowStatement } from "@/lib/reports";
import { generateInsights, healthMetrics } from "@/lib/ai";
import { cashForecast } from "@/lib/cashflow";
import { Dashboard } from "@/components/dashboard";
import { convert } from "@/lib/ctx";
import { PageHeader } from "@/components/shell";
import { get as g } from "@/lib/db";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const user = requireUser();
  const cid = user.companyId;
  const p = resolvePeriod(user.period);
  const disp = user.displayCurrency || user.company.base_currency;
  const base = user.company.base_currency;
  const conv = (v: number) => convert(v, base, disp, cid);
  const label = (v: number | null | undefined, opts: { compact?: boolean } = {}) => fmtMoney(conv(v ?? 0), disp, opts);

  const prefs = (() => { try { return JSON.parse(get<any>(`SELECT prefs_json FROM memberships WHERE company_id=? AND user_id=?`, cid, user.id)?.prefs_json ?? "{}"); } catch { return {}; } })();

  const months = monthlySeries(cid, 7, p.to);
  const now = periodKpisLocal(cid, p.from, p.to);
  const before = periodKpisLocal(cid, p.prevFrom, p.prevTo);
  const health = healthMetrics(cid);
  const insights = generateInsights(cid, disp).map(i => i);
  const overdue = overdueDocs(cid, "invoice");
  const dueBills = all<any>(`SELECT d.*, s.name AS party_name, (d.total_base-d.paid) AS outstanding FROM trade_docs d LEFT JOIN suppliers s ON s.id=d.party_id
    WHERE d.company_id=? AND d.kind='bill' AND d.status IN ('sent','partial') AND d.due_date>=? AND d.due_date<=? ORDER BY d.due_date LIMIT 6`, cid, today(), addDays(today(), 21));
  const recent = all<any>(
    `SELECT e.id, e.entry_no, e.date, e.description, e.source_kind, e.source_id,
       COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
     FROM journal_entries e JOIN journal_lines l ON l.entry_id=e.id
     WHERE e.company_id=? AND e.status='posted' AND e.date>=?
     GROUP BY e.id ORDER BY e.date DESC, e.id DESC LIMIT 8`, cid, addDays(today(), -45));
  const forecast = cashForecast(cid, 30, "base");
  const topCats = all<any>(
    `SELECT a.name AS label, COALESCE(SUM(l.debit - l.credit),0) AS value
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND a.type='expense' AND e.date>=? AND e.date<=?
     GROUP BY a.id HAVING value>0 ORDER BY value DESC LIMIT 6`, cid, p.from, p.to);
  const convertedCats = topCats.map(c => ({ ...c, value: conv(c.value) }));
  const demo = user.company.is_demo === 1;

  return (
    <>
      <PageHeader
        title={<>Good ${greeting()}. <span className="font-normal" style={{ color: "var(--muted)" }}>{user.name.split(" ")[0]}{demo ? " — reviewing demo data" : ""}</span></>}
        desc={<>{`${user.company.name} · ${p.label} (${fmtDate(p.from)} → ${fmtDate(p.to)})${disp !== base ? ` · shown in ${disp}` : ""}`}</>}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/app/sales/invoices/new" className="btn-primary">＋ New invoice</Link>
            <Link href="/app/purchases/expenses?new=1" className="btn-outline">Add expense</Link>
            <Link href="/app/ai-cfo" className="btn-outline" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>✦ Ask AI CFO</Link>
          </div>
        }
      />
      <Dashboard
        cards={[
          card("revenue", "Revenue", label(now.revenue), label(before.revenue), pct(now.revenue, before.revenue), months.map(m => m.revenue), "/app/accounting/ledger?account=" + (accountId(cid, "4000") ?? ""), "Top line from posted invoices & revenue accounts."),
          card("expenses", "Expenses", label(now.expenses), label(before.expenses), pct(now.expenses, before.expenses), months.map(m => m.expenses), "/app/purchases/expenses", "Every posted expense, COGS & bill."),
          card("gross", "Gross Profit", label(now.revenue - now.cogs), label(before.revenue - before.cogs), pct(now.revenue - now.cogs, before.revenue - before.cogs), months.map(m => m.gross), "/app/reports/pl", "Revenue − cost of goods sold."),
          card("net", "Net Profit", label(now.net), label(before.net), pct(now.net, before.net), months.map(m => m.net), "/app/reports/pl", "Bottom line after all posted activity."),
          card("cash", "Cash Balance", label(cashAt(cid, today())), label(cashAt(cid, addDays(today(), -30))), pct(cashAt(cid, today()), cashAt(cid, addDays(today(), -30))), months.map(m => m.inflow), "/app/finance/bank", "Cash + all bank accounts, today."),
          card("ar", "Accounts Receivable", label(now.ar), label(before.ar), pct(now.ar, before.ar), months.map(m => m.revenue * 0.3), "/app/sales/receivables", "Customers owe you this — chase the overdue first."),
          card("ap", "Accounts Payable", label(now.ap), label(before.ap), pct(now.ap, before.ap), months.map(m => m.expenses * 0.3), "/app/purchases/payables", "You owe suppliers this."),
          card("tax", "Tax Liability", label(taxNet(cid)), label(taxNet(cid, addMonths(today(), -1))), null, months.map(() => 0), "/app/reports/tax", "Output tax − input tax (posted)."),
        ].map(c => ({ ...c, value: c.value, money: 0 }))}
        health={health}
        disp={disp} base={base} demo={demo}
        insights={insights}
        overdue={overdue.map(d => ({ id: d.id, number: d.number, party: d.party_name, outstanding: conv(d.total_base - d.paid), days: d.days_overdue, due: d.due_date }))}
        dueBills={dueBills.map(b => ({ id: b.id, number: b.number, party: b.party_name, amount: conv(b.total_base - b.paid), due: b.due_date }))}
        recent={recent.map(r => ({ id: r.id, no: r.entry_no, date: r.date, description: r.description, amount: conv(Math.max(r.debit, r.credit) === 0 ? 0 : (r.debit || r.credit)), kind: r.source_kind, sourceId: r.source_id }))}
        cashflow={{ labels: months.map(m => m.m.slice(5)), inflow: months.map(m => conv(m.inflow)), outflow: months.map(m => conv(m.outflow)), balance: (() => { let bal = conv(cashAt(cid, addMonths(monthStart(today()), -months.length))); return months.map(m => (bal += conv(m.inflow - m.outflow))); })() }}
        expenseMix={convertedCats}
        forecast={{ closing: conv(forecast.closing), min: conv(forecast.min), opening: conv(forecast.opening), totalIn: conv(forecast.totalIn), totalOut: conv(forecast.totalOut), rows: forecast.rows.filter((_, i) => i % 3 === 0).map(r => ({ date: r.date.slice(5), balance: conv(r.balance) })) }}
        widgetPrefs={prefs.widgets ?? null}
        periodKey={user.period}
      />
    </>
  );
}
function card(key: string, label: string, value: string, prev: string, pct: number | null, spark: number[], href: string, hint: string) {
  return { key, label, value, prev, pct, spark, href, hint };
}
function pct(a: number, b: number) { return b === 0 ? null : (a - b) / Math.abs(b); }
function greeting() { const h = new Date().getUTCHours(); return h < 11 ? "morning" : h < 18 ? "afternoon" : "evening"; }
function accountId(cid: number, code: string) { return g<any>(`SELECT id FROM accounts WHERE company_id=? AND code=?`, cid, code)?.id; }
function cashAt(cid: number, asOf: string) { return get<any>(`SELECT COALESCE(SUM(l.debit-l.credit),0) v FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.company_id=? JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date<=? WHERE l.company_id=? AND a.subtype IN ('cash','bank')`, cid, asOf, cid)?.v ?? 0; }
function taxNet(cid: number, to = today()) { const v = get<any>(`SELECT COALESCE(SUM(l.credit-l.debit),0) v FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.company_id=? JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.date<=? WHERE l.company_id=? AND a.subtype='tax'`, cid, to, cid)?.v ?? 0; return -v; }
function periodKpisLocal(cid: number, from: string, to: string) {
  const rows = all<any>(`SELECT a.type, a.subtype, COALESCE(SUM(l.credit - l.debit),0) AS net FROM journal_lines l JOIN accounts a ON a.id=l.account_id JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.company_id=? AND e.date>=? AND e.date<=? GROUP BY a.type, a.subtype`, cid, from, to);
  const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + r.net, 0);
  const revenue = sum(r => r.type === "revenue");
  const cogs = -sum(r => r.type === "expense" && r.subtype === "cogs");
  const exp = -sum(r => r.type === "expense");
  const ar = -sum(r => r.subtype === "ar");
  const ap = -sum(r => r.subtype === "ap");
  return { revenue, cogs, expenses: exp, net: revenue - exp, ar, ap };
}
