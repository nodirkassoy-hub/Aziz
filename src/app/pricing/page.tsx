import Link from "next/link";
import { Check, Landmark, Minus } from "lucide-react";

export const metadata = { title: "Pricing — Mizom" };

const PLANS = [
  { name: "Solo", price: "$0", per: "forever", note: "one company, honest books", features: [["Unlimited invoices, quotes, bills", 1], ["Full double-entry ledger & reports", 1], ["Receipt OCR with review step", 1], ["Manual FX rates", 1], ["Bank CSV lines — key or import", 2], ["AI CFO answers", 1], ["Team members", 0]] },
  { name: "Studio", price: "$29", per: "/month", note: "for a team that reconciles weekly", featured: true, features: [["Everything in Solo", 1], ["Unlimited documents & parties", 1], ["Multi-currency + FX gains/losses", 1], ["Approval chains & period locks", 1], ["3 seats included, $6 per extra", 1], ["Bank line auto-matching", 1], ["Export CSV everything", 1]] },
  { name: "Firm", price: "talk to us", per: "", note: "accountants running many clients", features: [["Everything in Studio", 1], ["Unlimited seats", 1], ["Demo & template workspaces", 1], ["Priority data-migration help", 1], ["Self-host guidance & whitepaper", 2], ["API & webhooks", 0]] },
];

export default function Pricing() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={18} /></span><span className="text-lg font-extrabold">Mizom</span></Link>
        <div className="ml-auto flex items-center gap-2"><Link href="/login" className="btn-ghost btn-sm">Sign in</Link><Link href="/register" className="btn-primary btn-sm">Create account</Link></div>
      </header>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Pricing, flat and legible</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-[14px]" style={{ color: "var(--muted)" }}>No per-document fees, no “contact sales” gates on core ledgers. Launch pricing — it will not go down, but may go up when integrations land.</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.name} className={`glass flex flex-col rounded-3xl p-6 ${p.featured ? "ring-2 ring-[var(--accent)]" : ""}`}>
              {p.featured && <span className="chip chip-good mb-3 w-fit !py-0 text-[10.5px]">most chosen</span>}
              <div className="text-[15px] font-bold">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1"><span className="text-3xl font-extrabold">{p.price}</span><span className="text-[13px]" style={{ color: "var(--muted)" }}>{p.per}</span></div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>{p.note}</div>
              <ul className="mt-4 flex-1 space-y-2 text-[13px]">
                {p.features.map(([t, state]: any) => (
                  <li key={t} className="flex items-start gap-2" style={{ opacity: state === 0 ? 0.45 : 1 }}>
                    {state === 1 ? <Check size={15} style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" /> : <Minus size={15} className="mt-0.5 shrink-0" style={{ color: "var(--muted)" }} />}
                    <span>{t}{state === 2 ? " (on request)" : ""}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className={`mt-5 w-full ${p.featured ? "btn-primary" : "btn-outline"} inline-flex items-center justify-center no-underline`}>Start with {p.name}</Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          All plans include: transparent computed health score with its formula shown, honest OCR (always a review step), AI answers that cite their own data, and the audit log. Nothing posts silently, ever.
        </p>
      </section>
    </main>
  );
}
