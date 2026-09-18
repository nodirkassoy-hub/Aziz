"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Settings2, ArrowUpRight, ChevronUp, ChevronDown, X, Sparkles, Activity } from "lucide-react";
import { Sparkline, BarChart, LineArea, Donut } from "@/components/charts";
import { Modal, EmptyState } from "@/components/kit";
import { api, useUI } from "@/components/ui";
import { fmtMoney } from "@/lib/money";

const WIDGETS = [
  { key: "cashflow", label: "Cash flow" },
  { key: "health", label: "Financial health" },
  { key: "expenses", label: "Expense mix" },
  { key: "forecast", label: "30-day outlook" },
  { key: "insights", label: "AI insights" },
  { key: "overdue", label: "Overdue invoices" },
  { key: "due", label: "Upcoming bills" },
  { key: "recent", label: "Recent transactions" },
];

export function Dashboard({ cards, health, insights, overdue, dueBills, recent, cashflow, expenseMix, forecast, widgetPrefs, demo, base, disp }: any) {
  const [prefs, setPrefs] = useState<any[]>(widgetPrefs ?? WIDGETS.map(w => ({ key: w.key, on: true })));
  const [editMode, setEditMode] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useUI();

  const order = useMemo(() => {
    const byKey = new Map(prefs.map((w: any, i: number) => [w.key, w]));
    return WIDGETS.map(w => byKey.get(w.key) ?? { key: w.key, on: true }).filter((w: any) => w.on);
  }, [prefs]);

  function save(next: any[]) {
    setPrefs(next);
    setSaving(true);
    api("/api/widgets", { body: { action: "save", widgets: next } }).then(r => { setSaving(false); if (r.ok) toast("success", "Dashboard layout saved."); else toast("error", r.error ?? "Could not save"); });
  }
  function move(key: string, dir: -1 | 1) {
    const full = WIDGETS.map(w => (prefs.find((p: any) => p.key === w.key) ?? { key: w.key, on: true }));
    const vis = full.filter(w => w.on);
    const i = vis.findIndex(w => w.key === key);
    if (i < 0) return;
    const j = i + dir; if (j < 0 || j >= vis.length) return;
    [vis[i], vis[j]] = [vis[j], vis[i]];
    const hidden = full.filter(w => !w.on);
    save([...vis, ...hidden]);
  }

  const body: Record<string, React.ReactNode> = {
    cashflow: (
      <Panel title="Cash flow" sub="Posted money in vs out by month" href="/app/finance/cash-flow">
        <LineArea currency={disp} labels={cashflow.labels} series={[
          { name: "In", values: cashflow.inflow, color: "var(--accent)" },
          { name: "Out", values: cashflow.outflow, color: "rgba(214,69,80,.85)" },
        ]} height={210} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label="Total in" value={fmtMoney(sum(cashflow.inflow), disp, { compact: true })} cls="chip-good" />
          <Mini label="Total out" value={fmtMoney(sum(cashflow.outflow), disp, { compact: true })} cls="chip-bad" />
          <Mini label="Net" value={fmtMoney(sum(cashflow.inflow) - sum(cashflow.outflow), disp, { compact: true })} cls="chip" />
        </div>
      </Panel>
    ),
    health: (
      <Panel title="Financial health" sub="Transparent, ledger-derived metrics" href="/app/finance/cash-flow">
        <button onClick={() => setHealthOpen(true)} className="w-full rounded-xl p-3.5 text-left transition-colors hover:bg-[var(--accent-soft)]">
          <div className="flex items-center gap-4">
            <HealthRing score={health.score} />
            <div className="min-w-0 flex-1">
              <div className="text-xs mb-1" style={{ color: "var(--faint)" }}>Click to see exactly how this is calculated</div>
              <div className="flex flex-wrap gap-1.5">
                {health.metrics.slice(0, 4).map((m: any) => (
                  <span key={m.key} className={`chip ${m.status === "good" ? "chip-good" : m.status === "watch" ? "chip-warn" : m.status === "risk" ? "chip-bad" : ""}`}>{m.label}: {m.display}</span>
                ))}
              </div>
            </div>
          </div>
        </button>
        {health.metrics.length > 4 && <button className="btn-ghost w-full text-xs mt-1" onClick={() => setHealthOpen(true)}>+ {health.metrics.length - 4} more metrics →</button>}
      </Panel>
    ),
    expenses: (
      <Panel title="Expense mix" sub={`${fmtMoney(sum(expenseMix.map((e: any) => e.value)), disp, { compact: true })} posted in period`} href="/app/reports/expenses">
        {expenseMix.length ? <Donut currency={disp} slices={expenseMix.map((e: any) => ({ label: e.label, value: e.value }))} centerLabel="total" /> : <EmptyState title="No expenses yet in this period" desc="Expenses you record will be split by category here." />}
      </Panel>
    ),
    forecast: (
      <Panel title="30-day outlook" sub="Projected closing balance — base scenario" href="/app/finance/cash-flow">
        <LineArea currency={disp} height={170} labels={forecast.rows.map((r: any) => r.date)} series={[{ name: "Projected balance", values: forecast.rows.map((r: any) => r.balance) }]} showZeroLine />
        <div className="grid grid-cols-3 gap-2 text-center mt-2">
          <Mini label="Expecting in" value={fmtMoney(forecast.totalIn, disp, { compact: true })} cls="chip-good" />
          <Mini label="Committed out" value={fmtMoney(forecast.totalOut, disp, { compact: true })} cls="chip-bad" />
          <Mini label="Lowest point" value={fmtMoney(forecast.min, disp, { compact: true })} cls={forecast.min < 0 ? "chip-bad" : "chip"} />
        </div>
      </Panel>
    ),
    insights: (
      <Panel title="AI insights" sub="Detected automatically from your books" href="/app/ai-cfo" accent>
        {insights.length ? (
          <div className="space-y-2.5">
            {insights.slice(0, 4).map((i: any) => (
              <Link key={i.id} href={i.action?.href ?? "/app/ai-cfo"} className="block rounded-xl border p-3 no-underline transition-colors hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--line)", color: "inherit" }}>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: i.severity === "danger" ? "var(--neg)" : i.severity === "warn" ? "var(--warn)" : i.severity === "success" ? "var(--pos)" : "var(--accent)" }} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug">{i.title}</div>
                    <div className="text-xs mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{i.reason}</div>
                    <div className="text-[10.5px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--faint)" }}>
                      <span>📊 {i.data}</span><span>🗓 {i.period}</span>{i.action && <span className="ml-auto" style={{ color: "var(--accent)" }}>{i.action.label} →</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Activity size={24} />} title="Everything looks steady" desc="No anomalies found this period — margins, overdue invoices and cash commitments are within thresholds." action={{ href: "/app/ai-cfo", label: "Ask the AI CFO a question" }} hint="Insights recompute on every page load from posted data." />
        )}
      </Panel>
    ),
    overdue: (
      <Panel title="Overdue invoices" sub={overdue.length ? `${overdue.length} past due` : "All caught up"} href="/app/sales/receivables">
        {overdue.length ? (
          <div className="space-y-1.5">
            {overdue.slice(0, 5).map((o: any) => (
              <Link key={o.id} href={`/app/sales/invoices/${o.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 no-underline hover:bg-[var(--accent-soft)]" style={{ color: "inherit" }}>
                <span className="chip chip-bad !text-[10px]">{o.days}d late</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{o.party}</span><span className="block text-[11px]" style={{ color: "var(--faint)" }}>{o.number} · due {o.due}</span></span>
                <b className="num text-sm whitespace-nowrap" style={{ color: "var(--neg)" }}>{fmtMoney(o.outstanding, disp, { compact: true })}</b>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No overdue invoices 🎉" desc="Every issued invoice is within its due date." />}
      </Panel>
    ),
    due: (
      <Panel title="Upcoming bills — 21 days" sub={dueBills.length ? `${dueBills.length} payments planned` : "Nothing scheduled"} href="/app/purchases/payables">
        {dueBills.length ? (
          <div className="space-y-1.5">
            {dueBills.slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                <span className="chip chip-warn !text-[10px]">{b.due.slice(5)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{b.party}</span><span className="block text-[11px]" style={{ color: "var(--faint)" }}>{b.number}</span></span>
                <b className="num text-sm whitespace-nowrap">{fmtMoney(b.amount, disp, { compact: true })}</b>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No bills due soon" desc="Supplier payment commitments for the next three weeks appear here." />}
      </Panel>
    ),
    recent: (
      <Panel title="Recent postings" sub="The last entries into the ledger" href="/app/accounting/journal">
        {recent.length ? (
          <div className="divide-line">
            {recent.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="chip !text-[9px] w-16 justify-center shrink-0">{(r.kind ?? "manual").slice(0, 8)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px]">{r.description}</span><span className="block text-[11px]" style={{ color: "var(--faint)" }}>{r.no} · {r.date}</span></span>
                <b className="num text-[13px] whitespace-nowrap" style={{ color: r.kind === "payment" || r.kind === "invoice" ? "var(--pos)" : undefined }}>{fmtMoney(r.amount, disp, { compact: true })}</b>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No recent activity" desc="Create an invoice or record an expense — postings appear here instantly." />}
      </Panel>
    ),
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {cards.map((c: any) => (
          <Link key={c.key} href={c.href} className="card group relative overflow-hidden rounded-2xl p-4 no-underline block animate-fade-up" style={{ color: "inherit" }}>
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full opacity-[.13] transition-transform group-hover:scale-125" style={{ background: `radial-gradient(circle, ${c.accent}, transparent 70%)` }} />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{c.label}</span>
              {demo && <span className="chip !text-[8px] ml-auto !py-0" title="Demo dataset — figures are generated but internally consistent">DEMO</span>}
            </div>
            <div className="mt-1.5 num text-[clamp(17px,2.4vw,22px)] font-bold leading-tight tracking-tight truncate" title={c.value}>{c.value}</div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.pct === null ? <span className="chip">{c.asOf ? "as of today" : "—"}</span> : (
                  <span className={`chip ${(c.pct >= 0) !== !!c.invert ? "chip-good" : "chip-bad"}`}>{c.pct >= 0 ? "▲" : "▼"} {Math.abs(c.pct * 100).toFixed(1)}%</span>
                )}
                <span className="text-[10px]" style={{ color: "var(--faint)" }}>vs prev · {c.prev}</span>
              </div>
              <Sparkline data={c.spark.length > 1 ? c.spark : [0, 0]} color={c.accent} width={92} height={34} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--muted)" }}>{c.hint}</span>
              <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* widget area */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Settings2 size={14} style={{ color: "var(--faint)" }} /> Dashboard widgets</h2>
        <button className={`btn-outline btn-sm ${editMode ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`} onClick={() => { setEditMode(m => !m); }}>{editMode ? "Done" : "Customize"}</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {order.map((w: any) => {
          const meta = WIDGETS.find(x => x.key === w.key)!;
          return (
            <div key={w.key} className="relative">
              {editMode && (
                <div className="absolute right-2 top-2 z-20 flex gap-1">
                  <button className="btn-icon !p-1.5 card-solid" onClick={() => move(w.key, -1)} aria-label="Move up"><ChevronUp size={14} /></button>
                  <button className="btn-icon !p-1.5 card-solid" onClick={() => move(w.key, 1)} aria-label="Move down"><ChevronDown size={14} /></button>
                  <button className="btn-icon !p-1.5 card-solid" onClick={() => save(prefs.map((p: any) => p.key === w.key ? { ...p, on: false } : p))} aria-label="Hide widget"><X size={14} /></button>
                </div>
              )}
              {body[w.key]}
            </div>
          );
        })}
      </div>
      {editMode && (
        <div className="card p-3 text-xs flex flex-wrap items-center gap-2" style={{ color: "var(--muted)" }}>
          Reorder or hide widgets — your layout is saved to your profile.
          <div className="flex gap-1.5 ml-auto flex-wrap">
            {WIDGETS.filter(w => !prefs.find((p: any) => p.key === w.key && p.on)).map(w => (
              <button key={w.key} className="chip" onClick={() => save([...prefs.filter(p => p.key !== w.key || p.on).map(p => p), { key: w.key, on: true }])}>+ {w.label}</button>
            ))}
            {saving && <span className="chip chip-info">saving…</span>}
          </div>
        </div>
      )}

      <Modal open={healthOpen} onClose={() => setHealthOpen(false)} title={<span className="flex items-center gap-2"><Activity size={16} style={{ color: "var(--accent)" }} /> How financial health is calculated</span>} wide>
        <div className="text-sm mb-4 rounded-xl p-3" style={{ background: "var(--accent-soft)", color: "var(--muted)" }}>
          No black box: overall index = each metric scores <b>1</b> (good) / <b>0.5</b> (watch) / <b>0</b> (risk); index = points ÷ evaluated metrics × 100.
          All inputs come from posted journal data.
        </div>
        <div className="space-y-2.5">
          {health.metrics.map((m: any) => (
            <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--line)" }}>
              <span className={`chip ${m.status === "good" ? "chip-good" : m.status === "watch" ? "chip-warn" : m.status === "risk" ? "chip-bad" : ""}`}>{m.status}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{m.label} <b className="num ml-2">{m.display}</b></div>
                <div className="text-[11px]" style={{ color: "var(--faint)" }}>formula: {m.formula}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          <b>Inputs (from ledger):</b> cash {fmtMoney(health.inputs.cash, base)} · avg monthly outflow {fmtMoney(Math.round(health.inputs.avgOut), base)} · revenue 6mo {fmtMoney(health.inputs.revenue, base)} · gross {fmtMoney(health.inputs.gross, base)} · net {fmtMoney(health.inputs.net, base)} · AR {fmtMoney(health.inputs.ar, base)} · AP {fmtMoney(health.inputs.ap, base)} · debt {fmtMoney(health.inputs.debt, base)} · overdue AR {fmtMoney(health.inputs.overdue, base)}
          <div className="mt-1.5 opacity-70">{health.formula}</div>
        </div>
      </Modal>
    </div>
  );
}

function Panel({ title, sub, children, href, accent }: any) {
  return (
    <section className="card p-4 sm:p-5 flex flex-col animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className={`font-semibold text-[14.5px] leading-tight flex items-center gap-1.5 ${accent ? "" : ""}`}>{accent && <Sparkles size={14} style={{ color: "var(--accent)" }} />}{title}</h3>
          {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--faint)" }}>{sub}</p>}
        </div>
        {href && <Link href={href} className="btn-ghost btn-sm shrink-0">Open <ArrowUpRight size={13} /></Link>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </section>
  );
}
function Mini({ label, value, cls }: any) {
  return (
    <div className="rounded-xl p-2" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--faint)" }}>{label}</div>
      <span className={`num font-bold text-[13px] ${cls}`}><span>{value}</span></span>
    </div>
  );
}
function HealthRing({ score }: { score: number }) {
  const R = 26, C = 2 * Math.PI * R;
  const color = score >= 75 ? "var(--pos)" : score >= 50 ? "var(--warn)" : "var(--neg)";
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`} style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="num text-[17px] leading-none">{score}</b>
        <span className="text-[8px] uppercase tracking-wider" style={{ color: "var(--faint)" }}>index</span>
      </div>
    </div>
  );
}
function sum(arr: number[]) { return arr.reduce((s, x) => s + (x || 0), 0); }
