import { requireUser, convert } from "@/lib/ctx";
import { expenseByCategory, monthlySeries } from "@/lib/reports";
import { all } from "@/lib/db";
import { resolvePeriod, fmtDate } from "@/lib/dates";
import { ReportShell } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { BarChart, Donut } from "@/components/charts";

export const metadata = { title: "Expense analysis" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const cats = expenseByCategory(cid, from, to);
  const total = cats.reduce((s: number, c: any) => s + c.total, 0);
  const top = all<any>(
    `SELECT e.date, e.description, e.amount + e.tax AS total, a.name AS cat FROM expenses e
     LEFT JOIN accounts a ON a.id=e.category_account_id
     WHERE e.company_id=? AND e.status='posted' AND e.date>=? AND e.date<=? ORDER BY total DESC LIMIT 15`, cid, from, to);
  const series = monthlySeries(cid, 12, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  return (
    <ReportShell title="Expense Analysis" desc="Posted expenses by category, from the ledger (this includes anything posted via bills, not only the Expenses screen)." from={from} to={to} exportHref={`/api/reports/export?kind=expenses&from=${from}&to=${to}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Mix <span className="text-[11.5px] font-normal" style={{ color: "var(--muted)" }}>total <Money v={conv(total)} currency={disp} /></span></h3>
          {cats.length ? <div className="flex flex-wrap items-center gap-4">
            <Donut slices={cats.slice(0, 8).map((c: any) => ({ label: c.name, value: conv(c.total) }))} currency={disp} centerLabel="spend" />
            <div className="min-w-[140px] flex-1 space-y-1 text-[12.5px]">
              {cats.map((c: any) => (
                <div key={c.account_id} className="flex items-center gap-2">
                  <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{c.code}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="num font-semibold"><Money v={conv(c.total)} currency={disp} /></span>
                  <span className="num w-12 text-right text-[11px]" style={{ color: "var(--muted)" }}>{total ? Math.round(c.total / total * 100) : 0}%</span>
                </div>))}
            </div>
          </div> : <p className="text-[13px]" style={{ color: "var(--muted)" }}>No posted expenses in the period.</p>}
        </section>
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Monthly expense trend (12m)</h3>
          <BarChart data={series.map(s => ({ label: s.m.slice(5), a: 0, b: conv(s.expenses) }))} currency={disp} height={210} bName="Expenses" />
          <h3 className="mb-1 mt-4 text-[13.5px] font-semibold">Largest single expenses</h3>
          {top.map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-2 border-t py-1.5 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
              <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{fmtDate(e.date)}</span>
              <span className="min-w-0 flex-1 truncate">{e.description ?? "—"}</span>
              <span className="chip !py-0 text-[10px]">{e.cat ?? "uncategorized"}</span>
              <span className="num font-semibold"><Money v={conv(e.total)} currency={disp} /></span>
            </div>))}
        </section>
      </div>
    </ReportShell>
  );
}
