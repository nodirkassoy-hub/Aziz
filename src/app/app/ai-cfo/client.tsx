"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "How is profit this month vs last?",
  "Which customers owe the most right now?",
  "Will cash cover the next 30 days?",
  "What are the top expense categories?",
  "Any overdue invoices I should chase?",
];

type Answer = any;

export function CfoChat() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ q: string; a?: Answer; err?: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setQ(""); setBusy(true);
    setThread(t => [...t, { q: question }]);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const d = await r.json();
      if (!r.ok) setThread(t => [...t.slice(0, -1), { q: question, err: d.error ?? "No answer." }]);
      else setThread(t => [...t.slice(0, -1), { q: question, a: d.answer }]);
    } catch (e: any) {
      setThread(t => [...t.slice(0, -1), { q: question, err: String(e?.message ?? e) }]);
    } finally { setBusy(false); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }
  }

  return (
    <div className="glass flex min-h-[480px] flex-col rounded-2xl">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" style={{ maxHeight: "60vh" }}>
        {thread.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles size={26} style={{ color: "var(--accent)" }} />
            <p className="max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>Ask about profit, receivables, cash runway, expenses — answers are computed live from your posted entries, with the method shown.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map(s => <button key={s} className="chip cursor-pointer" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px]" style={{ background: "var(--accent-soft)" }}>{m.q}</div>
            {m.err && <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px]" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>{m.err}</div>}
            {m.a && <AnswerBubble a={m.a} />}
          </div>
        ))}
        {busy && <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>computing from the ledger…</div>}
        <div ref={endRef} />
      </div>
      <form className="border-t p-3" style={{ borderColor: "var(--line)" }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Ask your numbers anything…" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} />
          <button className="btn-primary" disabled={busy || !q.trim()}>Ask</button>
        </div>
      </form>
    </div>
  );
}

function AnswerBubble({ a }: { a: Answer }) {
  return (
    <div className="max-w-[95%] rounded-2xl rounded-bl-md border p-3.5 text-[13px]" style={{ borderColor: "var(--line)" }}>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        <span>{a.period}</span>
        <span className={`chip !py-0 text-[10px] ${a.confidence === "exact" ? "chip-good" : "chip-info"}`}>{a.confidence}</span>
      </div>
      <p className="whitespace-pre-line leading-relaxed">{a.summary}</p>
      {a.facts?.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {a.facts.map((f: any, i: number) => (
            <div key={i} className="rounded-xl px-3 py-2" style={{ background: "var(--accent-soft)" }}>
              <div className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{f.label}</div>
              <div className="num text-[13.5px] font-bold">{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {a.table && (
        <div className="mt-2.5 overflow-x-auto">
          <table className="tbl w-full text-left text-[12px]">
            <thead><tr style={{ color: "var(--muted)" }}>{a.table.columns.map((c: string) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}</tr></thead>
            <tbody>{a.table.rows.slice(0, 12).map((row: (string | number)[], i: number) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>{row.map((cell, j) => <td key={j} className={`py-1 pr-3 ${j > 0 ? "num text-right" : ""}`}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {a.series && a.series.values.length > 1 && (
        <div className="mt-2.5 flex h-14 items-end gap-1">
          {a.series.values.map((v: number, i: number) => {
            const max = Math.max(...a.series.values.map(Math.abs), 1);
            return <div key={i} title={`${a.series.labels[i]}: ${v}`} className="flex-1 rounded-sm" style={{ height: `${Math.max(6, Math.abs(v) / max * 100)}%`, background: v >= 0 ? "var(--accent)" : "var(--neg)", opacity: 0.85 }} />;
          })}
        </div>
      )}
      {a.links?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2 text-[12px]">
          {a.links.map((l: any) => <Link key={l.href} className="link no-underline" href={l.href}>{l.label} →</Link>)}
        </div>
      )}
      {a.note && <p className="mt-2 border-t pt-1.5 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>ℹ {a.note}</p>}
    </div>
  );
}
