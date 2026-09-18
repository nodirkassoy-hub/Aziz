"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Printer } from "lucide-react";

export function PrintBtn() {
  return <button type="button" className="btn-outline btn-sm" onClick={() => window.print()}><Printer size={14} className="mr-1 inline" />Print</button>;
}

export function AccountPicker({ accounts, value, from, to }: { accounts: { id: number; code: string; name: string }[]; value: any; from: string; to: string }) {
  return (
    <form className="print:hidden" method="get">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <select className="input !w-64 !py-1.5" name="account" defaultValue={String(value ?? "")} onChange={(e) => { (e.target.form as HTMLFormElement).submit(); }}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
      </select>
    </form>
  );
}

export function PeriodControls({ from, to }: { from: string | null | undefined; to?: string }) {
  const router = useRouter();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const presets: [string, string | null, string][] = [
    ["MTD", new Date().toISOString().slice(0, 7) + "-01", undefined as any],
    ["YTD", new Date().getFullYear() + "-01-01", undefined as any],
    ["Last 12m", null, undefined as any],
  ];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input className="input !w-36 !py-1.5" type="date" value={f ?? ""} onChange={(e) => setF(e.target.value)} />
      <span style={{ color: "var(--muted)" }}>→</span>
      <input className="input !w-36 !py-1.5" type="date" value={t ?? ""} onChange={(e) => setT(e.target.value)} />
      <button className="btn-outline btn-sm" onClick={() => {
        const sp = new URLSearchParams(location.search);
        if (f) sp.set("from", f); else sp.delete("from");
        if (t) sp.set("to", t); else sp.delete("to");
        router.push(`${location.pathname}?${sp.toString()}`);
      }}>Apply</button>
    </span>
  );
}
