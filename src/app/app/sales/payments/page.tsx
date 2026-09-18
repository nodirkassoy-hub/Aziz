import { PageHeader } from "@/components/shell";
import { listPayments } from "@/lib/query";
import { requireUser } from "@/lib/ctx";
import { convert } from "@/lib/ctx";
import { all } from "@/lib/db";
import { can } from "@/lib/auth";
import { Money, StatusBadge } from "@/components/kit";
import { Pager } from "@/components/pager";
import { EmptyState } from "@/components/kit";
import { fmtDate } from "@/lib/dates";
import { PayRowActions } from "./row-actions";
import Link from "next/link";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const dir = searchParams?.dir === "out" ? "out" : searchParams?.dir === "in" ? "in" : undefined;
  const d = listPayments(user.companyId, searchParams ?? {}, dir);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const totals = all<any>(
    `SELECT direction, COALESCE(SUM(amount),0) v FROM payments WHERE company_id=? AND date>=date('now','-30 days') GROUP BY direction`,
    user.companyId).reduce((m: any, r) => (m[r.direction] = r.v, m), { in: 0, out: 0 });
  const canCreate = can(user.role, "create", dir === "out" ? "purchases" : "sales");
  const tabs = [
    { href: "/app/sales/payments", label: "All", active: !dir },
    { href: "/app/sales/payments?dir=in", label: "Money in", active: dir === "in" },
    { href: "/app/sales/payments?dir=out", label: "Money out", active: dir === "out" },
  ];
  return (
    <>
      <PageHeader title="Payments" desc="Record what customers paid and what you paid suppliers — allocations update open documents automatically."
        tabs={tabs}
        actions={canCreate && <Link href={`/app/sales/payments/new${dir ? `?dir=${dir}` : ""}`} className="btn-primary btn-sm">Record payment</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 max-w-md">
        {([["in", "Received (30d)", "var(--pos)"], ["out", "Paid (30d)", "var(--neg)"]] as const).map(([k, label, color]) => (
          <div key={k} className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
            <div className="num mt-0.5 text-[17px] font-bold" style={{ color }}>{k === "in" ? "+" : "−"}<Money v={conv(totals[k] ?? 0)} currency={disp} /></div>
          </div>
        ))}
      </div>
      {d.count === 0 ? (
        <EmptyState title="No payments yet" desc="Record a payment against an open invoice or bill — the ledger entry posts the moment you save."
          action={canCreate ? { href: "/app/sales/payments/new", label: "Record a payment" } : undefined} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl w-full text-left text-[13px]">
            <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Number</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Party</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Method / reference</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Status</th>
              {can(user.role, "delete", "sales") && <th className="px-4 py-2.5" />}
            </tr></thead>
            <tbody>
              {d.rows.map((p: any) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="num whitespace-nowrap px-4 py-2.5">{fmtDate(p.date)}</td>
                  <td className="num px-4 py-2.5 font-semibold">{p.number}</td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{p.party_name ?? <span style={{ color: "var(--muted)" }}>on account</span>}</td>
                  <td className="hidden px-4 py-2.5 text-xs md:table-cell" style={{ color: "var(--muted)" }}>
                    <span className="capitalize">{p.method}</span>{p.reference ? ` · ${p.reference}` : ""}
                  </td>
                  <td className="num whitespace-nowrap px-4 py-2.5 text-right font-semibold" style={{ color: p.direction === "in" ? "var(--pos)" : "var(--text)" }}>
                    {p.direction === "in" ? "+" : "−"}<Money v={conv(p.amount)} currency={disp} />
                    {p.currency !== user.company.base_currency && p.amount_foreign ? <span className="ml-1 text-[10.5px] font-normal" style={{ color: "var(--muted)" }}>({(p.amount_foreign / 100).toLocaleString("en-US")} {p.currency})</span> : null}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-2 py-2.5 text-right">
                    {can(user.role, "delete", "sales") && <PayRowActions id={p.id} number={p.number} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={d.page} pages={d.pages} hrefFor={(pp) => `/app/sales/payments?${new URLSearchParams({ ...(searchParams ?? {}), page: String(pp) })}`} />
        </div>
      )}
    </>
  );
}
