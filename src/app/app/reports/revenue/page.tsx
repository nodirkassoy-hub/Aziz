import { requireUser, convert } from "@/lib/ctx";
import { revenueByCustomer, monthlySeries } from "@/lib/reports";
import { resolvePeriod } from "@/lib/dates";
import { ReportShell, Rpt } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { LineArea } from "@/components/charts";

export const metadata = { title: "Revenue analysis" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const byCust = revenueByCustomer(cid, from, to);
  const series = monthlySeries(cid, 12, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const total = series.reduce((s, m) => s + m.revenue, 0);
  const avg = series.length ? total / series.length : 0;
  const best = series.slice().sort((a, b) => b.revenue - a.revenue)[0];
  return (
    <ReportShell title="Revenue Analysis" desc="Revenue from posted invoice entries. Customer totals come from issued documents — returns reduce them via credit notes." from={from} to={to} exportHref={`/api/reports/export?kind=revenue&from=${from}&to=${to}`}>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Monthly revenue (12m)</h3>
          <LineArea series={[{ name: "revenue", values: series.map(s => conv(s.revenue)) }, { name: "gross profit", values: series.map(s => conv(s.gross)), dashed: true }]}
            labels={series.map(s => s.m.slice(5))} currency={disp} height={230} />
          <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
            <div><div style={{ color: "var(--muted)" }}>12m revenue</div><b className="num"><Money v={conv(total)} currency={disp} /></b></div>
            <div><div style={{ color: "var(--muted)" }}>avg / month</div><b className="num"><Money v={conv(Math.round(avg))} currency={disp} /></b></div>
            <div><div style={{ color: "var(--muted)" }}>best month</div><b className="num">{best ? `${best.m.slice(0, 4)}-${best.m.slice(5)} · ${conv(best.revenue).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}</b></div>
          </div>
        </section>
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Top customers <span className="text-[11.5px] font-normal" style={{ color: "var(--muted)" }}>period {from} → {to}</span></h3>
          {byCust.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>No invoices in the period.</p> : byCust.map((c: any) => (
            <Rpt key={c.id} label={<span className="inline-flex items-center gap-2"><span>{c.name}</span><span className="chip !py-0 text-[10px]">{c.docs} doc{c.docs > 1 ? "s" : ""}</span></span>}
              value={<span className="inline-flex items-baseline gap-2"><b className="num"><Money v={conv(c.total)} currency={disp} /></b><span className="text-[11px]" style={{ color: "var(--muted)" }}>{total ? Math.round(c.total / total * 100) : 0}%</span></span>} />
          ))}
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>Concentration insight: if your top customer exceeds ~40% of revenue, keep a second account growing — Mizom can’t fix that for you 🙂</p>
        </section>
      </div>
    </ReportShell>
  );
}
