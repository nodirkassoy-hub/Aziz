"use client";
/** Hand-built SVG charts — bespoke look, zero deps, crisp on mobile & retina. */
import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/money";

export function Sparkline({ data, width = 120, height = 36, color, area = true }: { data: number[]; width?: number; height?: number; color?: string; area?: boolean }) {
  const path = useMemo(() => {
    if (!data.length) return { line: "", fill: "" };
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const xs = (i: number) => (i / Math.max(1, data.length - 1)) * (width - 4) + 2;
    const ys = (v: number) => height - 3 - ((v - min) / span) * (height - 7);
    const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join("");
    return { line, fill: `${line}L${xs(data.length - 1)},${height}L${xs(0)},${height}Z` };
  }, [data, width, height]);
  const c = color ?? (data.length > 1 && data[data.length - 1] >= data[0] ? "var(--pos)" : "var(--neg)");
  return (
    <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden>
      {area && <path d={path.fill} fill={c} opacity={0.09} />}
      <path d={path.line} fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && <circle cx={((data.length - 1) / Math.max(1, data.length - 1)) * (width - 4) + 2} cy={height - 3 - ((data[data.length - 1] - Math.min(...data)) / ((Math.max(...data) - Math.min(...data)) || 1)) * (height - 7)} r={2.6} fill={c} />}
    </svg>
  );
}

