"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/kit";
import { Field, FormCard, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";

export function PartyFormModal({ open, onClose, partyType, party, currencies }: {
  open: boolean; onClose: () => void; partyType: "customer" | "supplier"; party?: any; currencies: string[];
}) {
  const isCust = partyType === "customer";
  const { post, busy, err, FormError } = usePost(onClose);
  const ui = useUI();
  const [f, setF] = useState<Record<string, string>>({
    name: party?.name ?? "", contact_person: party?.contact_person ?? "", phone: party?.phone ?? "", email: party?.email ?? "",
    tax_id: party?.tax_id ?? "", address: party?.address ?? "", notes: party?.notes ?? "",
    credit_limit: party?.credit_limit ? String(party.credit_limit / 100) : "",
    payment_terms_days: party?.payment_terms_days != null ? String(party.payment_terms_days) : "",
    currency: party?.currency ?? currencies[0] ?? "UZS",
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    const body: any = { action: party ? "update" : "create", party_type: partyType, id: party?.id };
    for (const k of ["name", "contact_person", "phone", "email", "tax_id", "address", "notes"]) body[k] = f[k].trim() || null;
    if (isCust) body.credit_limit = f.credit_limit ? parseFloat(f.credit_limit) : 0;
    else body.payment_terms_days = f.payment_terms_days ? +f.payment_terms_days : null;
    body.currency = f.currency;
    const d = await post("/api/parties", body);
    if (d?.message) ui.toast("success", d.message);
  }
  return (
    <Modal open={open} onClose={onClose} title={party ? `Edit ${party.name}` : isCust ? "New customer" : "New supplier"} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" className="sm:col-span-2"><TextInput value={f.name} onChange={set("name")} placeholder={isCust ? "e.g. Bilol Trade LLC" : "e.g. Polimer Invest"} /></Field>
        <Field label="Contact person"><TextInput value={f.contact_person} onChange={set("contact_person")} /></Field>
        <Field label="Phone"><TextInput value={f.phone} onChange={set("phone")} placeholder="+998 90 123 45 67" /></Field>
        <Field label="Email"><TextInput type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label={isCust ? "TIN / STIR" : "TIN"}><TextInput value={f.tax_id} onChange={set("tax_id")} /></Field>
        <Field label="Address" className="sm:col-span-2"><TextInput value={f.address} onChange={set("address")} /></Field>
        {isCust ? (
          <Field label="Credit limit" hint="Warns when new invoices push open balance above it"><TextInput inputMode="decimal" value={f.credit_limit} onChange={set("credit_limit")} placeholder="0.00" /></Field>
        ) : (
          <Field label="Payment terms (days)"><TextInput type="number" min={0} value={f.payment_terms_days} onChange={set("payment_terms_days")} placeholder="14" /></Field>
        )}
        <Field label="Preferred currency"><select className="input" value={f.currency} onChange={set("currency")}>{currencies.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Notes" className="sm:col-span-2"><TextInput value={f.notes} onChange={set("notes")} /></Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Submit busy={busy} onClick={save}>{party ? "Save changes" : "Create"}</Submit>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <div className="min-w-0 flex-1"><FormError /></div>
      </div>
    </Modal>
  );
}

/** Detail-page action strip: payments link, edit, archive, opening balance */
export function PartyActions({ party, partyType, base, currencies }: { party: any; partyType: "customer" | "supplier"; base: string; currencies: string[] }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [edit, setEdit] = useState(false);
  const [obOpen, setObOpen] = useState(false);
  const [obAmt, setObAmt] = useState("");
  const isCust = partyType === "customer";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LinkActions party={party} isCust={isCust} onEdit={() => setEdit(true)} onOb={() => setObOpen(true)}
        onArchive={async () => {
          if (!confirm(`Archive ${party.name}? History is kept; they disappear from pickers.`)) return;
          const d = await post("/api/parties", { action: "archive", party_type: partyType, id: party.id });
          if (d?.message) { ui.toast("success", d.message); router.push(isCust ? "/app/sales/customers" : "/app/purchases/suppliers"); }
        }} busy={busy} />
      <PartyFormModal open={edit} onClose={() => setEdit(false)} partyType={partyType} party={party} currencies={currencies} />
      <Modal open={obOpen} onClose={() => setObOpen(false)} title={`Opening balance — ${party.name}`}>
        <div className="flex items-end gap-3">
          <Field label={`Amount (${base})`} className="flex-1"><TextInput inputMode="decimal" value={obAmt} onChange={(e: any) => setObAmt(e.target.value)} placeholder="0.00" /></Field>
          <Submit busy={busy} onClick={async () => {
            const d = await post("/api/parties", { action: "opening_balance", party_type: partyType, id: party.id, amount: Math.round(parseFloat(obAmt || "0") * 100) });
            if (d?.message) { ui.toast("success", d.message); setObOpen(false); router.refresh(); }
          }}>Post</Submit>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>Books a journal entry to AR/AP against equity — for balances that existed before you started using Mizom.</p>
        <FormError />
      </Modal>
    </div>
  );
}

function LinkActions({ party, isCust, onEdit, onOb, onArchive, busy }: any) {
  return (
    <>
      <a className="btn-primary btn-sm no-underline" href={isCust ? `/app/sales/invoices/new?customer=${party.id}` : `/app/purchases/bills/new?customer=${party.id}`}>
        {isCust ? "New invoice" : "New bill"}</a>
      <a className="btn-outline btn-sm no-underline" href={`/app/sales/payments/new?dir=${isCust ? "in" : "out"}&party=${party.id}`}>{isCust ? "Record payment" : "Pay supplier"}</a>
      <a className="btn-outline btn-sm no-underline" href={`/api/reports/export?kind=statement&party=${party.id}&party_type=${isCust ? "customer" : "supplier"}`}>Statement CSV</a>
      <button className="btn-ghost btn-sm" onClick={onEdit}>Edit</button>
      <button className="btn-ghost btn-sm" onClick={onOb}>Opening balance…</button>
      <button className="btn-ghost btn-sm ml-auto" style={{ color: "var(--neg)", opacity: busy ? 0.5 : 1 }} onClick={onArchive}>Archive</button>
    </>
  );
}
