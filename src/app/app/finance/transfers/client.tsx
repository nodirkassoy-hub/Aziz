"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormCard, Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";
import { ArrowLeftRight } from "lucide-react";
import { today } from "@/lib/dates";
import { parseMoney } from "@/lib/money";

export function TransferForm({ accounts, base }: any) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({ from: accounts[0]?.id ?? "", to: accounts[1]?.id ?? "", amount: "", date: today(), memo: "" });
  return (
    <FormCard title="New transfer">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From"><Select value={f.from} onChange={(e: any) => setF({ ...f, from: +e.target.value })} options={accounts.map((a: any) => ({ v: a.id, label: `${a.name}${a.currency !== base ? ` (${a.currency})` : ""}` }))} /></Field>
        <Field label="To"><Select value={f.to} onChange={(e: any) => setF({ ...f, to: +e.target.value })} options={accounts.map((a: any) => ({ v: a.id, label: `${a.name}${a.currency !== base ? ` (${a.currency})` : ""}` }))} /></Field>
        <Field label={`Amount (${base})`} hint="in base currency — amounts are booked exactly as entered"><TextInput inputMode="decimal" value={f.amount} onChange={(e: any) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><TextInput type="date" value={f.date} max={today()} onChange={(e: any) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Memo" className="sm:col-span-2"><TextInput value={f.memo} onChange={(e: any) => setF({ ...f, memo: e.target.value })} placeholder="e.g. fund top-up for supplier batch" /></Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Submit busy={busy} onClick={async () => {
          const amount = parseMoney(f.amount || "0");
          if (amount <= 0) { ui.toast("error", "Enter an amount."); return; }
          const d = await post("/api/banks", { action: "transfer", from: f.from, to: f.to, amount, date: f.date, memo: f.memo || null });
          if (d?.message) { ui.toast("success", d.message); setF({ ...f, amount: "", memo: "" }); router.refresh(); }
        }}>Post transfer</Submit>
        <ArrowLeftRight size={15} style={{ color: "var(--muted)" }} />
        <div className="min-w-0 flex-1"><FormError /></div>
      </div>
    </FormCard>
  );
}
