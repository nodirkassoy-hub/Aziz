import { requireUser, convert } from "@/lib/ctx";
import { trialBalance } from "@/lib/reports";
import { resolvePeriod } from "@/lib/dates";
import { ReportShell } from "@/components/report-shell";
import { Money } from "@/components/kit";

export const metadata = { title: "Trial balance (report)" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const per = resolvePeriod(user.period);
  const from = searchParams?.cumulative ? null : (searchParams?.from || per.from);
  const to = searchParams?.to || per.to;
  const tb = trialBalance(user.companyId, { from, to });
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  return (
    <ReportShell title="Trial Balance" desc="Printable proof that debits equal credits." from={from} to={to} exportHref={`/api/reports/export?kind=tb&from=${from ?? ""}&to=${to}`}>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[12.5px]">
          <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2 font-medium">Account</th><th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 text-right font-medium">Debit</th><th className="px-4 py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody>
            {tb.rows.map((r: any) => (
              <tr key={r.account_id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="num px-4 py-1.5 font-semibold">{r.code}</td><td className="px-4 py-1.5">{r.name}</td>
                <td className="px-4 py-1.5 capitalize" style={{ color: "var(--muted)" }}>{r.type}</td>
                <td className="num px-4 py-1.5 text-right">{r.display_debit ? <Money v={conv(r.display_debit)} currency={disp} /> : ""}</td>
                <td className="num px-4 py-1.5 text-right">{r.display_credit ? <Money v={conv(r.display_credit)} currency={disp} /> : ""}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold" style={{ borderColor: "var(--line)" }}>
              <td className="px-4 py-2" colSpan={3}>Total {tb.balanced ? "✓ balanced" : "✗ UNBALANCED"}</td>
              <td className="num px-4 py-2 text-right"><Money v={conv(tb.totalDebit)} currency={disp} /></td>
              <td className="num px-4 py-2 text-right"><Money v={conv(tb.totalCredit)} currency={disp} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] print:hidden" style={{ color: "var(--muted)" }}>Need to dig in? <a className="link" href="/app/accounting/trial-balance">Interactive trial balance →</a></p>
    </ReportShell>
  );
}
