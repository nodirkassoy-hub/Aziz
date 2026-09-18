import { requireUser, convert } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { generalLedger } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Money, EmptyState } from "@/components/kit";
import { fmtDate } from "@/lib/dates";
import { resolvePeriod } from "@/lib/dates";
import Link from "next/link";

export const metadata = { title: "General ledger" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const accounts = all<any>(`SELECT id, code, name, type FROM accounts WHERE company_id=? AND archived=0 ORDER BY code`, cid);
  const acc = accounts.find((a: any) => String(a.id) === String(searchParams?.account)) ?? accounts.find((a: any) => a.code === "1010") ?? accounts[0];
  const per = resolvePeriod(user.period);
  const from = searchParams?.from || per.from;
  const to = searchParams?.to || per.to;
  const page = Math.max(1, Number(searchParams?.page ?? 1)); const perPage = 60;
  let opening = 0, rows: any[] = [];
  if (acc) {
    opening = get<any>(
      `SELECT COALESCE(SUM(l.debit - l.credit),0) v FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
       WHERE l.company_id=? AND l.account_id=? AND e.date<?`, cid, acc.id, from)?.v ?? 0;
    rows = generalLedger(cid, { accountId: acc.id, from, to, limit: perPage, offset: (page - 1) * perPage, search: searchParams?.q || null });
  }
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const drFirst = acc && (acc.type === "asset" || acc.type === "expense");
  let running = drFirst ? opening : -opening;
  const shown = rows.map(r => {
    const net = r.debit - r.credit;
    running += drFirst ? net : -net;
    return { ...r, balance: running, debit_conv: conv(r.debit), credit_conv: conv(r.credit), balance_conv: conv(r.balance) };
  });
  const q = searchParams?.q;
  return (
    <>
      <PageHeader title="General ledger" desc="Line-by-line postings for one account — opening balance, movements, running balance."
        actions={acc && <a className="btn-outline btn-sm no-underline" href={`/api/reports/export?kind=gl&account=${acc.id}&from=${from}&to=${to}`}>Export CSV</a>} />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <select className="input !w-72" name="account" defaultValue={acc?.id ?? ""}>
          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select>
        <input className="input !w-36" type="date" name="from" defaultValue={from} />
        <input className="input !w-36" type="date" name="to" defaultValue={to} />
        <input className="input !w-44" name="q" placeholder="Search description…" defaultValue={q ?? ""} />
        <button className="btn-outline btn-sm">View</button>
      </form>
      {!acc ? <EmptyState title="No accounts" desc="Create one from the Chart of Accounts first." /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[13px]">
            <span className="font-semibold">{acc.code} · {acc.name}</span>
            <span style={{ color: "var(--muted)" }} className="num">opening <b>{minorStr(conv(drFirst ? opening : -opening))}</b> · closing <b>{minorStr(running)}</b></span>
            <Link className="link !text-xs" href="/app/accounting/trial-balance">↔ trial balance</Link>
          </div>
          {shown.length === 0 ? <EmptyState title="No postings in this range" desc="Widen the dates or clear the search — the account has {0} postings total, just none here." /> : (
            <div className="glass rounded-2xl overflow-x-auto">
              <table className="tbl w-full min-w-[640px] text-left text-[12.5px]">
                <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Entry</th>
                  <th className="px-4 py-2.5 font-medium">Description</th><th className="px-4 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit</th><th className="px-4 py-2.5 text-right font-medium">Balance</th></tr></thead>
                <tbody>
                  {shown.map((r: any) => (
                    <tr key={r.line_id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="num whitespace-nowrap px-4 py-2">{fmtDate(r.date)}</td>
                      <td className="num px-4 py-2"><Link className="link" href={`/app/accounting/journal?q=${encodeURIComponent(r.entry_no ?? "")}&status=all`}>{r.entry_no ?? `#${r.entry_id}`}</Link></td>
                      <td className="max-w-[320px] px-4 py-2"><span className="block truncate">{r.description}</span>{r.memo && <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>{r.memo}</span>}</td>
                      <td className="num px-4 py-2 text-right">{r.debit ? <Money v={r.debit_conv} currency={disp} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td className="num px-4 py-2 text-right">{r.credit ? <Money v={r.credit_conv} currency={disp} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td className="num px-4 py-2 text-right font-semibold"><Money v={r.balance_conv} currency={disp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagerish page={page} hasMore={shown.length === perPage} base={`/app/accounting/ledger?account=${acc.id}&from=${from}&to=${to}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
        </>
      )}
    </>
  );
}
function minorStr(minorConv: number) { return (minorConv / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function Pagerish({ page, hasMore, base }: { page: number; hasMore: boolean; base: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[13px]">
      {page > 1 && <Link className="btn-outline btn-sm no-underline" href={`${base}&page=${page - 1}`}>← Newer</Link>}
      <span className="text-xs" style={{ color: "var(--muted)" }}>page {page}</span>
      {hasMore && <Link className="btn-outline btn-sm no-underline" href={`${base}&page=${page + 1}`}>Older →</Link>}
    </div>
  );
}
