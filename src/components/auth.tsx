"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useUI } from "@/components/ui";
import { Landmark, ShieldCheck, Sparkles } from "lucide-react";

function AuthInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const demoArmed = mode === "login" && sp.get("demo") === "1";

  async function submit(email = form.email, password = form.password) {
    setBusy(true); setErr(null);
    const res = await api("/api/auth", { body: { mode, name: form.name, email, password, code: needCode ? code : undefined } });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Something went wrong."); return; }
    if (res.data?.need_2fa) { setNeedCode(true); toast("info", "Enter the 6-digit code from your authenticator app."); return; }
    toast("success", mode === "login" ? "Welcome back." : "Account created — let's set up your company.");
    router.push(res.data?.next ?? "/app");
    router.refresh();
  }
  useEffect(() => {
    if (demoArmed) submit("demo@mizom.uz", "Demo1234!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoArmed]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={21} /></span>
            <span className="text-2xl font-extrabold tracking-tight">Mizom</span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{mode === "login" ? "Sign in to your workspace" : "Create your accounting workspace"}</p>
        </div>
        <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {mode === "register" && (
            <div><label className="label">Full name</label>
              <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dilnoza Yusupova" autoComplete="name" /></div>
          )}
          <div><label className="label">Email</label>
            <input className="input" required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.uz" autoComplete="email" /></div>
          <div><label className="label">Password</label>
            <input className="input" required type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="min. 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
          {needCode && (
            <div><label className="label">Authenticator code</label>
              <input className="input text-center tracking-[0.4em] font-bold" inputMode="numeric" pattern="\d*" maxLength={6} autoFocus
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" autoComplete="one-time-code" /></div>
          )}
          {err && <div className="chip chip-bad !px-3 !py-2 w-full justify-start text-xs" role="alert">{err}</div>}
          <button className="btn-primary w-full" disabled={busy || (demoArmed && false)}>
            {busy ? (demoArmed ? "Preparing demo data…" : "Please wait…") : mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "login" && (
            <button type="button" className="btn-ghost w-full text-[13px]" onClick={() => submit("demo@mizom.uz", "Demo1234!")}>
              <Sparkles size={14} style={{ color: "var(--accent)" }} /> Try the full demo company
            </button>
          )}
        </form>
        <p className="mt-5 text-center text-sm" style={{ color: "var(--muted)" }}>
          {mode === "login" ? <>No account? <Link className="link" href="/register">Create one</Link></> : <>Already registered? <Link className="link" href="/login">Sign in</Link></>}
        </p>
        <div className="mt-6 flex items-center justify-center gap-5 text-[11px]" style={{ color: "var(--faint)" }}>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Encrypted passwords (scrypt)</span>
          <span className="inline-flex items-center gap-1.5"><Lock /> Sessions expire in 30 days</span>
        </div>
      </div>
    </div>
  );
}
function Lock() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }

export default function LoginPage() {
  return null;
}
export function AuthShell({ mode }: { mode: "login" | "register" }) {
  return <Suspense fallback={<div className="min-h-dvh" />}><AuthInner mode={mode} /></Suspense>;
}
