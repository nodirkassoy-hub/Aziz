"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartyFormModal } from "@/components/parties";
import { TextInput } from "@/components/forms";
import { EmptyState, Money } from "@/components/kit";
import { fmtDate } from "@/lib/dates";
import Link from "next/link";

export function SuppliersClient({ rows, disp, canCreate, totalOpen, showNew, currencies }: any) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(showNew);
  const filtered = q ? rows.filter((r: any) => (r.name + (r.tax_id ?? "") + (r.phone ?? "")).toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Total outstanding</div>
          <div className="num text-[17px] font-bold" style={{ color: "var(--warn)" }}><Money v={totalOpen} currency={disp} /></div>
        </div>
        <TextInput className="!w-64" placeholder="Search name, TIN, phone…" value={q} onChange={(e: any) => setQ(e.target.value)} />
        {canCreate && <button className="btn-primary btn-sm ml-auto" onClick={() => setNewOpen(true)}>+ New supplier</button>}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={rows.length ? "No match" : "No suppliers yet"} desc={rows.length ? "Try a different search." : "Add your first supplier — bills, AP and statements follow from there."}
          action={canCreate && !rows.length ? { label: "Add supplier", onClick: () => setNewOpen(true) } : undefined} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl w-full text-left text-[13px]">
            <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Contact</th>
              <th className="px-4 py-2.5 text-right font-medium">Open balance</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Lifetime billed</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last activity</th>
            </tr></thead>
            <tbody>
              {filtered.map((r: any) => {
                const open = Math.max(0, r.billed - r.collected);
                return (
                  <tr key={r.id} className="cursor-pointer border-t hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--line)" }} onClick={() => router.push(`/app/purchases/suppliers/${r.id}`)}>
                    <td className="px-4 py-2.5"><span className="font-semibold">{r.name}</span>
                      {r.open_docs > 0 && <span className="chip chip-warn ml-2 !py-0 text-[10.5px]">{r.open_docs} open</span>}
                      {r.archived ? <span className="chip ml-2 !py-0 text-[10.5px]">archived</span> : null}</td>
                    <td className="hidden px-4 py-2.5 text-xs md:table-cell" style={{ color: "var(--muted)" }}>{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="num px-4 py-2.5 text-right font-semibold" style={open > 0 ? { color: "var(--warn)" } : undefined}><Money v={r.open_conv} currency={disp} /></td>
                    <td className="num hidden px-4 py-2.5 text-right sm:table-cell"><Money v={r.billed_conv} currency={disp} /></td>
                    <td className="num hidden px-4 py-2.5 text-xs lg:table-cell" style={{ color: "var(--muted)" }}>{r.last_activity ? fmtDate(r.last_activity) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PartyFormModal open={newOpen} onClose={() => { setNewOpen(false); if (typeof window !== "undefined" && location.search.includes("new=1")) router.replace("/app/sales/customers"); }} partyType="supplier" currencies={currencies} />
    </>
  );
}
