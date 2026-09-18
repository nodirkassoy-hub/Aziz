import { requireUser, convert } from "@/lib/ctx";
import { agingBuckets } from "@/lib/aging";
import { ReportShell } from "@/components/report-shell";
import { Money } from "@/components/kit";
import { AgingBars } from "@/components/charts";
import { fmtDate, today } from "@/lib/dates";
import { daysBetween } from "@/lib/dates";
import Link from "next/link";

export const metadata = { title: "AP aging" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const a = agingBuckets(user.companyId, "bill");
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const byParty: Record<string, { id: string; name: string; buckets: number[]; total: number; docs: number }> = {};
  const t = today();
  for (const d of a.rows as any[]) {
    const late = d.due_date ? -daysBetween(d.due_date, t) : 0;
    const idx = late <= 0 ? 0 : late <= 15 ? 1 : late <= 30 ? 2 : late <= 60 ? 3 : late <= 90 ? 4 : 5;
    const key = String(d.party_id ?? "unknown");
    byParty[key] ??= { id: key, name: d.party_name ?? "Unassigned", buckets: [0, 0, 0, 0, 0, 0], total: 0, docs: 0 };
    byParty[key].buckets[idx] += d.total_base - d.paid; byParty[key].total += d.total_base - d.paid; byParty[key].docs++;
  }
  const parties = Object.values(byParty).sort((x, y) => y.total - x.total);
  return (
    <ReportShell title="Accounts Payable Aging" desc="Unpaid bills bucketed by how far past due they are." to={t} from={null} exportHref="/api/reports/export?kind=ap">
      <div className="glass mb-4 rounded-2xl p-4 sm:p-5">
        <AgingBars buckets={a.buckets.map(b => ({ ...b, total: conv(b.total) }))} currency={disp} />
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[12.5px]">
          <thead><tr className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-3 py-2 font-medium">Customer</th>{a.buckets.map(b => <th key={b.label} className="px-3 py-2 text-right font-medium">{b.label}</th>)}
            <th className="px-3 py-2 text-right font-bold">Total</th></tr></thead>
          <tbody>
            {parties.map((p, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="px-3 py-1.5">{/\d+$/.test(p.id) ? <Link className="no-underline font-medium hover:underline" href={`/app/purchases/suppliers/${p.id}`}>{p.name}</Link> : <span className="font-medium">{p.name}</span>} <span className="text-[11px]" style={{ color: "var(--muted)" }}>({p.docs})</span></td>
                {p.buckets.map((v, j) => <td key={j} className="num px-3 py-1.5 text-right" style={j >= 2 && v > 0 ? { color: "var(--neg)", fontWeight: 600 } : undefined}>{v ? conv(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "·"}</td>)}
                <td className="num px-3 py-1.5 text-right font-bold"><Money v={conv(p.total)} currency={disp} /></td>
              </tr>
            ))}
            {parties.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>Nothing owed 🎉</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>Source: {a.rows.length} open documents, dated by due date (today {fmtDate(t)}). Collectability estimates are yours to make — Mizom just sorts them honestly.</p>
    </ReportShell>
  );
}
