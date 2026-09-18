"use client";
/** Shared building blocks: modal/drawer, table (desktop) + cards (mobile), states. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ArrowUpDown, Inbox, Sparkles } from "lucide-react";
import { fmtMoney as _fmtMoney } from "@/lib/money";

/* ---------- overlays ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose} />
      <div ref={ref} className={`relative w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl card-solid shadow-glass-lg animate-scale-in`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-5 py-4 card-solid" style={{ borderColor: "var(--line)", borderRadius: "inherit", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <h3 className="font-semibold text-[15px] leading-tight">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] animate-fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] max-w-full card-solid shadow-glass-lg animate-[fadeUp_.3s_ease] flex flex-col rounded-l-none sm:rounded-l-3xl">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--line)" }}>
          <h3 className="font-semibold">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t p-4 shrink-0 flex gap-2 justify-end" style={{ borderColor: "var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- states ---------- */
export function EmptyState({ icon, title, desc, action, hint }: { icon?: React.ReactNode; title: string; desc?: string; action?: { href?: string; label: string; onClick?: () => void }; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        {icon ?? <Inbox size={26} />}
      </div>
      <h3 className="font-semibold">{title}</h3>
      {desc && <p className="mt-1.5 max-w-sm text-sm" style={{ color: "var(--muted)" }}>{desc}</p>}
      {action && (
        <div className="mt-5">
          {action.href
            ? <Link className="btn-primary" href={action.href}>{action.label}</Link>
            : <button className="btn-primary" onClick={action.onClick}>{action.label}</button>}
        </div>
      )}
      {hint && <p className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: "var(--faint)" }}><Sparkles size={12} /> {hint}</p>}
    </div>
  );
}
export function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="sk h-9 w-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2"><div className="sk h-3 w-1/3" /><div className="sk h-3 w-2/3" /></div>
          <div className="sk h-6 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`sk ${className}`} style={{ opacity: 0.7 }} />;
}

