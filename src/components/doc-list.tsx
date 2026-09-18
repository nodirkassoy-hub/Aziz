"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, Filter, X, Download } from "lucide-react";
import { DataTable, StatusBadge, type Col } from "@/components/kit";
import { fmtMoney } from "@/lib/money";
import { fmtDate, today } from "@/lib/dates";

export type DocRow = {
  id: number; kind: string; number: string; status: string; date: string; due_date: string | null;
  party_name: string | null; currency: string; fx_rate: number;
  total: number; total_base: number; paid: number;
};

export function DocListView({ rows, kind, hrefBase, base, disp, totals, canCreate, createHref }: {
  rows: DocRow[]; kind: string; hrefBase: string; base: string; disp: string;
  totals?: { issued: number; outstanding: number; overdue: number };
  canCreate: boolean; createHref: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const from = sp.get("from") ?? "", to = sp.get("to") ?? "";
  const [qDraft, setQDraft] = useState(q);

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v); else next.delete(k);
    next.delete("page");
    router.push(`${hrefBase}?${next.toString()}`);
  }
  const active = [status, from, to].filter(Boolean).length + (q ? 1 : 0);

  const cols: Col<DocRow>[] = useMemo(() => [
    { key: "number", label: "Document", render: r => (
      <div className="min-w-0">
        <span className="font-semibold text-[13.5px] num block truncate">{r.number}</span>
        <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>{r.party_name ?? "—"}</span>
      </div>) },
    { key: "date", label: "Issued", hideBelow: "sm", render: r => <span className="text-xs num whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: "due", label: "Due", hideBelow: "md", render: r => {
      const late = r.due_date && r.due_date < today() && r.paid < r.total_base && (r.status === "sent" || r.status === "partial");
      return <span className={`text-xs num whitespace-nowrap ${late ? "font-semibold" : ""}`} style={late ? { color: "var(--neg)" } : undefined}>{fmtDate(r.due_date)}</span>;
    } },
    { key: "status", label: "Status", render: r => <StatusBadge status={r.status} /> },
    { key: "total", label: "Total", num: true, render: r => <span className="num text-[13px] font-semibold whitespace-nowrap">{fmtMoney(r.total, r.currency)}</span> },
    { key: "outstanding", label: "Outstanding", num: true, hideBelow: "sm", render: r => {
      const out = r.total_base - r.paid;
      return r.paid >= r.total_base || r.kind === "quote" || r.kind === "sales_order" || r.kind === "purchase_order" ? <span style={{ color: "var(--faint)" }}>—</span> :
        <span className="num text-[13px] whitespace-nowrap" style={{ color: out > 0 && r.due_date && r.due_date < today() ? "var(--neg)" : undefined }}>{fmtMoney(out, base)}</span>;
    } },
  ], [base, disp]);

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <form className="relative flex-1 min-w-[170px]" onSubmit={(e) => { e.preventDefault(); setParam("q", qDraft.trim()); }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input className="input !pl-9" placeholder={`Search ${kind}s, numbers, parties…`} value={qDraft} onChange={e => setQDraft(e.target.value)} />
        </form>
        <button className={`btn-outline !py-2.5 ${active ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`} onClick={() => setFiltersOpen(o => !o)}>
          <Filter size={14} /> Filters{active ? ` (${active})` : ""}
        </button>
        <a className="btn-outline !py-2.5" href={`/api/reports/export?kind=${kind === "invoice" ? "overdue" : "ar"}&from=${sp.get("from") ?? ""}&to=${sp.get("to") ?? ""}`} title="Export CSV"><Download size={14} /></a>
        {canCreate && <Link href={createHref} className="btn-primary">＋ New</Link>}
      </div>
      {(filtersOpen || active > 0) && (
        <div className="card p-3.5 mb-3 animate-fade-up">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input !w-auto" value={status} onChange={e => setParam("status", e.target.value)}>
                <option value="">All</option>
                {["draft", "sent", "partial", "paid", "overdue", "cancelled", "accepted", "open"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><label className="label">From</label><input type="date" className="input !w-auto" value={from} onChange={e => setParam("from", e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input !w-auto" value={to} onChange={e => setParam("to", e.target.value)} /></div>
            {active > 0 && <button className="btn-ghost mb-0.5 text-xs" onClick={() => { setQDraft(""); router.push(hrefBase); }}><X size={13} /> Clear all</button>}
          </div>
        </div>
      )}
      {totals && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <TotalBox label="Issued (filtered)" value={fmtMoney(totals.issued, disp, { compact: true })} />
          <TotalBox label="Outstanding" value={fmtMoney(totals.outstanding, disp, { compact: true })} warn={totals.outstanding > 0} />
          <TotalBox label="Overdue" value={fmtMoney(totals.overdue, disp, { compact: true })} bad={totals.overdue > 0} />
        </div>
      )}
      <DataTable cols={cols} rows={rows} onRowClick={(r) => router.push(`${hrefBase}/${r.id}`)} />
    </div>
  );
}
function TotalBox({ label, value, warn, bad }: any) {
  return (
    <div className="card rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--faint)" }}>{label}</div>
      <b className="num text-[15px] sm:text-lg" style={{ color: bad ? "var(--neg)" : warn ? "var(--warn)" : undefined }}>{value}</b>
    </div>
  );
}
