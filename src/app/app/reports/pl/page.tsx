import { requireUser, convert } from "@/lib/ctx";
import { profitAndLoss, monthlySeries, fiscalYearStart } from "@/lib/reports";
import { resolvePeriod, today } from "@/lib/dates";
import { ReportShell, Rpt } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { BarChart } from "@/components/charts";
import { fmtPct } from "@/lib/money";

export const metadata = { title: "Profit & Loss" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const cid = user.companyId;
  const pl = profitAndLoss(cid, from, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const M = (v: number, signed = false) => <Money v={conv(v)} currency={disp} signed={signed} />;
  const secs = [["Revenue", pl.revenue, "var(--pos)"], ["Cost of goods sold", pl.cogs], ["Operating expenses", pl.opex], ["Other income", pl.other]] as const;
  const series = monthlySeries(cid, 12, to);
  return (
    <ReportShell title="Profit & Loss" desc="P&L from posted entries only. Percentages are share of revenue." from={from} to={to} exportHref={`/api/reports/export?kind=pl&from=${from}&to=${to}`}>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {secs.map(([name, accs, color]) => (
            <section key={name} className="glass rounded-2xl p-4 sm:p-5">
              <h3 className="mb-2 text-[13.5px] font-bold uppercase tracking-wide" style={{ color: color ?? "var(--muted)" }}>{name}</h3>
              {(accs as any[]).filter((a: any) => a.net !== 0).map((a: any) => (
                <Rpt key={a.account_id} label={`${a.code} · ${a.name}`} value={<span className="inline-flex items-baseline gap-3">{M(a.net)}{a.pct != null && <span className="w-14 text-right text-[11px] font-normal" style={{ color: "var(--muted)" }}>{fmtPct(a.pct)}</span>}</span>} />
              ))}
              {name === "Revenue" && <div className="border-t pt-1" style={{ borderColor: "var(--line)" }}><Rpt bold label="Total revenue" value={M(pl.revenueTotal)} /></div>}
            </section>
          ))}
        </div>
        <div>
          <div className="glass rounded-2xl p-4 sm:p-5">
            <h3 className="mb-2 text-[13.5px] font-semibold">Summary</h3>
            <Rpt label="Revenue" value={M(pl.revenueTotal)} />
            <Rpt label="Cost of goods sold" value={M(-pl.cogsTotal)} color="var(--neg)" />
            <div className="border-t pt-1" style={{ borderColor: "var(--line)" }}><Rpt bold label="Gross profit" value={<span style={{ color: "var(--pos)" }}>{M(pl.grossProfit)}</span>} /></div>
            <Rpt label="Operating expenses" value={M(-pl.opexTotal)} color="var(--neg)" />
            <div className="border-t pt-1" style={{ borderColor: "var(--line)" }}><Rpt bold label="Operating profit" value={M(pl.operatingProfit)} /></div>
            {pl.otherTotal !== 0 && <Rpt label="Other income" value={M(pl.otherTotal)} />}
            <div className="border-t-2 mt-1 pt-2" style={{ borderColor: "var(--line)" }}>
              <Rpt bold label="Net profit" value={<span style={{ color: pl.netProfit >= 0 ? "var(--pos)" : "var(--neg)" }}>{M(pl.netProfit)}</span>} />
              <div className="mt-0.5 text-right text-[11.5px]" style={{ color: "var(--muted)" }}>margin {fmtPct(pl.revenueTotal ? (pl.netProfit / pl.revenueTotal) * 100 : null)}</div>
            </div>
          </div>
          <div className="glass mt-4 rounded-2xl p-4 sm:p-5">
            <h3 className="mb-1 text-[13.5px] font-semibold">Monthly — revenue vs expenses (12m)</h3>
            <BarChart currency={disp} height={200} aName="Revenue" bName="Expenses"
              data={series.map(s => ({ label: s.m.slice(5) + "·" + s.m.slice(2, 4), a: conv(s.revenue), b: conv(s.expenses) }))} />
          </div>
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>Fiscal year started {fiscalYearStart(cid, to)} — used by the balance sheet for current earnings.</p>
        </div>
      </div>
    </ReportShell>
  );
}