/* ---------- data table ---------- */
export type Col<T> = { key: string; label: string; className?: string; num?: boolean; sortable?: boolean; hideBelow?: "sm" | "md" | "lg"; render: (row: T) => React.ReactNode };
export function DataTable<T extends { id: number | string }>({ cols, rows, onRowClick, footer, sort, onSort, dense, card }: {
  cols: Col<T>[]; rows: T[]; onRowClick?: (row: T) => void; footer?: React.ReactNode;
  sort?: { key: string; dir: "asc" | "desc" } | null; onSort?: (key: string) => void; dense?: boolean;
  card?: (row: T) => React.ReactNode; // mobile presentation
}) {
  const [view, setView] = useState<"auto" | "table" | "cards">(
    typeof localStorage !== "undefined" ? ((localStorage.getItem("mizom_table_view") as any) ?? "auto") : "auto");
  const [mobileCard, setMobileCard] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const upd = () => setMobileCard(mq.matches);
    upd(); mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);
  const useCards = view === "auto" ? mobileCard : view === "cards";
  const renderCard = card ?? ((row: T) => (
    <div className="card-solid rounded-2xl p-4 space-y-2.5">
      {cols.map(c => (
        <div key={c.key} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-xs shrink-0" style={{ color: "var(--faint)" }}>{c.label}</span>
          <span className={`text-right min-w-0 ${c.num ? "num font-semibold" : "truncate"}`}>{c.render(row)}</span>
        </div>
      ))}
    </div>
  ));
  return (
    <div>
      {rows.length === 0 ? null : (
        <>
          {/* view toggle (mobile & sm) */}
          <div className="md:hidden flex justify-end px-1 pb-2">
            <button className="chip" onClick={() => { const n = useCards ? "table" : "cards"; setView(n); try { localStorage.setItem("mizom_table_view", n); } catch { } }}>
              {useCards ? "Show as table" : "Show as cards"}
            </button>
          </div>
          {useCards ? (
            <div className="space-y-3">{rows.map(r => <div key={r.id} onClick={() => onRowClick?.(r)} className={onRowClick ? "cursor-pointer" : ""}>{renderCard(r)}</div>)}</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--line)" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {cols.map(c => (
                      <th key={c.key} className={`${c.className ?? ""} ${c.num ? "text-right" : ""} ${c.hideBelow === "sm" ? "hidden sm:table-cell" : c.hideBelow === "md" ? "hidden md:table-cell" : c.hideBelow === "lg" ? "hidden lg:table-cell" : ""}`}>
                        {c.sortable !== false && onSort ? (
                          <button className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => onSort(c.key)}>
                            {c.label} <ArrowUpDown size={11} className={sort?.key === c.key ? "opacity-90" : "opacity-40"} />
                          </button>
                        ) : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={dense ? "[&_td]:py-2" : ""}>
                  {rows.map(r => (
                    <tr key={r.id} className={onRowClick ? "clickable" : ""} onClick={() => onRowClick?.(r)}>
                      {cols.map(c => <td key={c.key} className={`${c.className ?? ""} ${c.num ? "text-right" : ""} ${c.hideBelow === "sm" ? "hidden sm:table-cell" : c.hideBelow === "md" ? "hidden md:table-cell" : c.hideBelow === "lg" ? "hidden lg:table-cell" : ""}`}>{c.render(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
                {footer && <tfoot>{footer}</tfoot>}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <span className="text-xs" style={{ color: "var(--faint)" }}>Page {page} of {pages}</span>
      <div className="flex gap-1.5">
        <Link aria-label="Previous page" className={`btn-outline btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={hrefFor(page - 1)}><ChevronLeft size={14} /></Link>
        <Link aria-label="Next page" className={`btn-outline btn-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={hrefFor(page + 1)}><ChevronRight size={14} /></Link>
      </div>
    </div>
  );
}

/* ---------- small bits ---------- */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ["Draft", ""], sent: ["Sent", "chip-info"], open: ["Open", "chip-info"], partial: ["Partially paid", "chip-warn"],
    paid: ["Paid", "chip-good"], overdue: ["Overdue", "chip-bad"], cancelled: ["Cancelled", "chip-bad"],
    accepted: ["Accepted", "chip-good"], declined: ["Declined", "chip-bad"], converted: ["Converted", "chip-info"],
    posted: ["Posted", "chip-good"], pending_approval: ["Awaiting approval", "chip-warn"], approved: ["Approved", "chip-good"],
    rejected: ["Rejected", "chip-bad"], matched: ["Matched", "chip-good"], unmatched: ["Unmatched", "chip-warn"],
    review: ["Needs review", "chip-warn"], ignored: ["Ignored", ""], created: ["Created", "chip-info"],
    reconciled: ["Reconciled", "chip-good"], locked: ["Locked", "chip-bad"], closed: ["Closed", "chip-info"], recorded: ["Recorded", "chip-good"],
  };
  const [label, cls] = map[status] ?? [status.replace(/_/g, " "), ""];
  return <span className={`chip ${cls}`}>{label}</span>;
}
export function Money({ v, currency = "UZS", signed = false, className = "", compact = false }: { v: number | null | undefined; currency?: string; signed?: boolean; className?: string; compact?: boolean }) {
  const neg = (v ?? 0) < 0;
  return <span className={`num ${className}`} style={neg ? { color: "var(--neg)" } : signed && (v ?? 0) > 0 ? { color: "var(--pos)" } : undefined}>
    {_fmtMoney(v ?? 0, currency, { signed, compact })}
  </span>;
}
export function Delta({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null || !isFinite(pct)) return <span className="chip">new</span>;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`chip ${good ? "chip-good" : "chip-bad"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct * 100).toFixed(1)}%
    </span>
  );
}
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl p-1 glass-2" style={{ border: "1px solid var(--line)" }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`rounded-[9px] px-3 py-1.5 text-xs font-medium transition-all ${value === o.v ? "card-solid shadow-sm" : "opacity-70 hover:opacity-100"}`}
          style={value === o.v ? { color: "var(--accent)" } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
