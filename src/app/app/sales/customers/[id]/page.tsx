import { requireUser, convert, listCurrencies } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { partyBalances, partyStatement } from "@/lib/reports";
import { openDocs } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Money, StatusBadge, EmptyState } from "@/components/kit";
import { PartyActions } from "@/components/parties";
import { fmtDate } from "@/lib/dates";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: any) {
  const user = requireUser();
  const p = get<any>(`SELECT * FROM customers WHERE id=? AND company_id=?`, +params.id, user.companyId) ?? notFound();
  const bal = partyBalances(user.companyId, "customer", p.id);
  const open = openDocs(user.companyId, "invoice", { partyId: p.id });
  const y = new Date().getFullYear();
  const st = partyStatement(user.companyId, "customer", p.id, `${y - 1}-01-01`, searchParams?.to ?? "2999-12-31");
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const overLimit = p.credit_limit > 0 && bal.outstanding > p.credit_limit;
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-2">{p.name}{p.archived === 1 && <span className="chip">archived</span>}{overLimit && <span className="chip chip-bad">over credit limit</span>}</span>}
        desc={[p.contact_person && `Contact: ${p.contact_person}`, p.phone, p.tax_id && `TIN ${p.tax_id}`].filter(Boolean).join(" · ") || "No contact details yet."}
        actions={<PartyActions party={p} partyType="customer" base={user.company.base_currency} currencies={listCurrencies(user.companyId)} />} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Outstanding", bal.outstanding, overLimit ? "var(--neg)" : bal.outstanding > 0 ? "var(--warn)" : "var(--pos)"],
          ["Lifetime billed", bal.billed, undefined],
          ["Collected", bal.paid, "var(--pos)"],
          ["Credit limit", p.credit_limit || 0, "var(--muted)" as any],
        ].map(([label, v, color]: any) => (
          <div key={label} className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
            <div className="num mt-0.5 text-[16px] font-bold" style={color ? { color } : undefined}><Money v={conv(v)} currency={disp} /></div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-3 text-[15px] font-semibold">Open documents <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>({open.length})</span></h3>
          {open.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>Nothing outstanding — this customer is settled up. 🎉</p> : (
            <table className="tbl w-full text-left text-[13px]">
              <tbody>
                {open.map((d: any) => (
                  <tr key={d.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="py-2 pr-2"><Link className="num font-semibold no-underline hover:underline" href={`/app/sales/invoices/${d.id}`}>{d.number}</Link>
                      <span className="block text-[11px]" style={{ color: d.status === "overdue" ? "var(--neg)" : "var(--muted)" }}>due {fmtDate(d.due_date)}{d.status === "overdue" ? " · overdue" : ""}</span></td>
                    <td className="py-2 text-right"><span className="num block font-semibold"><Money v={conv(d.total_base - d.paid)} currency={disp} /></span>
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>of <Money v={conv(d.total_base)} currency={disp} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Statement <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>last 2 years</span></h3>
            <a className="btn-outline btn-sm ml-auto no-underline" href={`/api/reports/export?kind=statement&party=${p.id}&party_type=customer`}>CSV</a>
          </div>
          {st.rows.length === 0 ? <EmptyState title="No activity yet" desc="Invoices, credit notes and payments will show here." /> : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="tbl w-full text-left text-[12.5px]">
                <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  <th className="py-1.5 pr-2 font-medium">Date</th><th className="py-1.5 pr-2 font-medium">Document</th><th className="py-1.5 text-right font-medium">Amount</th><th className="py-1.5 text-right font-medium">Balance</th></tr></thead>
                <tbody>
                  {st.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="num py-1.5 pr-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-1.5 pr-2">{r.kind === "payment" ? <span style={{ color: "var(--pos)" }}>Payment {r.number}</span>
                        : r.kind === "credit_note" ? <span style={{ color: "var(--neg)" }}>Credit note {r.number}</span> : <span className="num">{r.number}</span>}</td>
                      <td className="num py-1.5 text-right" style={{ color: r.signed < 0 ? "var(--pos)" : undefined }}>{r.signed < 0 ? "−" : ""}<Money v={conv(Math.abs(r.signed))} currency={disp} /></td>
                      <td className="num py-1.5 text-right font-semibold">{conv(r.balance) < 0 ? "−" : ""}<Money v={conv(Math.abs(r.balance))} currency={disp} /></td>
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
