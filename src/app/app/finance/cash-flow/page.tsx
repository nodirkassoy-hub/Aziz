import { requireUser, convert } from "@/lib/ctx";
import { get } from "@/lib/db";
import { cashSeries, cashForecast, cashAt } from "@/lib/cashflow";
import { addDays, fmtDate, monthLabel, today } from "@/lib/dates";
import { PageHeader } from "@/components/shell";
import { Money } from "@/components/kit";
import { BarChart, LineArea } from "@/components/charts";
import { ForecastControls } from "./client";

export const metadata = { title: "Cash flow" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const t = today();
  const scenario = (["base", "optimistic", "conservative"].includes(searchParams?.scenario) ? searchParams.scenario : "base") as any;
  const horizon = Math.min(180, Math.max(14, +searchParams?.horizon || 60));
  const fc = cashForecast(cid, horizon, scenario);
  const series = cashSeries(cid, addDays(t, -180), t, "week");
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const cashNow = conv(cashAt(cid, t));
  const bars = series.rows.slice(-26).map(r => ({ label: monthLabel(r.key).slice(0, 3) + " " + r.key.slice(8), a: conv(r.inflow), b: conv(r.outflow) }));
  const projLine = fc.rows.filter((_: any, i: number) => i % Math.ceil(fc.rows.length / 40 || 1) === 0 || i === fc.rows.length - 1);
  const lowDays = fc.lowDate ? Math.round((new Date(fc.lowDate + "T00:00:00Z").getTime() - new Date(t + "T00:00:00Z").getTime()) / 86400000) : null;
  return (
    <>
      <PageHeader title="Cash flow" desc="History from the ledger, projection from open documents — every number links back to postings."
        actions={<a className="btn-outline btn-sm no-underline" href="/app/reports/cash-flow">Statement version</a>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Cash today (bank + cash)</div>
          <div className="num mt-0.5 text-[18px] font-bold" style={{ color: cashNow < 0 ? "var(--neg)" : "var(--pos)" }}><Money v={cashNow} currency={disp} /></div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>across all bank &amp; cash accounts</div>
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{horizon}-day projection · min balance</div>
          <div className="num mt-0.5 text-[18px] font-bold" style={{ color: conv(fc.min) < 0 ? "var(--neg)" : "var(--warn)" }}><Money v={conv(fc.min)} currency={disp} /></div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: fc.lowDate ? "var(--neg)" : "var(--muted)" }}>
            {fc.lowDate ? `crosses zero around ${fmtDate(fc.lowDate)} (in ${lowDays}d)` : "stays positive in the window"}</div>
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Expected in vs committed out</div>
          <div className="num mt-0.5 text-[15px] font-bold"><span style={{ color: "var(--pos)" }}>+<Money v={conv(fc.totalIn)} currency={disp} /></span></div>
          <div className="num text-[15px] font-bold" style={{ color: "var(--neg)" }}>−<Money v={conv(fc.totalOut)} currency={disp} /></div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-1 text-[15px] font-semibold">Weekly cash movement — last 6 months</h3>
          <p className="mb-2 text-[12px]" style={{ color: "var(--muted)" }}>Every inflow/outflow that touched cash or bank accounts (from posted journal lines).</p>
          <BarChart data={bars} currency={disp} height={220} aName="In" bName="Out" />
        </section>
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold">Projected balance</h3>
            <ForecastControls scenario={scenario} horizon={horizon} />
          </div>
          <p className="mb-2 text-[12px]" style={{ color: "var(--muted)" }}>{fc.assumptions[0]} · {fc.assumptions[3]}</p>
          <LineArea series={[{ name: "projected balance", values: projLine.map((r: any) => conv(r.balance)) }]} labels={projLine.map((r: any) => r.date.slice(5))} currency={disp} height={220} showZeroLine />
          <details className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <summary className="cursor-pointer">All assumptions</summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{fc.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
          </details>
        </section>
      </div>
      <section className="glass mt-4 rounded-2xl p-4 sm:p-5">
        <h3 className="mb-3 text-[15px] font-semibold">Next 14 days, day by day</h3>
        <table className="tbl w-full text-left text-[12.5px]">
          <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="py-1.5 pr-3 font-medium">Date</th><th className="py-1.5 pr-3 text-right font-medium">In</th>
            <th className="py-1.5 pr-3 text-right font-medium">Out</th><th className="py-1.5 text-right font-medium">Balance after</th></tr></thead>
          <tbody>
            {fc.rows.slice(0, 14).filter((r: any) => r.inflow || r.outflow || r.date === fc.rows[0].date).map((r: any) => (
              <tr key={r.date} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="num py-1.5 pr-3">{fmtDate(r.date)}</td>
                <td className="num py-1.5 pr-3 text-right" style={{ color: "var(--pos)" }}>{r.inflow ? "+" + conv(r.inflow).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</td>
                <td className="num py-1.5 pr-3 text-right" style={{ color: "var(--neg)" }}>{r.outflow ? "−" + conv(r.outflow).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</td>
                <td className="num py-1.5 text-right font-semibold" style={{ color: conv(r.balance) < 0 ? "var(--neg)" : undefined }}>{conv(r.balance).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
