"use client";
/** Small shared form primitives for client forms. */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function usePost(onDone?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function post(path: string, body: any): Promise<any | null> {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setErr(d.error ?? `Request failed (${r.status})`); return null; }
      setMsg(d.message ?? null);
      router.refresh();
      onDone?.();
      return d;
    } catch (e: any) { setErr(String(e?.message ?? e)); return null; }
    finally { setBusy(false); }
  }
  return { post, busy, err, setErr, msg, FormError: () => err ? <div className="rounded-xl px-3 py-2 text-[13px]" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>{err}</div> : null };
}

export function Field({ label, hint, children, className = "" }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...p }: any) {
  return <input {...p} className={`input ${className}`} />;
}

export function Select({ className = "", options, ...p }: any) {
  return (
    <select {...p} className={`input ${className}`}>
      {options.map((o: any) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v} disabled={o.disabled}>{o.label}</option>))}
    </select>
  );
}

export function Check({ label, ...p }: any) {
  return (
    <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none" style={{ color: "var(--text)" }}>
      <input type="checkbox" className="accent-[var(--accent)]" {...p} /> {label}
    </label>
  );
}

export function Submit({ busy, children, danger = false, className = "", ...p }: any) {
  return (
    <button {...p} disabled={busy} className={`${danger ? "btn-danger" : "btn-primary"} ${className}`} style={{ opacity: busy ? 0.6 : 1 }}>
      {busy ? "Working…" : children}
    </button>
  );
}

/** Section card used inside forms */
export function FormCard({ title, desc, children, className = "" }: { title: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>
      <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
      {desc && <p className="mt-0.5 mb-0 text-[12.5px]" style={{ color: "var(--muted)" }}>{desc}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
