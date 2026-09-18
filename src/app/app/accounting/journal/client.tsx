"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Undo2 } from "lucide-react";
import { Modal, Money, StatusBadge } from "@/components/kit";
import { usePost, Submit } from "@/components/forms";
import { useUI } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import Link from "next/link";

export function JournalClient({ rows, base, disp, docLinks, canPost }: any) {
  const [sel, setSel] = useState<any>(null);
  return (
    <>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="tbl w-full text-left text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Entry</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Accounts</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Source</th>
            <th className="px-4 py-2.5 font-medium">Status</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="cursor-pointer border-t hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--line)" }} onClick={() => setSel(r)}>
                <td className="num whitespace-nowrap px-4 py-2">{fmtDate(r.date)}</td>
                <td className="px-4 py-2"><span className="num font-semibold">{r.entry_no || `#${r.id}`}</span>
                  <span className="block max-w-[240px] truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{r.description}</span></td>
                <td className="hidden max-w-[260px] px-4 py-2 text-[11.5px] md:table-cell" style={{ color: "var(--muted)" }}>
                  <span className="block truncate">{r.lines.map((l: any) => `${l.debit ? "Dr" : "Cr"} ${l.code}`).join(" · ")}</span></td>
                <td className="num whitespace-nowrap px-4 py-2 text-right font-semibold"><Money v={r.total_conv} currency={disp} /></td>
                <td className="hidden px-4 py-2 text-xs lg:table-cell" style={{ color: "var(--muted)" }}>
                  {r.source_kind === "manual" ? "manual" : docLinks[r.source_kind]
                    ? <Link href={`${docLinks[r.source_kind]}/${r.source_id}`} onClick={(e) => e.stopPropagation()} className="link !text-xs inline-flex items-center gap-1"><Link2 size={11} />{r.source_kind.replace("_", " ")}</Link>
                    : r.source_kind.replace("_", " ")}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={<span className="num">{sel?.entry_no || `#${sel?.id}`}</span>} wide>
        {sel && <JeDetail je={sel} base={base} canPost={canPost} onClose={() => setSel(null)} />}
      </Modal>
    </>
  );
}

function JeDetail({ je, base, canPost, onClose }: any) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const manual = je.source_kind === "manual";
  const runAct = async (action: string) => {
    const d = await post("/api/journal", { action, id: je.id });
    if (d?.message) { ui.toast("success", d.message); onClose(); router.refresh(); }
  };
  const totalD = je.lines.reduce((s: number, l: any) => s + l.debit, 0);
  const totalC = je.lines.reduce((s: number, l: any) => s + l.credit, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
        <span className="num">{fmtDate(je.date)}</span>{je.ref && <span>· ref {je.ref}</span>}
        <span>· {je.source_kind.replace("_", " ")}{je.created_by_name ? ` · ${je.created_by_name}` : ""}</span>
        <StatusBadge status={je.status} />
        {je.reversed_by && <span className="chip chip-warn">reversed by #{je.reversed_by}</span>}
      </div>
      <p className="mb-3 text-[13.5px] font-medium">{je.description}</p>
      <table className="tbl w-full text-left text-[12.5px]">
        <thead><tr className="text-[11px] uppercase" style={{ color: "var(--muted)" }}><th className="py-1.5 font-medium">Account</th><th className="py-1.5 font-medium">Memo</th><th className="py-1.5 text-right font-medium">Debit</th><th className="py-1.5 text-right font-medium">Credit</th></tr></thead>
        <tbody>
          {je.lines.map((l: any) => (
            <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="num py-1.5 pr-2"><span className="font-semibold">{l.code}</span> <span style={{ color: "var(--muted)" }}>{l.account}</span></td>
              <td className="py-1.5 pr-2 text-xs" style={{ color: "var(--muted)" }}>{l.memo ?? ""}</td>
              <td className="num py-1.5 text-right">{l.debit ? <Money v={l.debit} currency={base} /> : ""}</td>
              <td className="num py-1.5 text-right">{l.credit ? <Money v={l.credit} currency={base} /> : ""}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-bold" style={{ borderColor: "var(--line)" }}>
            <td className="py-2" colSpan={2}>Totals {totalD === totalC ? <span className="chip chip-good ml-1 !py-0">balanced ✓</span> : <span className="chip chip-bad ml-1 !py-0">unbalanced!</span>}</td>
            <td className="num py-2 text-right"><Money v={totalD} currency={base} /></td>
            <td className="num py-2 text-right"><Money v={totalC} currency={base} /></td>
          </tr>
        </tbody>
      </table>
      {(canPost && (manual || je.source_kind === "reconcile")) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {je.status === "draft" && <Submit busy={busy} onClick={() => runAct("post")}>Post</Submit>}
          {je.status === "posted" && <button className="btn-outline btn-sm inline-flex items-center gap-1.5" onClick={() => confirm("Return this entry to draft? The trial balance changes immediately.") && runAct("unpost")}><Undo2 size={13} /> Unpost</button>}
          {je.status === "posted" && <Submit busy={busy} onClick={() => confirm("Post a reversing entry (original stays for audit)?") && runAct("reverse")}>Reverse</Submit>}
          {je.status === "draft" && manual && <button className="btn-ghost btn-sm" style={{ color: "var(--neg)" }} onClick={() => confirm("Delete this draft entry permanently?") && runAct("delete")}>Delete draft</button>}
          <div className="min-w-0 flex-1"><FormError /></div>
        </div>
      )}
      {je.source_kind !== "manual" && <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>Generated from a {je.source_kind.replace("_", " ")} — cancel or edit that document to change the ledger. Its reversing entry is created automatically on cancellation.</p>}
    </div>
  );
}
