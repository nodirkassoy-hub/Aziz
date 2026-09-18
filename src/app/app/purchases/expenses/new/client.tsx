"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";
import { Check, Field, FormCard, Select, Submit, TextInput, usePost } from "@/components/forms";
import { parseMoney, minorToInput } from "@/lib/money";
import { today } from "@/lib/dates";
import { Upload, X } from "lucide-react";

export function ExpenseForm({ data }: { data: any }) {
  const router = useRouter(); const ui = useUI();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({
    date: today(), description: "", amount: "", taxRateId: "" as string | number, tax_pct: "", taxManual: "",
    category: (data.accounts.find((a: any) => a.code === "6900") ?? data.accounts[0])?.id ?? "",
    supplier: "", account: "" as string | number, payNow: true, recur: "", recurDom: "5",
  });
  const [receipt, setReceipt] = useState<{ id: number; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const ratePct = useMemo(() => {
    if (f.taxManual !== "") return null;
    const r = data.taxRates.find((t: any) => String(t.id) === String(f.taxRateId));
    return r ? r.rate_pct : f.tax_pct === "" ? null : parseFloat(f.tax_pct);
  }, [f.taxRateId, f.tax_pct, f.taxManual, data.taxRates]);
  const amountMinor = parseMoney(f.amount || "0");
  const taxMinor = f.taxManual !== "" ? parseMoney(f.taxManual) : ratePct ? Math.round(amountMinor * ratePct / 100) : 0;

  async function pickReceipt(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("kind", "receipt");
      const r = await fetch("/api/files", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { ui.toast("error", d.error ?? "Upload failed"); return; }
      setReceipt({ id: d.id, name: d.name });
    } finally { setUploading(false); }
  }

  async function submit() {
    if (amountMinor <= 0) { ui.toast("error", "Amount must be greater than zero."); return; }
    const d = await post("/api/expenses", {
      action: "create", date: f.date, description: f.description || null,
      amount: amountMinor, tax: taxMinor, tax_pct: ratePct ?? 0, tax_rate_id: ratePct ? (data.taxRates.find((t: any) => String(t.id) === String(f.taxRateId))?.id ?? null) : null,
      category_account_id: f.category || null, supplier_id: f.supplier ? +f.supplier : null,
      account_id: f.payNow && f.account ? +f.account : null,
      receipt_doc_id: receipt?.id ?? null,
      recur_freq: f.recur || null, recur_dom: f.recur ? +f.recurDom : null,
    });
    if (d?.id) { ui.toast("success", d.message); router.push("/app/purchases/expenses"); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <FormCard title="Expense">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date"><TextInput type="date" value={f.date} max={today()} onChange={(e: any) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Description" className="sm:col-span-1"><TextInput value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} placeholder="e.g. Freight — Tashkent delivery" /></Field>
          <Field label="Amount" hint={data.base}><TextInput inputMode="decimal" placeholder="0.00" value={f.amount} onChange={(e: any) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Tax">
            <div className="flex items-center gap-2">
              <Select className="!w-40" value={f.taxRateId} onChange={(e: any) => setF({ ...f, taxRateId: e.target.value, taxManual: "", tax_pct: "" })}
                options={[{ v: "", label: "No tax" }, ...data.taxRates.map((t: any) => ({ v: t.id, label: `${t.name} (${t.rate_pct}%)` }))]} />
              <TextInput className="!w-28 text-right" inputMode="decimal" placeholder="or exact" value={f.taxManual} onChange={(e: any) => setF({ ...f, taxManual: e.target.value, taxRateId: "" })} />
            </div>
            {taxMinor > 0 && <span className="mt-1 block text-[11.5px] num" style={{ color: "var(--muted)" }}>tax {minorToInput(taxMinor)} · total {minorToInput(amountMinor + taxMinor)} {data.base}</span>}
          </Field>
          <Field label="Category (ledger account)">
            <Select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}
              options={data.accounts.map((a: any) => ({ v: a.id, label: `${a.code} · ${a.name}` }))} />
          </Field>
          <Field label="Supplier" hint="Optional — links the expense into supplier balances">
            <Select value={f.supplier} onChange={(e: any) => setF({ ...f, supplier: e.target.value })}
              options={[{ v: "", label: "— none —" }, ...data.suppliers.map((s: any) => ({ v: s.id, label: s.name }))]} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Check label="Already paid" checked={f.payNow} onChange={(e: any) => setF({ ...f, payNow: e.target.checked })} />
          <Field label="Paid from">
            <Select value={f.account} disabled={!f.payNow} onChange={(e: any) => setF({ ...f, account: e.target.value })}
              options={[{ v: "", label: f.payNow ? "Select account…" : "Unpaid — sits on AP" }, ...(f.payNow ? data.banks.map((b: any) => ({ v: b.id, label: b.name })) : [])]} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Field label="Recurring" className="min-w-[130px]"><Select value={f.recur} onChange={(e: any) => setF({ ...f, recur: e.target.value })}
            options={[{ v: "", label: "One-off" }, { v: "monthly", label: "Monthly" }, { v: "quarterly", label: "Quarterly" }, { v: "yearly", label: "Yearly" }]} /></Field>
          {f.recur && <Field label="Day of month" className="w-24"><TextInput type="number" min={1} max={28} value={f.recurDom} onChange={(e: any) => setF({ ...f, recurDom: e.target.value })} /></Field>}
        </div>
      </FormCard>
      <FormCard title="Receipt / attachment" desc="Stored against the expense for audit — never posts anything by itself.">
        {receipt ? (
          <div className="flex items-center gap-2 text-[13px]"><span className="chip chip-good">attached</span> <span className="truncate">{receipt.name}</span>
            <button className="btn-ghost btn-sm ml-auto !px-2" onClick={() => setReceipt(null)}><X size={14} /> remove</button></div>
        ) : (
          <label htmlFor="exp-receipt" className="btn-outline btn-sm inline-flex cursor-pointer"><Upload size={14} /> {uploading ? "Uploading…" : "Upload receipt (PDF / image)"}</label>
        )}
        {!receipt && <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" id="exp-receipt" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) pickReceipt(fl); }} />}
      </FormCard>
      <div className="flex items-center gap-3">
        <Submit busy={busy} onClick={submit}>Save expense</Submit>
        <button className="btn-outline" onClick={() => router.push("/app/purchases/expenses")}>Cancel</button>
        <div className="min-w-0 flex-1"><FormError /></div>
      </div>
    </div>
  );
}
