"use client";
/** Create/edit screen for quotes, sales orders, invoices, purchase orders and bills. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Eye, PencilLine, Send } from "lucide-react";
import { api, useUI } from "@/components/ui";
import { DocPaper, type PreviewDoc } from "@/components/doc-preview";
import { fmtMoney, parseMoney, minorToInput } from "@/lib/money";
import { today, addDays } from "@/lib/dates";

export type { EditorItem, EditorState } from "@/lib/doc-state";
import type { EditorItem, EditorState } from "@/lib/doc-state";

export function DocEditor({ state, setState, parties, taxRates, accounts, company, canPost, onSaved }: {
  state: EditorState; setState: (s: EditorState | ((p: EditorState) => EditorState)) => void;
  parties: { id: number; name: string; currency?: string }[];
  taxRates: { id: number; name: string; rate_pct: number; applies: string }[];
  accounts: { id: number; code: string; name: string }[];
  company: PreviewDoc["company"] & { base_currency: string; payment_terms_days: number };
  canPost: boolean; onSaved?: () => void;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState<"" | "draft" | "issue">("");
  const [tab, setTab] = useState<"form" | "preview">(typeof window !== "undefined" && window.innerWidth < 1024 ? "form" : "form");
  const [sendEmail, setSendEmail] = useState(true);
  const isSales = state.kind !== "bill" && state.kind !== "purchase_order";
  const defaultTax = taxRates.find(t => taxRates.length === 1 ? true : t.applies === (isSales ? "sales" : "purchases") || t.applies === "both")?.rate_pct ?? 0;

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0;
    for (const it of state.items) {
      const gross = Math.round((+it.qty || 0) * (+it.unit_price || 0));
      const disc = Math.round(gross * ((+it.discount_pct || 0) / 100));
      const net = gross - disc;
      subtotal += net; discount += disc; tax += Math.round(net * ((+it.tax_pct || 0) / 100));
    }
    return { subtotal, discount, tax, total: subtotal + tax };
  }, [state.items]);

  function set<K extends keyof EditorState>(k: K, v: EditorState[K]) { setState(s => ({ ...s, [k]: v })); }
  function setItem(i: number, patch: Partial<EditorItem>) { setState(s => ({ ...s, items: s.items.map((x, j) => j === i ? { ...x, ...patch } : x) })); }
  function addItem() { setState(s => ({ ...s, items: [...s.items, { description: "", qty: 1, unit_price: 0, discount_pct: 0, tax_pct: defaultTax }] })); }

  async function save(action: "create" | "update" | "issue") {
    setBusy(action === "issue" ? "issue" : "draft");
    const payload: any = {
      action: state.docId ? (action === "issue" ? "issue" : "update") : action === "issue" ? "issue" : "create",
      kind: state.kind, id: state.docId,
      party_id: state.party_id, date: state.date, due_date: state.due_date,
      currency: state.currency, fx_rate: state.fx_rate,
      notes: state.notes, terms: state.terms, items: state.items, send_email: action === "issue" ? sendEmail : undefined,
    };
    if (payload.action === "issue" && state.docId) {
      // save first, then issue
      const first = await api("/api/docs", { body: { ...payload, action: "update" } });
      if (!first.ok) { setBusy(""); toast("error", first.error!); return; }
    }
    const res = await api("/api/docs", { body: payload });
    setBusy("");
    if (!res.ok) { toast("error", res.error ?? "Unable to save. Please try again."); return; }
    if (action === "issue" && !state.docId) {
      // created draft -> issue it now
      const iss = await api("/api/docs", { body: { action: "issue", id: res.data.id } });
      if (!iss.ok) { toast("warn", `Draft saved, but issuing failed: ${iss.error}`); router.push(`/app/${isSales ? "sales" : "purchases"}/${routeOf(state.kind)}/${res.data.id}`); return; }
      toast("success", iss.data.message ?? "Issued & posted.");
    } else toast("success", res.toastText ?? "Saved.");
    onSaved?.();
    if (res.data?.id) router.push(`/app/${isSales ? "sales" : "purchases"}/${routeOf(state.kind)}/${res.data.id}`);
    else if (state.docId) router.push(`/app/${isSales ? "sales" : "purchases"}/${routeOf(state.kind)}/${state.docId}`);
    router.refresh();
  }

  const partyObj = parties.find(p => p.id === +state.party_id);
  const preview: PreviewDoc = {
    company,
    kind: state.kind, number: state.number ?? "(draft)", status: state.status,
    customer: isSales && partyObj ? { name: partyObj.name } : null,
    supplier: !isSales && partyObj ? { name: partyObj.name } : null,
    date: state.date, due_date: state.due_date, currency: state.currency, fx_rate: state.fx_rate,
    items: state.items.map(it => {
      const gross = Math.round((+it.qty || 0) * (+it.unit_price || 0));
      const disc = Math.round(gross * ((+it.discount_pct || 0) / 100));
      const net = gross - disc;
      return { description: it.description || "—", qty: +it.qty || 0, unit_price: +it.unit_price || 0, discount_pct: +it.discount_pct || 0, tax_pct: +it.tax_pct || 0, amount: net, tax_amount: Math.round(net * ((+it.tax_pct || 0) / 100)) };
    }),
    subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total,
    notes: state.notes, terms: state.terms,
  };

  return (
    <div>
      {/* mobile tabs */}
      <div className="lg:hidden mb-4 flex gap-1 rounded-xl p-1 glass-2" style={{ border: "1px solid var(--line)" }}>
        <button className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === "form" ? "card-solid" : "opacity-60"}`} onClick={() => setTab("form")}><PencilLine size={13} className="inline mr-1" />Details</button>
        <button className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === "preview" ? "card-solid" : "opacity-60"}`} onClick={() => setTab("preview")}><Eye size={13} className="inline mr-1" />Live preview</button>
      </div>
      <div className="grid lg:grid-cols-[1fr_minmax(360px,460px)] gap-5 items-start">
        <div className={`space-y-4 ${tab !== "form" ? "hidden lg:block" : ""}`}>
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label">{isSales ? "Customer" : "Supplier"} *</label>
                <select className="input" value={state.party_id} onChange={e => {
                  const p = parties.find(x => x.id === +e.target.value);
                  setState(s => ({ ...s, party_id: +e.target.value || "", currency: state.kind === "bill" || state.kind === "purchase_order" ? company.base_currency : (p?.currency && p.currency !== company.base_currency ? p.currency : s.currency) }));
                }}>
                  <option value="">Choose {isSales ? "customer" : "supplier"}…</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}{p.currency && p.currency !== company.base_currency ? ` (${p.currency})` : ""}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div><label className="label">Issue date</label><input type="date" className="input" value={state.date} onChange={e => set("date", e.target.value)} /></div>
                <div><label className="label">Due date</label><input type="date" className="input" value={state.due_date} onChange={e => set("due_date", e.target.value)} /></div>
              </div>
            </div>
            {(!isSales || partyObj?.currency === "USD") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="label">Currency</label>
                  <select className="input" value={state.currency} onChange={e => set("currency", e.target.value)}>
                    {[company.base_currency, ...(state.currency === company.base_currency ? [] : [state.currency]), "USD"].filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {state.currency !== company.base_currency && (
                  <div className="sm:col-span-2">
                    <label className="label">1 {state.currency} → {company.base_currency} rate</label>
                    <input className="input num" inputMode="decimal" value={state.fx_rate} onChange={e => set("fx_rate", +e.target.value || 0)} />
                  </div>
                )}
                <div className="col-span-2 sm:col-span-1 text-[11px] pt-6" style={{ color: "var(--faint)" }}>
                  Base total: <b className="num">{fmtMoney(Math.round(totals.total * (state.fx_rate || 1)), company.base_currency)}</b>
                </div>
              </div>
            )}
          </div>

          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Line items</h3>
              <button className="btn-outline btn-sm" onClick={addItem}><Plus size={13} /> Add line</button>
            </div>
            <div className="space-y-2.5">
              {state.items.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "var(--faint)" }}>No lines yet — add your first item.</p>}
              {state.items.map((it, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: "var(--line)" }}>
                  <div className="flex gap-2 items-start">
                    <input className="input flex-1" placeholder="Item / service description" value={it.description} onChange={e => setItem(i, { description: e.target.value })} />
                    <button aria-label={`Remove line ${i + 1}`} className="btn-icon !text-[var(--neg)] shrink-0" onClick={() => setState(s => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div><label className="label !text-[10px]">Qty</label><input className="input num" inputMode="decimal" value={it.qty} onChange={e => setItem(i, { qty: +e.target.value || 0 })} /></div>
                    <div><label className="label !text-[10px]">Unit price</label><input className="input num" inputMode="decimal" value={minorToInput(it.unit_price, currencyDecimalsOf(state.currency))} onChange={e => setItem(i, { unit_price: parseMoney(e.target.value) })} /></div>
                    <div><label className="label !text-[10px]">Disc. %</label><input className="input num" inputMode="decimal" value={it.discount_pct} onChange={e => setItem(i, { discount_pct: +e.target.value || 0 })} /></div>
                    <div>
                      <label className="label !text-[10px]">Tax</label>
                      <select className="input" value={it.tax_pct} onChange={e => { const pct = +e.target.value; const r = taxRates.find(t => t.rate_pct === pct); setItem(i, { tax_pct: pct, tax_rate_id: r?.id ?? null }); }}>
                        <option value={0}>No tax</option>
                        {[...new Set(taxRates.map(t => t.rate_pct))].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  {!isSales && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="label !text-[10px]">Expense account</label>
                        <select className="input" value={it.account_id ?? ""} onChange={e => setItem(i, { account_id: e.target.value ? +e.target.value : null })}>
                          <option value="">Auto (Uncategorized)</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="text-right text-xs num" style={{ color: "var(--muted)" }}>{fmtMoney(Math.round((it.qty || 0) * (it.unit_price || 0) * (1 - (it.discount_pct || 0) / 100)), state.currency)}{it.tax_pct ? ` + ${fmtMoney(Math.round((it.qty || 0) * it.unit_price * (1 - it.discount_pct / 100) * it.tax_pct / 100), state.currency)} tax` : ""}</div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5 mt-4">
              <div><label className="label">Notes (shown on document)</label><textarea className="input" rows={2} value={state.notes} onChange={e => set("notes", e.target.value)} /></div>
              <div><label className="label">Payment terms</label><textarea className="input" rows={2} value={state.terms} onChange={e => set("terms", e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* preview */}
        <div className={`${tab !== "preview" ? "hidden lg:block" : ""} lg:sticky lg:top-20`}>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--line)" }}>
            <div className="px-4 py-2.5 flex items-center justify-between text-xs font-semibold border-b" style={{ background: "var(--panel-solid)", borderColor: "var(--line)" }}>
              <span className="flex items-center gap-1.5"><Eye size={13} style={{ color: "var(--accent)" }} /> Live preview</span>
              <span className="chip">updates as you type</span>
            </div>
            <div className="p-3" style={{ background: "var(--panel-2)" }}>
              <div className="rounded-xl overflow-hidden bg-white text-[10px] shadow-lg origin-top scale-[.98]" style={{ color: "#111" }}>
                <DocPaper doc={preview} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* action bar */}
      <div className="sticky bottom-3 mt-5 z-30">
        <div className="card-solid flex flex-wrap items-center gap-2 p-3 shadow-glass-lg">
          <div className="flex-1 min-w-[130px] text-xs px-1">
            Totals: <b className="num">{fmtMoney(totals.total, state.currency)}</b>
            {state.currency !== company.base_currency && <span className="ml-1" style={{ color: "var(--faint)" }}>(≈ {fmtMoney(Math.round(totals.total * (state.fx_rate || 1)), company.base_currency)})</span>}
          </div>
          {state.status === "draft" || !state.docId ? (
            <>
              <button className="btn-outline" onClick={() => save(state.docId ? "update" : "create")} disabled={!!busy || !state.party_id || !state.items.length}>
                {busy === "draft" ? "Saving…" : state.docId ? "Save draft" : "Save as draft"}
              </button>
              {canPost && (
                <button className="btn-primary" onClick={() => save("issue")} disabled={!!busy || !state.party_id || !state.items.length}>
                  {busy === "issue" ? "Issuing…" : <>Issue {state.kind === "quote" ? "& send" : "& post"} <Send size={13} /></>}
                </button>
              )}
            </>
          ) : (
            <span className="text-xs" style={{ color: "var(--muted)" }}>This document is {state.status} — posted documents can't be edited. Use <b>Cancel</b> or a <b>credit note</b> on the document page instead.</span>
          )}
          {state.docId && <Link className="btn-ghost ml-auto" href={`/app/${isSales ? "sales" : "purchases"}/${routeOf(state.kind)}/${state.docId}`}>Back to document</Link>}
        </div>
        {state.kind === "invoice" && !isSales && null}
        {canPost && state.kind === "invoice" && (
          <label className="mt-2 flex items-center gap-2 text-xs px-2" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} /> Log &amp; send to customer contact on issue <span className="opacity-60">(demo mailer — delivery logged, provider not connected)</span>
          </label>
        )}
      </div>
    </div>
  );
}
function currencyDecimalsOf(c: string) { return c === "UZS" ? 0 : 2; }
export function routeOf(kind: string) { return { invoice: "invoices", quote: "quotes", sales_order: "orders", bill: "bills", purchase_order: "purchase-orders", credit_note: "invoices" }[kind] ?? "invoices"; }
export { makeNewState } from "@/lib/doc-state";
