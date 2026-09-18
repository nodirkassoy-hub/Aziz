import { requireUser, convert } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { generalLedger } from "@/lib/reports";
import { resolvePeriod, fmtDate } from "@/lib/dates";
import { ReportShell } from "@/components/report-shell";
import { AccountPicker } from "@/components/report-controls";
import { Money } from "@/components/kit";

export const metadata = { title: "General ledger (report)" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const accounts = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND archived=0 ORDER BY code`, cid);
  const acc = accounts.find((a: any) => String(a.id) === String(searchParams?.account)) ?? accounts[0];
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const rows = acc ? generalLedger(cid, { accountId: acc.id, from, to, limit: 2000 }) : [];
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  let bal = 0;
  return (
    <ReportShell title="General Ledger" desc="Full line listing for one account — for printing or handing to an auditor." from={from} to={to}
      exportHref={acc ? `/api/reports/export?kind=gl&account=${acc.id}&from=${from}&to=${to}` : undefined}
      extra={<AccountPicker accounts={accounts} value={acc?.id} from={from} to={to} />}>
      {acc && <div className="mb-2 text-[13px]"><b>{acc.code} · {acc.name}</b> <span style={{ color: "var(--muted)" }}>· {rows.length} lines · {fmtDate(from)} → {fmtDate(to)}</span></div>}
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[12px]">
          <thead><tr className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Entry</th><th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Debit</th><th className="px-3 py-2 text-right font-medium">Credit</th><th className="px-3 py-2 text-right font-medium">Running</th></tr></thead>
          <tbody>
            {rows.map((r: any) => { bal += r.debit - r.credit; return (
              <tr key={r.line_id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="num whitespace-nowrap px-3 py-1.5">{fmtDate(r.date)}</td>
                <td className="num px-3 py-1.5">{r.entry_no}</td>
                <td className="max-w-[280px] truncate px-3 py-1.5">{r.description}{r.memo ? ` — ${r.memo}` : ""}</td>
                <td className="num px-3 py-1.5 text-right">{r.debit ? <Money v={conv(r.debit)} currency={disp} /> : ""}</td>
                <td className="num px-3 py-1.5 text-right">{r.credit ? <Money v={conv(r.credit)} currency={disp} /> : ""}</td>
                <td className="num px-3 py-1.5 text-right font-semibold">{conv(bal).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
              </tr>
            ); })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>No postings for this account in the range.</td></tr>}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
