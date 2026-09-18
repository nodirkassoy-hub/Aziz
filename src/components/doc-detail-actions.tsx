"use client";
/** Buttons & dialogs for a document page: issue, cancel, duplicate, credit note, record payment, delete. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Ban, Copy, MinusCircle, HandCoins, Trash2, Printer, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { api, useUI } from "@/components/ui";
import { Modal } from "@/components/kit";
import { fmtMoney, parseMoney, minorToInput } from "@/lib/money";
import { today } from "@/lib/dates";

export function DocActions({ doc, open, isSales, perms, banks, partyDocs }: any) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState("");
  const [menu, setMenu] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);

  async function act(name: string, extra: any = {}) {
    setBusy(name);
    const res = await api("/api/docs", { body: { action: name, id: doc.id, ...extra } });
    setBusy("");
    if (!res.ok) { toast("error", res.error ?? "Action failed."); return; }
    toast("success", res.toastText ?? "Done.");
    if (res.data?.to) router.push(`/app/${res.data.to === "sales_order" ? "sales/orders" : res.data.to === "invoice" ? "sales/invoices" : "purchases/bills"}/${res.data.id}`);
    else if (res.data?.id && (name === "duplicate" || name === "convert")) router.push(`/app/${isSales ? "sales" : "purchases"}/${routeOf(doc.kind)}/${res.data.id}`);
    else router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {doc.status === "draft" && (doc.kind === "quote" || doc.kind === "purchase_order" || doc.kind === "sales_order") && perms.post && (
          <button className="btn-primary" disabled={!!busy} onClick={() => act("issue")}><Send size={14} /> {doc.kind === "quote" ? "Mark as sent" : "Mark open"}</button>
        )}
        {doc.status === "draft" && (doc.kind === "invoice" || doc.kind === "bill") && perms.post && (
          <button className="btn-primary" disabled={!!busy} onClick={() => act("issue", { send_email: doc.kind === "invoice" })}><Send size={14} /> Issue &amp; post to ledger</button>
        )}
        {doc.status === "draft" && perms.edit && (
          <Link href={`/app/${isSales ? "sales" : "purchases"}/${routeOf(doc.kind)}/${doc.id}/edit`} className="btn-outline">Edit draft</Link>
        )}
        {doc.kind === "quote" && doc.status === "sent" && perms.create && (
          <>
            <button className="btn-primary" onClick={() => act("convert", { to: "sales_order" })}>→ Convert to order</button>
            <button className="btn-outline" onClick={() => act("convert", { to: "invoice" })}>→ Convert to invoice</button>
            <button className="btn-ghost" onClick={() => act("record_status", { status: "accepted" })}><CheckCircle2 size={14} /> Accepted</button>
            <button className="btn-ghost" onClick={() => act("record_status", { status: "declined" })}><Ban size={14} /> Declined</button>
          </>
        )}
        {doc.kind === "sales_order" && doc.status === "open" && perms.create && (
          <button className="btn-primary" onClick={() => act("convert", { to: "invoice" })}>→ Convert to invoice</button>
        )}
        {doc.kind === "purchase_order" && doc.status === "open" && perms.create && (
          <button className="btn-primary" onClick={() => act("convert", { to: "bill" })}>→ Convert to bill</button>
        )}
        {(doc.status === "sent" || doc.status === "partial" || doc.status === "overdue") && (open > 0) && (perms.pay || perms.payOut) && (
          <button className="btn-primary" onClick={() => setPayOpen(true)}><HandCoins size={14} /> Record payment</button>
        )}
        {doc.kind === "quote" && <Link href={`/app/sales/quotes/${doc.id}/edit`} className={`btn-outline ${doc.status !== "draft" ? "hidden" : ""}`}>Edit</Link>}
        <div className="relative">
          <button className="btn-outline" onClick={() => setMenu(m => !m)} aria-haspopup="menu"><MoreHorizontal size={15} /> More</button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 card-solid rounded-2xl p-1.5 w-56 shadow-glass-lg animate-scale-in">
                {perms.create && <MenuBtn onClick={() => { setMenu(false); act("duplicate"); }} icon={<Copy size={14} />}>Duplicate as new draft</MenuBtn>}
                {perms.cn && doc.kind === "invoice" && <MenuBtn onClick={() => { setMenu(false); setCnOpen(true); }} icon={<MinusCircle size={14} />} disabled={busy === "cn"}>Issue credit note</MenuBtn>}
                {perms.approve && doc.status !== "cancelled" && doc.status !== "draft" && (
                  <MenuBtn onClick={() => { setMenu(false); setCancelOpen(true); }} icon={<Ban size={14} />} danger>Cancel / void document</MenuBtn>
                )}
                <MenuBtn onClick={() => { setMenu(false); window.open(`/print/doc/${doc.id}`, "_blank"); }} icon={<Printer size={14} />}>Print / save PDF</MenuBtn>
                {perms.del && <MenuBtn onClick={() => { setMenu(false); act("delete").then(() => router.push(`/app/${isSales ? "sales" : "purchases"}/${routeOf(doc.kind)}`)); }} icon={<Trash2 size={14} />} danger>Delete draft</MenuBtn>}
              </div>
            </>
          )}
        </div>
      </div>

      <PayModal open={payOpen} onClose={() => setPayOpen(false)} doc={doc} outstanding={open} banks={banks} partyDocs={partyDocs} onDone={() => { setPayOpen(false); router.refresh(); }} />

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${doc.number}?`}>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          The document stays in history; a reversing journal entry is posted so the audit trail remains complete. This is only allowed for periods that aren&rsquo;t locked.
        </p>
        <label className="label">Reason (optional)</label>
        <form onSubmit={async (e: any) => { e.preventDefault(); await act("cancel", { reason: e.target.elements.reason.value }); setCancelOpen(false); }}>
          <input name="reason" className="input mb-4" placeholder="e.g. duplicate billing, customer request" />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCancelOpen(false)}>Keep document</button>
            <button className="btn-danger" disabled={!!busy}>{busy === "cancel" ? "Cancelling…" : "Cancel document"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={cnOpen} onClose={() => setCnOpen(false)} title={`Credit note for ${doc.number}`}>
        <CnForm doc={doc} open={open} onDone={() => { setCnOpen(false); router.refresh(); }} />
      </Modal>
    </>
  );
}
function MenuBtn({ children, icon, onClick, danger, disabled }: any) {
  return <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] ${danger ? "text-[var(--neg)] hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)]" : "hover:bg-[var(--accent-soft)]"}`}>{icon}{children}</button>;
}

export function PayModal({ open, onClose, doc, outstanding, banks, partyDocs, onDone }: any) {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(minorToInput(outstanding > 0 ? outstanding : 0, doc?.currency === "UZS" ? 0 : 2));
  const [account, setAccount] = useState(banks?.[0]?.id ?? "");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const docsForParty: any[] = partyDocs ?? (doc ? [doc] : []);

  async function submit() {
    setBusy(true);
    const parsed = parseMoney(amount);
    const allocations = docsForParty
      .map((d: any) => ({ doc_id: d.id, amount: alloc[d.id] !== undefined ? alloc[d.id] : (d.id === doc?.id ? parsed : 0) }))
      .filter((a: any) => a.amount > 0);
    const sum = allocations.reduce((s: number, a: any) => s + a.amount, 0);
    if (sum > parsed) { toast("error", "Allocations exceed the payment amount."); setBusy(false); return; }
    const res = await api("/api/payments", { body: { direction: doc && ["bill", "purchase_order"].includes(doc.kind) ? "out" : "in", party_id: doc?.party_id, date, amount: parsed, account_id: account, method, reference, allocations } });
    setBusy(false);
    if (!res.ok) { toast("error", res.error ?? "Could not record the payment."); return; }
    toast("success", res.toastText ?? "Payment recorded.");
    onDone();
  }
  return (
    <Modal open={open} onClose={onClose} title={doc && ["bill", "purchase_order"].includes(doc.kind) ? "Record supplier payment" : "Record payment received"}>
      {doc && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="label">Date</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">{doc && ["bill", "purchase_order"].includes(doc.kind) ? "Amount to pay" : "Amount received"}</label>
            <input className="input num" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div>
            <label className="label">{doc && ["bill", "purchase_order"].includes(doc.kind) ? "From account" : "Into account"}</label>
            <select className="input" value={account} onChange={e => setAccount(e.target.value)}>
              {banks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="label">Method</label>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
            </select></div>
          <div className="col-span-2"><label className="label">Reference (bank/POS no.)</label><input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="optional" /></div>
        </div>
      )}
      {docsForParty.length > 1 && (
        <div className="mb-4">
          <label className="label">Apply to open documents</label>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {docsForParty.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)" }}>
                <Link className="num text-xs font-semibold truncate" href={`/app/${d.kind === "bill" ? "purchases" : "sales"}/${d.kind === "bill" ? "bills" : "invoices"}/${d.id}`} target="_blank">{d.number}</Link>
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>{fmtMoney(d.outstanding ?? 0, d.currency ?? "UZS")} left</span>
                <input className="input num !w-28 !py-1 text-right ml-auto" inputMode="decimal" placeholder="0"
                  value={alloc[d.id] !== undefined ? minorToInput(alloc[d.id], (d.currency ?? "UZS") === "UZS" ? 0 : 2) : ""}
                  onChange={e => setAlloc(a => ({ ...a, [d.id]: parseMoney(e.target.value) }))} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 justify-between">
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>A balanced journal entry is created: bank/cash ↔ AR or AP.</span>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy || !account}>{busy ? "Recording…" : "Record payment"}</button>
        </div>
      </div>
    </Modal>
  );
}
function CnForm({ doc, open, onDone }: any) {
  const router = useRouter();
  const { toast } = useUI();
  const [desc, setDesc] = useState(`Adjustment for ${doc.number}`);
  const [amount, setAmount] = useState(minorToInput(Math.min(open, 1_000_00), doc.currency === "UZS" ? 0 : 2));
  const [taxOn, setTaxOn] = useState(true);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const res = await api("/api/docs", { body: {
      action: "create", kind: "credit_note", party_id: doc.party_id, date: today(), currency: doc.currency, fx_rate: doc.fx_rate,
      origin_doc_id: doc.id, notes: `Related to ${doc.number}`,
      items: [{ description: desc, qty: 1, unit_price: parseMoney(amount), discount_pct: 0, tax_pct: taxOn ? 12 : 0 }],
    } });
    setBusy(false);
    if (!res.ok) { toast("error", res.error!); return; }
    toast("success", res.toastText ?? "Credit note posted.");
    onDone(); router.refresh();
  }
  return (
    <>
      <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>Credit notes reduce the invoice immediately (reversing revenue and tax with a balanced entry). Maximum credit: <b className="num">{fmtMoney(open, doc.currency)}</b>.</p>
      <label className="label">Reason / description</label>
      <input className="input mb-3" value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="label">Amount (gross)</label><input className="input num" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <label className="flex items-end gap-2 pb-2 text-sm cursor-pointer"><input type="checkbox" checked={taxOn} onChange={e => setTaxOn(e.target.checked)} /> Include 12% tax</label>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post credit note"}</button>
      </div>
    </>
  );
}
function routeOf(kind: string) { return { invoice: "invoices", quote: "quotes", sales_order: "orders", bill: "bills", purchase_order: "purchase-orders", credit_note: "invoices" }[kind as string] ?? "invoices"; }
