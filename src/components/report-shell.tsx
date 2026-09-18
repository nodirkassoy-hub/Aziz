import { PeriodControls, PrintBtn } from "./report-controls";
import Link from "next/link";

export function ReportShell({ title, desc, from, to, exportHref, extra, children, note }: {
  title: string; desc?: string; from?: string | null; to?: string; exportHref?: string; extra?: React.ReactNode; children: React.ReactNode; note?: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {desc && <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>{desc}</p>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {from !== undefined && <PeriodControls from={from} to={to} />}
          {extra}
          {exportHref && <a className="btn-outline btn-sm no-underline" href={exportHref}>CSV</a>}
          <PrintBtn />
        </div>
      </div>
      <div className="print-area">
        <div className="mb-3 hidden items-baseline gap-2 print:flex">
          <span className="text-lg font-bold">{title}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{from ? `${from} → ${to}` : `as of ${to}`} · Mizom · printed {new Date().toISOString().slice(0, 10)}</span>
        </div>
        {children}
        {note && <p className="mt-4 text-[11.5px] print:text-[10px]" style={{ color: "var(--muted)" }}>{note}</p>}
      </div>
    </>
  );
}

export function Rpt({ label, value, color, bold }: { label: React.ReactNode; value: React.ReactNode; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px]" style={{ color: bold ? "var(--text)" : "var(--muted)", fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span className={`num ${bold ? "text-[15px] font-bold" : "text-[13px] font-semibold"}`} style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