type BarDatum = { label: string; a?: number | null; b?: number | null; aLabel?: string; bLabel?: string };
export function BarChart({ data, currency = "UZS", height = 190, stacked = false, aName = "Inflow", bName = "Outflow" }: {
  data: BarDatum[]; currency?: string; height?: number; stacked?: boolean; aName?: string; bName?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => Math.abs(d.a ?? 0) + Math.abs(d.b ?? 0)));
  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5 px-0.5">
          {data.map((d, i) => {
            const ah = Math.round((Math.abs(d.a ?? 0) / max) * (height - 26));
            const bh = Math.abs(d.a ?? 0) + Math.abs(d.b ?? 0) > 0 ? (stacked ? Math.round((Math.abs(d.b ?? 0) / max) * (height - 26)) : Math.round((Math.abs(d.b ?? 0) / max) * (height - 26))) : 0;
            return (
              <div key={i} className="relative flex-1 min-w-[6px] group flex flex-col justify-end items-center h-full"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
                {hover === i && (
                  <div className="absolute -top-1 z-20 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] card-solid shadow-glass">
                    <div className="font-semibold mb-0.5">{d.label}</div>
                    {d.a != null && <div className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[3px]" style={{ background: "var(--accent)" }} />{aName} <b className="num ml-1">{fmtMoney(d.a, currency, { compact: true })}</b></div>}
                    {d.b != null && <div className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[3px]" style={{ background: "rgba(214,69,80,.75)" }} />{bName} <b className="num ml-1">{fmtMoney(d.b, currency, { compact: true })}</b></div>}
                  </div>
                )}
                <div className="flex flex-col justify-end w-full max-w-[26px] gap-0.5">
                  <div className="w-full rounded-t-[5px] transition-all duration-300" style={{ height: Math.max(2, ah), background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent))", opacity: hover === null || hover === i ? 1 : 0.5 }} />
                  <div className="w-full rounded-b-[5px]" style={{ height: Math.max(0, bh), background: "rgba(214,69,80,.6)", opacity: hover === null || hover === i ? 1 : 0.45 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px] sm:gap-1.5 px-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 min-w-0 text-center text-[9.5px] sm:text-[10px] truncate" style={{ color: "var(--faint)" }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

export function LineArea({ series, labels, currency = "UZS", height = 210, color = "var(--accent)", showZeroLine = false }: {
  series: { name: string; values: number[]; color?: string; dashed?: boolean }[];
  labels: string[]; currency?: string; height?: number; color?: string; showZeroLine?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, PAD = 8;
  const all = series.flatMap(s => s.values);
  const min = Math.min(0, ...all), max = Math.max(1, ...all);
  const span = max - min || 1;
  const xs = (i: number, n: number) => (i / Math.max(1, n - 1)) * (W - PAD * 2) + PAD;
  const ys = (v: number) => H - 18 - ((v - min) / span) * (H - 30);
  return (
    <div className="relative" style={{ height: H + 22 }}>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-full" preserveAspectRatio="none"
        onMouseMove={(e) => { const r = (e.target as any).closest("svg").getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; const n = labels.length || 1; setHover(Math.round(((x - PAD) / (W - PAD * 2)) * (n - 1))); }}
        onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map(p => <line key={p} x1={0} x2={W} y1={H * p} y2={H * p} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {showZeroLine && min < 0 && <line x1={0} x2={W} y1={ys(0)} y2={ys(0)} stroke="var(--neg)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {series.map((s, si) => {
          const c = s.color ?? (si === 0 ? color : "rgba(214,69,80,.8)");
          const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i, s.values.length).toFixed(1)},${ys(v).toFixed(1)}`).join("");
          return (
            <g key={si}>
              {si === 0 && <path d={`${line}L${xs(s.values.length - 1, s.values.length)},${H - 16}L${xs(0, s.values.length)},${H - 16}Z`} fill={c} opacity={0.08} />}
              <path d={line} fill="none" stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinejoin="round" />
            </g>
          );
        })}
        {hover !== null && hover < (labels.length) && <line x1={xs(hover, labels.length)} x2={xs(hover, labels.length)} y1={0} y2={H - 14} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute inset-x-0 top-1 pointer-events-none">
        {hover !== null && series.map((s, si) => (
          <span key={si} className="mr-3 rounded-lg border px-2 py-0.5 text-[11px] card-solid num">{s.name}: <b>{fmtMoney(s.values[hover] ?? 0, currency, { compact: true })}</b></span>
        ))}
      </div>
      <div className="absolute bottom-0 inset-x-0 flex justify-between text-[10px]" style={{ color: "var(--faint)" }}>
        {labels.map((l, i) => (labels.length <= 12 || i % Math.ceil(labels.length / 8) === 0) ? <span key={i} className={i === 0 ? "text-left" : i === labels.length - 1 ? "text-right" : ""}>{l}</span> : null)}
      </div>
    </div>
  );
}

export function Donut({ slices, size = 150, currency = "UZS", centerLabel }: { slices: { label: string; value: number; color?: string }[]; size?: number; currency?: string; centerLabel?: string }) {
  const total = slices.reduce((s, x) => s + Math.abs(x.value), 0) || 1;
  const palette = ["#0f9d82", "#3c6df0", "#b45309", "#8b5cf6", "#d64550", "#0ea5e9", "#65a30d", "#f472b6", "#94a3b8", "#eab308"];
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
          {slices.map((s, i) => {
            const frac = Math.abs(s.value) / total;
            const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
            const off = -acc * C; acc += frac;
            return <circle key={i} cx="60" cy="60" r={R} fill="none" stroke={s.color ?? palette[i % palette.length]} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={off} strokeLinecap="butt" style={{ transition: "stroke-dasharray .5s ease" }} />;
          })}
        </svg>
        {centerLabel && <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{centerLabel}</span>
          <b className="num text-sm">{fmtMoney(total, currency, { compact: true, hideCode: true })}</b>
        </div>}
      </div>
      <div className="min-w-[120px] flex-1 space-y-1.5">
        {slices.slice(0, 6).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <i className="h-2.5 w-2.5 rounded-[4px] shrink-0" style={{ background: s.color ?? palette[i % palette.length] }} />
            <span className="truncate" style={{ color: "var(--muted)" }}>{s.label}</span>
            <b className="num ml-auto whitespace-nowrap">{fmtMoney(s.value, currency, { compact: true })}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Waterfall({ steps, currency = "UZS" }: { steps: { label: string; value: number; total?: boolean }[]; currency?: string }) {
  let acc = 0;
  const bars = steps.map(s => {
    const isTotal = !!s.total;
    const start = isTotal ? 0 : acc;
    acc = isTotal ? s.value : acc + s.value;
    return { ...s, start, end: acc, kind: isTotal ? "total" : s.value >= 0 ? "up" : "down" };
  });
  const max = Math.max(1, ...bars.map(b => Math.max(b.end, b.start)));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 170 }}>
        {bars.map((b, i) => {
          const h = Math.max(2, (Math.abs(b.end - b.start) / max) * 150);
          const off = (Math.min(b.end, b.start) / max) * 150;
          const color = b.kind === "total" ? "var(--accent)" : b.kind === "up" ? "#3c6df0" : "#d64550";
          return (
            <div key={i} className="relative flex-1 h-full flex flex-col justify-end group" title={`${b.label}: ${fmtMoney(b.value, currency)}`}>
              <div className="w-full rounded-md transition-all duration-300" style={{ height: h, marginBottom: off, background: color, opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {bars.map((b, i) => <div key={i} className="flex-1 text-center text-[9px] sm:text-[10px] leading-tight truncate" style={{ color: "var(--faint)" }}>{b.label}</div>)}
      </div>
    </div>
  );
}

/** Horizontal aging bars for AR/AP */
export function AgingBars({ buckets, currency = "UZS" }: { buckets: { label: string; total: number; count: number }[]; currency?: string }) {
  const max = Math.max(1, ...buckets.map(b => b.total));
  return (
    <div className="space-y-2.5">
      {buckets.map((b, i) => (
        <div key={i} className="grid grid-cols-[86px_1fr_auto] sm:grid-cols-[110px_1fr_auto] items-center gap-3">
          <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{b.label}</span>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${(b.total / max) * 100}%`,
              background: i === 0 ? "linear-gradient(90deg,#0f9d82,#40bd9e)" : i === 1 ? "linear-gradient(90deg,#3c6df0,#7c9bff)" : i >= 3 ? "linear-gradient(90deg,#d64550,#f47180)" : "linear-gradient(90deg,#b45309,#f0a43b)",
            }} />
          </div>
          <span className="num text-xs font-semibold whitespace-nowrap">{fmtMoney(b.total, currency, { compact: true })}<span className="ml-1 opacity-50">· {b.count}</span></span>
        </div>
      ))}
    </div>
  );
}
