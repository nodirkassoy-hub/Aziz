import { requireUser, convert } from "@/lib/ctx";
import { agingBuckets } from "@/lib/aging";
import { PageHeader } from "@/components/shell";
import { Money, EmptyState } from "@/components/kit";
import { AgingBars } from "@/components/charts";
import { fmtDate } from "@/lib/dates";
import { can } from "@/lib/auth";
import Link from "next/link";

export const metadata = { title: "Receivables" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const cid = user.companyId;
  const a = agingBuckets(cid, "invoice");
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const t = fmtDate;
  return (
    <>
      <PageHeader title="Receivables" desc="Every open invoice, aged by due date. Totals come from the same documents the AR ledger posts from — they can’t drift."
        actions={<a className="btn-outline btn-sm no-underline" href="/api/reports/export?kind=ar">Export CSV</a>} />
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <Kpi label="Total outstanding"><Money v={conv(a.total)} currency={disp} className="text-[16px] font-bold" /></Kpi>
          <Kpi2 label="Overdue" color="var(--neg)"><Money v={conv(a.overdue)} currency={disp} className="text-[14px] font-bold" /></Kpi2>
          <Kpi2 label="Due within 7 days" color="var(--warn)"><Money v={conv(a.dueSoon)} currency={disp} className="text-[14px] font-bold" /></Kpi2>
        </div>
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Aging profile</div>
          {a.total > 0 ? <AgingBars buckets={a.buckets.map(b => ({ ...b, total: conv(b.total) }))} currency={disp} />
            : <div className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>No open invoices. 🎉</div>}
        </div>
      </div>
      {a.rows.length === 0 ? <EmptyState title="Nothing to chase" desc="All issued invoices are settled." /> : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl w-full text-left text-[13px]">
            <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Due</th>
              <th className="px-4 py-2.5 text-right font-medium">Outstanding</th><th className="px-4 py-2.5" /></tr></thead>
            <tbody>
              {a.rows.map((d: any) => {
                const open = d.total_base - d.paid;
                const late = d.due_date ? daysLate(d.due_date) : 0;
                return (
                  <tr key={d.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5"><Link className="num font-semibold no-underline hover:underline" href={`/app/sales/invoices/${d.id}`}>{d.number}</Link></td>
                    <td className="px-4 py-2.5"><Link className="no-underline hover:underline" href={`/app/sales/customers/${d.party_id}`}>{d.party_name ?? "—"}</Link></td>
                    <td className="num hidden px-4 py-2.5 sm:table-cell" style={late > 0 ? { color: "var(--neg)" } : undefined}>
                      {t(d.due_date)}{late > 0 && <span className="ml-1.5 text-[10.5px] font-semibold">+{late}d</span>}</td>
                    <td className="num px-4 py-2.5 text-right font-semibold"><Money v={conv(open)} currency={disp} /></td>
                    <td className="px-4 py-2.5 text-right"><Link className="btn-outline btn-sm !px-2.5 text-xs no-underline" href={`/app/sales/payments/new?dir=in&party=${d.party_id}`}>Receive</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function Kpi({ label, children }: any) { return <div className="flex items-center justify-between py-1"><span className="text-[12.5px]" style={{ color: "var(--muted)" }}>{label}</span><span className="num">{children}</span></div>; }
function Kpi2({ label, color, children }: any) { return <div className="flex items-center justify-between border-t py-1" style={{ borderColor: "var(--line)" }}><span className="text-[12.5px]" style={{ color: "var(--muted)" }}>{label}</span><span className="num" style={{ color }}>{children}</span></div>; }
function daysLate(due: string) { return Math.max(0, Math.round((Date.now() - new Date(due + "T00:00:00Z").getTime()) / 86400000)); }
