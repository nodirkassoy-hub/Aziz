import { requireUser, convert } from "@/lib/ctx";
import { balanceSheet } from "@/lib/reports";
import { today } from "@/lib/dates";
import { ReportShell, Rpt } from "@/components/report-shell";
import { Money } from "@/components/kit";

export const metadata = { title: "Balance sheet" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const to = searchParams?.to || today();
  const bs = balanceSheet(user.companyId, to);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const M = (v: number) => <Money v={conv(v)} currency={disp} />;
  const Section = ({ title, rows, total, totalLabel }: any) => (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <h3 className="mb-2 text-[13.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{title}</h3>
      {rows.map((a: any) => <Rpt key={a.account_id} label={`${a.code} · ${a.name}`} value={M(a.value)} />)}
      <div className="border-t pt-1" style={{ borderColor: "var(--line)" }}><Rpt bold label={totalLabel} value={M(total)} /></div>
    </section>
  );
  return (
    <ReportShell title="Balance Sheet" desc="As of the selected date — no period, just balances. Current-year earnings are computed live from P&L for the fiscal year." to={to} from={null} exportHref={`/api/reports/export?kind=bs&to=${to}`}
      note={bs.balanced ? "Assets equal liabilities + equity ✓ — the ledger is internally consistent." : "⚠ Assets ≠ Liabilities + Equity — check for unposted or unbalanced entries."}>
      <div className="mb-3 flex items-center gap-2 print:hidden">
        <span className={`chip ${bs.balanced ? "chip-good" : "chip-bad"}`}>{bs.balanced ? "✓ balanced" : "✗ unbalanced"}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Assets" rows={bs.assets} total={bs.totalAssets} totalLabel="Total assets" />
        <div className="space-y-4">
          <Section title="Liabilities" rows={bs.liabilities} total={bs.totalLiabilities} totalLabel="Total liabilities" />
          <section className="glass rounded-2xl p-4 sm:p-5">
            <h3 className="mb-2 text-[13.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Equity</h3>
            {bs.equity.map((a: any) => <Rpt key={a.account_id} label={`${a.code} · ${a.name}`} value={M(a.value)} />)}
            <Rpt label="Current-year earnings" value={M(bs.currentEarnings)} color={bs.currentEarnings < 0 ? "var(--neg)" : undefined} />
            <div className="border-t pt-1" style={{ borderColor: "var(--line)" }}><Rpt bold label="Total equity" value={M(bs.totalEquity)} /></div>
            <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--line)" }}>
              <Rpt bold label="Liabilities + Equity" value={M(bs.totalLiabilities + bs.totalEquity)} />
            </div>
          </section>
        </div>
      </div>
    </ReportShell>
  );
}
