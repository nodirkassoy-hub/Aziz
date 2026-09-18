import { requireUser, convert } from "@/lib/ctx";
import { taxSummary } from "@/lib/reports";
import { all } from "@/lib/db";
import { resolvePeriod } from "@/lib/dates";
import { ReportShell, Rpt } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { BarChart } from "@/components/charts";

export const metadata = { title: "Tax report" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const ts = taxSummary(cid, from, to);
  const bySource = all<any>(
    `SELECT e.source_kind, COALESCE(SUM(l.credit - l.debit),0) AS net
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.subtype='tax'
     JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND e.date>=? AND e.date<=? GROUP BY e.source_kind ORDER BY net DESC`, cid, from, to);
  const rates = all<any>(`SELECT name, rate_pct, applies, kind FROM tax_rates WHERE company_id=? AND archived=0`, cid);
  const monthly = all<any>(
    `SELECT substr(e.date,1,7) m, COALESCE(SUM(CASE WHEN l.credit>l.debit THEN l.credit-l.debit ELSE 0 END),0) collected,
       COALESCE(SUM(CASE WHEN l.debit>l.credit THEN l.debit-l.credit ELSE 0 END),0) paid
     FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND a.subtype='tax' JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
     WHERE l.company_id=? AND e.date>=? AND e.date<=? GROUP BY m ORDER BY m`, cid, from, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const M = (v: number) => <Money v={conv(v)} currency={disp} />;
  const net = ts.net;
  return (
    <ReportShell title="Tax Report" desc="Output tax collected vs input tax paid, both read from the tax payable account — settlements against the budget included." from={from} to={to} exportHref={`/api/reports/export?kind=tax&from=${from}&to=${to}`}
      note={`Computed from your posted entries${user.company.jurisdiction ? ` for ${user.company.jurisdiction}` : ""}. This is a working figure, not a filed return — reconcile it with your local filing rules and your accountant before submitting anything.`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Rpt label="Output tax collected (sales, credit notes)" value={M(ts.collected)} />
          <Rpt label="Input tax paid (bills, expenses)" value={M(ts.paid)} />
          <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
            <Rpt bold label={net >= 0 ? "Net payable to budget" : "Net refundable position"} value={<span style={{ color: net >= 0 ? "var(--warn)" : "var(--pos)" }}>{M(Math.abs(net))}</span>} />
          </div>
          <h3 className="mb-1 mt-5 text-[13px] font-semibold">Where it came from</h3>
          {bySource.map((r: any) => <Rpt key={r.source_kind} label={<span className="capitalize">{r.source_kind.replace("_", " ")}</span>} value={M(r.net)} color={r.net >= 0 ? undefined : "var(--pos)"} />)}
          {rates.length > 0 && (<><h3 className="mb-1 mt-5 text-[13px] font-semibold">Configured rates</h3>
            <div className="flex flex-wrap gap-1.5">{rates.map((r: any, i: number) => <span key={i} className="chip">{r.name} · {r.rate_pct}% · {r.applies}</span>)}</div>
            <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>Rates are editable in Settings → Taxes — reports follow whatever you configured.</p></>)}
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Collected vs paid, by month</h3>
          {monthly.length ? <BarChart data={monthly.map((m: any) => ({ label: m.m.slice(5) + "·" + m.m.slice(2, 4), a: conv(m.collected), b: conv(m.paid) }))} currency={disp} height={230} aName="Collected" bName="Paid" />
            : <p className="text-[13px]" style={{ color: "var(--muted)" }}>No tax movements in the period.</p>}
        </div>
      </div>
    </ReportShell>
  );
}
