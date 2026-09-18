import { requireUser, convert } from "@/lib/ctx";
import { cashFlowStatement } from "@/lib/reports";
import { resolvePeriod } from "@/lib/dates";
import { ReportShell, Rpt } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Cash flow statement" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const cf = cashFlowStatement(user.companyId, from, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const M = (v: number) => <Money v={conv(v)} currency={disp} signed />;
  return (
    <ReportShell title="Cash Flow Statement" desc="Direct method: each cash-side journal line attributed by its counterparty account type." from={from} to={to} exportHref={`/api/reports/export?kind=cf&from=${from}&to=${to}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Rpt label="Opening cash & bank" value={M(cf.opening)} />
          <div className="my-2 border-t" style={{ borderColor: "var(--line)" }} />
          <Rpt label="Operating activities" value={M(cf.operating)} color={cf.operating >= 0 ? "var(--pos)" : "var(--neg)"} />
          <Rpt label="Investing activities" value={M(cf.investing)} color={cf.investing >= 0 ? undefined : "var(--warn)"} />
          <Rpt label="Financing activities" value={M(cf.financing)} />
          <div className="my-2 border-t" style={{ borderColor: "var(--line)" }} />
          <Rpt bold label="Net change" value={M(cf.netChange)} color={cf.netChange >= 0 ? "var(--pos)" : "var(--neg)"} />
          <Rpt bold label="Closing cash & bank" value={M(cf.closing)} />
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-2 text-[13.5px] font-semibold">Movements</h3>
          <div className="max-h-[420px] overflow-y-auto">
            {cf.movements.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>No cash movements in this period.</p> :
              cf.movements.map((mv: any, i: number) => (
                <div key={i} className="flex items-center gap-2 border-t py-1.5 text-[12px]" style={{ borderColor: "var(--line)" }}>
                  <span className="num shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>{fmtDate(mv.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{mv.description}</span>
                  <span className="num shrink-0 font-semibold" style={{ color: mv.delta >= 0 ? "var(--pos)" : "var(--neg)" }}>{conv(mv.delta).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </ReportShell>
  );
}
