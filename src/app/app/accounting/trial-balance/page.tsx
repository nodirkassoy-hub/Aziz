import { requireUser, convert } from "@/lib/ctx";
import { trialBalance } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Money } from "@/components/kit";
import { resolvePeriod } from "@/lib/dates";
import Link from "next/link";

export const metadata = { title: "Trial balance" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const tb = trialBalance(user.companyId, { from: searchParams?.cumulative ? null : from, to });
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  return (
    <>
      <PageHeader title="Trial balance" desc="Every account with activity, summed from posted journal lines. If debits ≠ credits something is deeply wrong — Mizom enforces balance on every posting, so this is your proof."
        actions={<a className="btn-outline btn-sm no-underline" href={`/api/reports/export?kind=tb&from=${from}&to=${to}`}>Export CSV</a>} />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input className="input !w-36" type="date" name="from" defaultValue={from} />
        <input className="input !w-36" type="date" name="to" defaultValue={to} />
        <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
          <input type="checkbox" name="cumulative" value="1" defaultChecked={searchParams?.cumulative === "1"} className="accent-[var(--accent)]" /> since inception
        </label>
        <button className="btn-outline btn-sm">Refresh</button>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`chip ${tb.balanced ? "chip-good" : "chip-bad"}`}>{tb.balanced ? "✓ balanced" : "✗ out of balance"}</span>
        <span className="text-[12.5px] num" style={{ color: "var(--muted)" }}>debits {conv(tb.totalDebit).toLocaleString("en-US", { maximumFractionDigits: 2 })} · credits {conv(tb.totalCredit).toLocaleString("en-US", { maximumFractionDigits: 2 })} {disp}</span>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">Code</th><th className="px-4 py-2.5 font-medium">Account</th>
            <th className="px-4 py-2.5 text-right font-medium">Debit</th><th className="px-4 py-2.5 text-right font-medium">Credit</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Balance</th></tr></thead>
          <tbody>
            {tb.rows.map((r: any) => (
              <tr key={r.account_id} className="border-t hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--line)" }}>
                <td className="num px-4 py-2 font-semibold"><Link className="no-underline text-inherit" href={`/app/accounting/ledger?account=${r.account_id}&from=${from}&to=${to}`}>{r.code}</Link></td>
                <td className="px-4 py-2">{r.name}<span className="ml-2 text-[11px] capitalize" style={{ color: "var(--muted)" }}>{r.type}</span></td>
                <td className="num px-4 py-2 text-right">{r.display_debit ? <Money v={conv(r.display_debit)} currency={disp} /> : "—"}</td>
                <td className="num px-4 py-2 text-right">{r.display_credit ? <Money v={conv(r.display_credit)} currency={disp} /> : "—"}</td>
                <td className="num hidden px-4 py-2 text-right font-semibold sm:table-cell" style={{ color: r.balance < 0 ? "var(--neg)" : undefined }}><Money v={conv(r.balance)} currency={disp} signed /></td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold" style={{ borderColor: "var(--line)" }}>
              <td className="px-4 py-2.5" colSpan={2}>Total · <Link className="link !text-[12px] font-normal" href={`/app/accounting/journal?from=${from}&to=${to}&status=all`}>open journal →</Link></td>
              <td className="num px-4 py-2.5 text-right"><Money v={conv(tb.totalDebit)} currency={disp} /></td>
              <td className="num px-4 py-2.5 text-right"><Money v={conv(tb.totalCredit)} currency={disp} /></td>
              <td className="num hidden px-4 py-2.5 text-right sm:table-cell">{tb.balanced ? "✓" : <span style={{ color: "var(--neg)" }}>✗</span>}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
