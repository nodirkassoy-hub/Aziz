"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "./actions";
import { Field, Select, TextInput } from "@/components/forms";
import { parseMoney } from "@/lib/money";
import { Check } from "lucide-react";

export function OnboardForm({ hasOther }: { hasOther: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", legalName: "", taxId: "", baseCurrency: "UZS", jurisdiction: "", bankOpening: "" });
  async function go() {
    setBusy(true); setErr(null);
    const r = await createCompany({ ...f, bankOpening: parseMoney(f.bankOpening || "0") });
    setBusy(false);
    if (r?.error) { setErr(r.error); return; }
    router.push("/app"); router.refresh();
  }
  return (
    <div className="space-y-4">
      <Field label="Company name *"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} placeholder="Bilol Trading LLC" autoFocus /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal name"><TextInput value={f.legalName} onChange={(e: any) => setF({ ...f, legalName: e.target.value })} /></Field>
        <Field label="TIN / STIR"><TextInput value={f.taxId} onChange={(e: any) => setF({ ...f, taxId: e.target.value })} /></Field>
        <Field label="Base currency" hint="the ledger currency — most reports live in it">
          <Select value={f.baseCurrency} onChange={(e: any) => setF({ ...f, baseCurrency: e.target.value })} options={["UZS", "USD", "EUR", "KZT", "RUB"]} />
        </Field>
        <Field label="Tax jurisdiction" hint="a label + starting point for your tax setup">
          <TextInput value={f.jurisdiction} onChange={(e: any) => setF({ ...f, jurisdiction: e.target.value })} placeholder="Uzbekistan" />
        </Field>
      </div>
      <Field label="Cash in the bank today" hint="optional — books an opening balance against equity">
        <TextInput inputMode="decimal" value={f.bankOpening} onChange={(e: any) => setF({ ...f, bankOpening: e.target.value })} placeholder="0.00" />
      </Field>
      {err && <div className="chip chip-bad !px-3 !py-2 w-full justify-start text-xs" role="alert">{err}</div>}
      <button className="btn-primary w-full inline-flex items-center justify-center gap-2" disabled={busy} onClick={go}>
        <Check size={16} /> {busy ? "Creating…" : `Create${hasOther ? " another" : ""} company & enter Mizom`}
      </button>
    </div>
  );
}
