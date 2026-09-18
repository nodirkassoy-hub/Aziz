"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Money } from "@/components/kit";
import { Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";
import { Building2, Pencil, Plus, Wallet } from "lucide-react";
import { fmtDate, today } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import Link from "next/link";

export function BanksClient({ accounts, ledgerAccounts, base, disp, canManage, isCash }: any) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [txn, setTxn] = useState<any>(null);
  const Icon = isCash ? Wallet : Building2;
  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((b: any) => (
          <div key={b.id} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-xl p-2" style={{ background: "var(--accent-soft)" }}><Icon size={16} style={{ color: "var(--accent)" }} /></span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">{b.name}{b.archived ? <span className="chip ml-1.5 !py-0 text-[10px]">archived</span> : null}</div>
                <div className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{b.bank ?? "—"} · {b.currency}</div>
              </div>
              <div className="num ml-auto text-right">
                <div className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>ledger balance</div>
                <div className="text-[15px] font-bold" style={{ color: b.book < 0 ? "var(--neg)" : undefined }}><Money v={b.book} currency={disp} /></div>
              </div>
            </div>
            {b.number && <div className="num mt-2 text-[12px]" style={{ color: "var(--muted)" }}>•••• {b.number.slice(-4)}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
              <Link className="btn-outline btn-sm !px-2.5 no-underline" href={`/app/accounting/reconciliation?account=${b.id}`}>
                {b.unrecon > 0 ? <span style={{ color: "var(--warn)" }}>Reconcile · {b.unrecon} open</span> : "Reconcile ✓"}</Link>
              <Link className="btn-outline btn-sm !px-2.5 no-underline" href={`/app/sales/payments/new?dir=${isCash ? "out" : "in"}`}>Payments</Link>
              {canManage && <button className="btn-ghost btn-sm !px-2 text-xs" onClick={() => setTxn(b)}>+ Statement line</button>}
              {canManage && <button className="btn-ghost btn-sm !px-1.5 ml-auto" onClick={() => setEdit(b)}><Pencil size={13} /></button>}
            </div>
          </div>
        ))}
        {canManage && (
          <button onClick={() => setAddOpen(true)} className="glass flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed text-[13px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            <Plus size={18} /><span>New {isCash ? "cash account" : "bank account"}</span>
          </button>)}
      </div>
      <AccountModal open={addOpen || !!edit} account={edit} onClose={() => { setAddOpen(false); setEdit(null); }}
        isCash={isCash} ledgerAccounts={ledgerAccounts} base={base}
        onSave={async (body: any) => {
          const d = await post("/api/banks", edit ? { action: "update_account", id: edit.id, ...body } : { action: "create_account", is_cash: isCash ? 1 : 0, ...body });
          if (d?.message) { ui.toast("success", d.message); setAddOpen(false); setEdit(null); router.refresh(); }
        }} busy={busy} />
      <Modal open={!!txn} onClose={() => setTxn(null)} title={`Add statement line — ${txn?.name ?? ""}`}>
        {txn && <TxnForm base={base} busy={busy} onAdd={async (body: any) => {
          const d = await post("/api/banks", { action: "add_transaction", account_id: txn.id, ...body });
          if (d?.message) { ui.toast("success", d.message); setTxn(null); router.refresh(); }
        }} />}
      </Modal>
      {err && <div className="mt-3 rounded-xl px-3.5 py-2 text-[13px]" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>{err}</div>}
    </>
  );
}

function AccountModal({ open, onClose, account, isCash, base, onSave, busy }: any) {
  const [f, setF] = useState<any>({ name: account?.name ?? "", bank: account?.bank ?? "", number: account?.number ?? "", currency: account?.currency ?? base, opening: "", opening_date: today(), archived: false });
  return (
    <Modal open={open} onClose={onClose} title={account ? "Edit account" : `New ${isCash ? "cash" : "bank"} account`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} placeholder={isCash ? "Petty cash — office" : "Primary — Ipak Yuli"} /></Field>
        {!account && <Field label="Opening balance" hint={`in ${base} · posted to equity as opening entry`}><TextInput inputMode="decimal" value={f.opening} onChange={(e: any) => setF({ ...f, opening: e.target.value })} /></Field>}
        {!account && <Field label="Opening date"><TextInput type="date" value={f.opening_date} onChange={(e: any) => setF({ ...f, opening_date: e.target.value })} /></Field>}
        {!isCash && <Field label="Bank"><TextInput value={f.bank} onChange={(e: any) => setF({ ...f, bank: e.target.value })} placeholder="Ipak Yuli Bank" /></Field>}
        {!isCash && <Field label="Account number"><TextInput value={f.number} onChange={(e: any) => setF({ ...f, number: e.target.value })} placeholder="2020 8040 …" /></Field>}
        <Field label="Currency"><Select value={f.currency} onChange={(e: any) => setF({ ...f, currency: e.target.value })} options={["UZS", "USD", "EUR", "RUB", "KZT"]} /></Field>
        {account && <label className="flex items-center gap-2 text-[13px] self-end pb-2"><input type="checkbox" className="accent-[var(--accent)]" checked={f.archived} onChange={(e: any) => setF({ ...f, archived: e.target.checked })} /> Archived</label>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Submit busy={busy} onClick={() => onSave({ name: f.name, bank: f.bank || null, number: f.number || null, currency: f.currency, opening_balance: account ? undefined : parseMoney(f.opening || "0"), opening_date: f.opening_date, archived: f.archived })}>{account ? "Save" : "Create account"}</Submit>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
      </div>
      {!account && <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>A dedicated ledger account is created automatically so every account has its own GL.</p>}
    </Modal>
  );
}

function TxnForm({ base, onAdd, busy }: any) {
  const [f, setF] = useState({ date: today(), description: "", amount: "", category: "" });
  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Adds a line to the bank feed only — it does not touch the ledger. Book it from Reconciliation (which posts the entry) so both sides stay provable.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date"><TextInput type="date" value={f.date} max={today()} onChange={(e: any) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Amount" hint={`${base} · negative = money out`}><TextInput inputMode="decimal" value={f.amount} onChange={(e: any) => setF({ ...f, amount: e.target.value })} placeholder="-25000 or 75000" /></Field>
        <Field label="Description" className="sm:col-span-2"><TextInput value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <Submit busy={busy} onClick={() => onAdd({ date: f.date, description: f.description || null, amount: Math.round(parseFloat(f.amount || "0") * 100), category: f.category || null })}>Add line</Submit>
    </div>
  );
}
