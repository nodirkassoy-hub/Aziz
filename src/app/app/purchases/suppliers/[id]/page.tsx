import { requireUser, convert, listCurrencies } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { partyBalances, partyStatement, openDocs } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Money, EmptyState } from "@/components/kit";
import { PartyActions } from "@/components/parties";
import { fmtDate } from "@/lib/dates";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Supplier" };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: any) {
  const user = requireUser();
  const p = get<any>(`SELECT * FROM suppliers WHERE id=? AND company_id=?`, +params.id, user.companyId) ?? notFound();
  const bal = partyBalances(user.companyId, "supplier", p.id);
  const open = openDocs(user.companyId, "bill", { partyId: p.id });
  const exps = all<any>(`SELECT e.id, e.date, e.description, e.amount + e.tax AS total, e.status FROM expenses e WHERE e.company_id=? AND e.supplier_id=? ORDER BY e.date DESC LIMIT 8`, user.companyId, p.id);
  const y = new Date().getFullYear();
  const st = partyStatement(user.companyId, "supplier", p.id, `${y - 1}-01-01`, "2999-12-31");
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-2">{p.name}{p.archived === 1 && <span className="chip">archived</span>}</span>}
        desc={[p.contact_person && `Contact: ${p.contact_person}`, p.phone, p.tax_id && `TIN ${p.tax_id}`, p.payment_terms_days != null ? `terms ${p.payment_terms_days}d` : null].filter(Boolean).join(" · ") || "No contact details yet."}
        actions={<PartyActions party={p} partyType="supplier" base={user.company.base_currency} currencies={listCurrencies(user.companyId)} />} />
      <div className="mb-4 grid grid-cols-3 gap-3 max-w-2xl">
        {[["We owe", bal.outstanding, bal.outstanding > 0 ? "var(--warn)" : "var(--pos)"], ["Billed by them", bal.billed, undefined], ["Paid", bal.paid, "var(--pos)"]].map(([label, v, color]: any) => (
          <div key={label} className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
            <div className="num mt-0.5 text-[16px] font-bold" style={color ? { color } : undefined}><Money v={conv(v)} currency={disp} /></div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-3 text-[15px] font-semibold">Open bills <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>({open.length})</span></h3>
          {open.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>Nothing outstanding with this supplier.</p> : (
            <table className="tbl w-full text-left text-[13px]"><tbody>
              {open.map((d: any) => (
                <tr key={d.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-2 pr-2"><Link className="num font-semibold no-underline hover:underline" href={`/app/purchases/bills/${d.id}`}>{d.number}</Link>
                    <span className="block text-[11px]" style={{ color: d.status === "overdue" ? "var(--neg)" : "var(--muted)" }}>due {fmtDate(d.due_date)}</span></td>
                  <td className="py-2 text-right num font-semibold"><Money v={conv(d.total_base - d.paid)} currency={disp} /></td>
                </tr>
              ))}
            </tbody></table>
          )}
          {exps.length > 0 && (<><h3 className="mb-2 mt-5 text-[15px] font-semibold">Recent expenses via them</h3>
            {exps.map((e: any) => (<div key={e.id} className="flex items-center gap-2 border-t py-1.5 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
              <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{fmtDate(e.date)}</span><span className="truncate">{e.description ?? "expense"}</span>
              <span className="num ml-auto font-semibold"><Money v={conv(e.total)} currency={disp} /></span></div>))}</>)}
        </section>
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Statement <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>last 2 years</span></h3>
            <a className="btn-outline btn-sm ml-auto no-underline" href={`/api/reports/export?kind=statement&party=${p.id}&party_type=supplier`}>CSV</a>
          </div>
          {st.rows.length === 0 ? <EmptyState title="No activity yet" desc="Bills and payments to this supplier will show here." /> : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="tbl w-full text-left text-[12.5px]">
                <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  <th className="py-1.5 pr-2 font-medium">Date</th><th className="py-1.5 pr-2 font-medium">Document</th><th className="py-1.5 text-right font-medium">Amount</th><th className="py-1.5 text-right font-medium">Balance</th></tr></thead>
                <tbody>
                  {st.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="num py-1.5 pr-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-1.5 pr-2">{r.kind === "payment" ? <span style={{ color: "var(--neg)" }}>Payment {r.number}</span> : <span className="num">{r.number}</span>}</td>
                      <td className="num py-1.5 text-right" style={{ color: r.signed < 0 ? "var(--neg)" : undefined }}>{r.signed < 0 ? "−" : ""}<Money v={conv(Math.abs(r.signed))} currency={disp} /></td>
                      <td className="num py-1.5 text-right font-semibold"><Money v={conv(Math.abs(r.balance))} currency={disp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
