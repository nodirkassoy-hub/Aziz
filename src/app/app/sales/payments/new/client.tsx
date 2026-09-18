"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";
import { Field, FormCard, Select, Submit, TextInput, usePost } from "@/components/forms";
import { Money } from "@/components/kit";
import { fmtDate, today } from "@/lib/dates";
import { parseMoney, minorToInput } from "@/lib/money";
import { HandCoins, Wallet } from "lucide-react";

type DocRow = { id: number; party_id: number; number: string; date: string; due_date: string | null; total_base: number; paid: number; outstanding: number };

export function PaymentForm({ parties, banks, invoices, bills, openExpenses, base, initial }: any) {
  const router = useRouter(); const ui = useUI();
  const { post, busy, err, FormError } = usePost();
  const [dir, setDir] = useState<"in" | "out">(initial?.dir === "out" ? "out" : "in");
  const [partyId, setPartyId] = useState<number | "">(initial?.party_id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState<number | "">(banks[0]?.id ?? "");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const docs: DocRow[] = useMemo(() => (dir === "in" ? invoices : bills).filter((d: DocRow) => String(d.party_id) === String(partyId)), [dir, partyId]);
  const exps: any[] = useMemo(() => dir === "out" ? openExpenses.filter((e: any) => String(e.party_id) === String(partyId)) : [], [dir, partyId, partyId]);
  const amtMinor = parseMoney(amount || "0");
  const allocTotal = useMemo(() => Object.values(alloc).reduce((s, v) => s + (v || 0), 0), [alloc]);
  const unallocated = amtMinor - allocTotal;

  const partiesList = dir === "in" ? parties.customers : parties.suppliers;

  function autoFill() {
    const next: Record<string, number> = {}; let left = amtMinor;
    for (const d of [...docs.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))]) {
      const take = Math.min(left, d.outstanding); if (take > 0) { next[`d${d.id}`] = take; left -= take; }
    }
    if (left > 0) for (const e of exps) { const take = Math.min(left, e.outstanding); if (take > 0) { next[`e${e.id}`] = take; left -= take; } }
    setAlloc(next);
  }

  async function submit() {
    if (amtMinor <= 0) { ui.toast("error", "Enter the amount first."); return; }
    const allocations = [
      ...docs.filter(d => (alloc[`d${d.id}`] || 0) > 0).map(d => ({ doc_id: d.id, amount: alloc[`d${d.id}`] })),
      ...exps.filter(e => (alloc[`e${e.id}`] || 0) > 0).map(e => ({ expense_id: e.id, amount: alloc[`e${e.id}`] })),
    ];
    const d = await post("/api/payments", { action: "create", direction: dir, party_id: partyId || null, amount: amtMinor, date, account_id: accountId, method, reference: reference || null, allocations });
    if (d?.id) { ui.toast("success", d.message); router.push("/app/sales/payments"); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <FormCard title="Payment direction">
        <div className="grid grid-cols-2 gap-3">
          {([["in", "Money in", "From a customer", HandCoins], ["out", "Money out", "To a supplier", Wallet]] as const).map(([v, label, sub, Icon]: any) => (
            <button type="button" key={v} onClick={() => { setDir(v); setPartyId(""); setAlloc({}); }}
              className="rounded-xl border p-3.5 text-left transition-all"
              style={{ borderColor: dir === v ? "var(--accent)" : "var(--line)", background: dir === v ? "var(--accent-soft)" : "transparent" }}>
              <Icon size={18} style={{ color: dir === v ? "var(--accent)" : "var(--muted)" }} />
              <div className="mt-1.5 text-[14px] font-semibold">{label}</div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>{sub}</div>
            </button>
          ))}
        </div>
      </FormCard>

      <FormCard title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dir === "in" ? "Customer" : "Supplier"} hint={docs.length + exps.length > 0 ? `${docs.length + exps.length} open document(s) to allocate against` : "No open documents — the amount will stay on account."}>
            <Select value={partyId} onChange={(e: any) => { setPartyId(e.target.value ? +e.target.value : ""); setAlloc({}); }}
              options={[{ v: "", label: "— On account (unassigned) —" }, ...partiesList.map((c: any) => ({ v: c.id, label: c.name }))]} />
          </Field>
          <Field label="Amount" hint={`In ${base} (ledger currency). Includes tax.`}>
            <TextInput inputMode="decimal" placeholder="0.00" value={amount} onChange={(e: any) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date"><TextInput type="date" value={date} max={today()} onChange={(e: any) => setDate(e.target.value)} /></Field>
          <Field label="Account received into / paid from">
            <Select value={accountId} onChange={(e: any) => setAccountId(+e.target.value)}
              options={banks.map((b: any) => ({ v: b.id, label: `${b.name}${b.is_cash ? " (cash)" : ""} — ${(b.balance / 100).toLocaleString("en-US")} ${b.currency}` }))} />
          </Field>
          <Field label="Method"><Select value={method} onChange={(e: any) => setMethod(e.target.value)} options={["bank", "cash", "card", "other"]} /></Field>
          <Field label="Reference" hint="Transfer / receipt number"><TextInput value={reference} onChange={(e: any) => setReference(e.target.value)} placeholder="e.g. 4471-B" /></Field>
        </div>
      </FormCard>

      {partyId !== "" && (docs.length > 0 || exps.length > 0) && (
        <FormCard title="Allocation" desc="Fill amounts or use Auto — leftover stays on the party's account.">
          <div className="space-y-1.5">
            {docs.map(d => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--accent-soft)" }}>
                <span className="num text-[13px] font-semibold">{d.number}</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{fmtDate(d.due_date)} · {d.due_date && d.due_date < today() ? "overdue" : "open"}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>open <Money v={d.outstanding} currency={base} className="num font-semibold" /></span>
                <input className="input !w-32 !py-1 text-right" inputMode="decimal" placeholder="0"
                  value={alloc[`d${d.id}`] ? minorToInput(alloc[`d${d.id}`]) : ""}
                  onChange={(e) => setAlloc(a => ({ ...a, [`d${d.id}`]: parseMoney(e.target.value || "0") }))} />
              </div>
            ))}
            {exps.map((d: any) => (
              <div key={`e${d.id}`} className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--accent-soft)" }}>
                <span className="text-[13px] font-semibold truncate max-w-[220px]">{d.number}</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{fmtDate(d.date)} · expense</span>
                <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>open <Money v={d.outstanding} currency={base} className="num font-semibold" /></span>
                <input className="input !w-32 !py-1 text-right" inputMode="decimal" placeholder="0"
                  value={alloc[`e${d.id}`] ? minorToInput(alloc[`e${d.id}`]) : ""}
                  onChange={(e) => setAlloc(a => ({ ...a, [`e${d.id}`]: parseMoney(e.target.value || "0") }))} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
            <button type="button" className="btn-outline btn-sm" onClick={autoFill}>Auto-allocate</button>
            <span style={{ color: "var(--muted)" }}>allocated <Money v={allocTotal} currency={base} className="num font-semibold" /></span>
            <span style={{ color: unallocated > 0 ? "var(--warn)" : unallocated < 0 ? "var(--neg)" : "var(--muted)" }}>
              {unallocated > 0 ? <>{minorToInput(unallocated)} {base} on account</> : unallocated < 0 ? <>{minorToInput(-unallocated)} {base} over-allocated — reduce it</> : "fully allocated ✓"}
            </span>
          </div>
        </FormCard>
      )}

      <div className="flex items-center gap-3">
        <Submit busy={busy} onClick={submit}>Record &amp; post</Submit>
        <button className="btn-outline" onClick={() => router.push("/app/sales/payments")}>Cancel</button>
        <div className="min-w-0 flex-1"><FormError /></div>
      </div>
    </div>
  );
}
