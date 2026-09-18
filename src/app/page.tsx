import Link from "next/link";
import { ArrowRight, Banknote, BookOpenCheck, Bot, Building2, FileScan, Landmark, ShieldCheck, Sparkles } from "lucide-react";

export const metadata = { title: "Mizom — accounting with receipts that post themselves… after you say so" };
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: FileScan, title: "Invoices, quotes, bills, orders", desc: "One document workflow with live paper preview, print/PDF, conversions (quote → order → invoice) and credit notes that settle against the original." },
  { icon: Landmark, title: "A real double-entry core", desc: "Every posted document writes balanced journal lines. Trial balance, GL, P&L and the dashboard all read the same ledger — numbers can’t disagree." },
  { icon: Banknote, title: "Multi-currency by design", desc: "Documents in UZS, USD, EUR — converted at dated manual rates, with FX differences booked to a dedicated account instead of silently." },
  { icon: Building2, title: "Bank reconciliation that clicks", desc: "Import or key statement lines, auto-match by amount & date, split, book missing expenses from the feed, close the period — and lock it." },
  { icon: BookOpenCheck, title: "Receipt OCR, honest by default", desc: "A deterministic extractor proposes vendor, date and amounts. Nothing posts until you confirm every field. Review-before-posting isn’t a mode; it’s the only mode." },
  { icon: Bot, title: "AI CFO with receipts", desc: "Answers computed from your own posted entries — each reply states its method, period and links to the underlying report. No vibes-based forecasting." },
];

export default function Landing() {
  return (
    <main className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 78%, transparent)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={18} /></span><span className="text-lg font-extrabold tracking-tight">Mizom</span></span>
          <nav className="ml-6 hidden items-center gap-5 text-[13.5px] md:flex" style={{ color: "var(--muted)" }}>
            <a className="no-underline hover:opacity-80" href="#features">Features</a>
            <a className="no-underline hover:opacity-80" href="#ledger">The ledger</a>
            <Link className="no-underline hover:opacity-80" href="/pricing">Pricing</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
            <Link href="/register" className="btn-primary btn-sm">Create account</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% -10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent)" }} />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="chip mb-5 inline-flex items-center gap-1.5 !px-3 !py-1 text-[12px]"><Sparkles size={12} style={{ color: "var(--accent)" }} /> double-entry, not a spreadsheet with a hat</span>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Accounting that shows its work.<br /><span style={{ color: "var(--accent)" }}>Every number is one click from the entry.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed sm:text-base" style={{ color: "var(--muted)" }}>
            Mizom posts invoices, bills, payments and receipts into a real ledger, reconciles your bank, and lets an AI CFO answer questions — while being bluntly honest about what is computed, what is proposed, and what is demo data.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login?demo=1" className="btn-primary !px-5 !py-2.5 inline-flex items-center gap-2">Explore the full demo company <ArrowRight size={16} /></Link>
            <Link href="/register" className="btn-outline !px-5 !py-2.5">Start your own books</Link>
          </div>
          <p className="mt-4 text-[11.5px]" style={{ color: "var(--faint)" }}>The demo is clearly flagged DEMO DATA in every screen — yours is never mixed with it.</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="glass rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
              <span className="inline-flex rounded-xl p-2" style={{ background: "var(--accent-soft)" }}><f.icon size={18} style={{ color: "var(--accent)" }} /></span>
              <h3 className="mt-3 text-[15px] font-bold">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ledger" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">A ledger you can audit yourself</h2>
              <ul className="mt-4 space-y-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {[
                  ["Balanced or blocked", "No posting saves unless debits equal credits. Reversals create a second entry — history is never rewritten."],
                  ["Period locks", "Close a month, lock it. Late postings get rejected with an explanation, not silently accepted."],
                  ["Approval chains", "Expenses over your threshold wait for a real human with the approve right."],
                  ["Full audit trail", "Who, when, which device, old value vs new. Append-only, visible in-app."],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-2.5"><ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /><span><b className="text-[var(--text)]">{t}.</b> {d}</span></li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border p-4 text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--accent-soft)" }}>
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}><span>JE-2026-0042</span><span className="chip chip-good !py-0 text-[10px]">balanced ✓</span></div>
              {[
                ["Dr", "4000 · Sales Revenue", ""], ["Dr", "2100 · VAT Payable", "704,400"], ["—", "1100 · Accounts Receivable", "6,540,760"], ["Cr", "5000 · COGS", "5,836,360"],
              ].map(([d, acc, v]) => (
                <div key={acc} className="num flex justify-between border-t py-1.5" style={{ borderColor: "var(--line)" }}>
                  <span>{d} <span style={{ color: "var(--muted)" }}>{acc}</span></span><span className="font-semibold">{v || "5,836,360"}</span>
                </div>
              ))}
              <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>…an invoice posting in miniature. Zoom any figure in Mizom and it lands on an entry exactly like this.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-10" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-[12.5px] sm:px-6" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-2 font-bold" style={{ color: "var(--text)" }}><Landmark size={15} style={{ color: "var(--accent)" }} /> Mizom</span>
          <span className="hidden sm:inline">Self-host friendly accounting. Tax behaviour is configured by you, per jurisdiction — Mizom applies your rules, it doesn’t claim compliance.</span>
          <span className="ml-auto flex gap-4">
            <Link className="no-underline hover:opacity-80" href="/pricing">Pricing</Link>
            <Link className="no-underline hover:opacity-80" href="/login">Sign in</Link>
            <Link className="no-underline hover:opacity-80" href="/register">Register</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
