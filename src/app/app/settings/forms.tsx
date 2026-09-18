"use client";
/* Client forms for the settings screens. One file, small named exports. */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Money } from "@/components/kit";
import { Check, Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";
import { minorToInput, parseMoney } from "@/lib/money";
import { today } from "@/lib/dates";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";

export function CompanyForm({ c }: { c: any }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({
    name: c.name ?? "", legal_name: c.legal_name ?? "", tax_id: c.tax_id ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "", website: c.website ?? "",
    bank_name: c.bank_name ?? "", bank_account_no: c.bank_account_no ?? "", bank_currency: c.bank_currency ?? "UZS",
    tax_authority: c.tax_authority ?? "", tax_registration: c.tax_registration ?? "",
    fiscal_year_start_month: String(c.fiscal_year_start_month ?? 1), payment_terms_days: String(c.payment_terms_days ?? 14),
    approval_expense_threshold: minorToInput(c.approval_expense_threshold ?? 0),
    invoice_notes: c.invoice_notes ?? "", invoice_terms: c.invoice_terms ?? "",
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const [logo, setLogo] = useState<{ id: number; name: string } | null>(c.logo_doc_id ? { id: c.logo_doc_id, name: "current logo" } : null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function uploadLogo(file: File) {
    const fd = new FormData(); fd.append("file", file); fd.append("kind", "logo"); fd.append("entity_kind", "company"); fd.append("entity_id", String(c.id));
    const r = await fetch("/api/files", { method: "POST", body: fd }); const d = await r.json();
    if (!r.ok) { ui.toast("error", d.error); return; }
    setLogo({ id: d.id, name: d.name }); ui.toast("success", "Logo uploaded — save settings to apply.");
  }
  async function save() {
    const d = await post("/api/settings", { scope: "company", ...f, logo_doc_id: logo?.id, approval_expense_threshold: parseFloat(f.approval_expense_threshold || "0") });
    if (d?.message) { ui.toast("success", d.message); router.refresh(); }
  }
  return (
    <div className="max-w-3xl space-y-4">
      <Form title="Identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trading name"><TextInput value={f.name} onChange={set("name")} /></Field>
          <Field label="Legal name" hint="printed on documents"><TextInput value={f.legal_name} onChange={set("legal_name")} /></Field>
          <Field label="TIN / registration no."><TextInput value={f.tax_id} onChange={set("tax_id")} /></Field>
          <Field label="Phone"><TextInput value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><TextInput value={f.email} onChange={set("email")} /></Field>
          <Field label="Website"><TextInput value={f.website} onChange={set("website")} placeholder="https://" /></Field>
          <Field label="Address" className="sm:col-span-2"><TextInput value={f.address} onChange={set("address")} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--accent-soft)" }}>
          {logo && <img src={`/api/files/${logo.id}`} alt="logo" className="h-9 max-w-[110px] rounded object-contain bg-white p-0.5" />}
          <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>{logo ? logo.name : "No logo — appears on invoices & quotes"}</span>
          <button className="btn-outline btn-sm ml-auto" onClick={() => fileRef.current?.click()}>Upload</button>
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) uploadLogo(x); }} />
        </div>
      </Form>
      <Form title="Banking & tax authority" desc="Printed in document footers; drives nothing on its own.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank name"><TextInput value={f.bank_name} onChange={set("bank_name")} /></Field>
          <Field label="Account number (IBAN)"><TextInput value={f.bank_account_no} onChange={set("bank_account_no")} /></Field>
          <Field label="Account currency"><Select value={f.bank_currency} onChange={set("bank_currency")} options={["UZS", "USD", "EUR", "RUB"]} /></Field>
          <Field label="Tax authority"><TextInput value={f.tax_authority} onChange={set("tax_authority")} placeholder="e.g. State Tax Committee — Chilonsoi district" /></Field>
          <Field label="Tax registration" className="sm:col-span-2"><TextInput value={f.tax_registration} onChange={set("tax_registration")} placeholder="certificate no / VAT registration" /></Field>
        </div>
      </Form>
      <Form title="Defaults">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fiscal year starts"><Select value={f.fiscal_year_start_month} onChange={set("fiscal_year_start_month")} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), label: new Date(2024, i, 1).toLocaleString("en-US", { month: "long" }) }))} /></Field>
          <Field label="Default payment terms (days)"><TextInput type="number" value={f.payment_terms_days} onChange={set("payment_terms_days")} /></Field>
          <Field label="Expense approval threshold" hint="expenses above it require sign-off"><TextInput inputMode="decimal" value={f.approval_expense_threshold} onChange={set("approval_expense_threshold")} /></Field>
          <Field label="Footer notes on documents" className="sm:col-span-2"><TextInput value={f.invoice_notes} onChange={set("invoice_notes")} /></Field>
          <Field label="Terms block" className="sm:col-span-3"><textarea className="input h-20" value={f.invoice_terms} onChange={set("invoice_terms")} /></Field>
        </div>
      </Form>
      <div className="flex items-center gap-3"><Submit busy={busy} onClick={save}>Save company settings</Submit><FormError /></div>
    </div>
  );
}

function Form({ title, desc, children }: any) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <h3 className="text-[14.5px] font-semibold">{title}</h3>
      {desc && <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DesignerForm({ c }: { c: any }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({ invoice_layout: c.invoice_layout || "classic", accent_color: c.accent_color || "#1a9e83", invoice_prefix: c.invoice_prefix || "INV", quote_prefix: c.quote_prefix || "QUO", bill_prefix: c.bill_prefix || "BILL" });
  const swatches = ["#1a9e83", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#059669", "#0f172a"];
  return (
    <div className="max-w-3xl space-y-4">
      <Form title="Document layout">
        <div className="grid gap-3 sm:grid-cols-3">
          {["classic", "modern", "minimal"].map(l => (
            <button key={l} className="rounded-xl border p-3 text-left capitalize" onClick={() => setF({ ...f, invoice_layout: l })}
              style={{ borderColor: f.invoice_layout === l ? "var(--accent)" : "var(--line)", background: f.invoice_layout === l ? "var(--accent-soft)" : "transparent" }}>
              <div className="mb-2 h-16 rounded bg-white p-1.5" style={{ boxShadow: "inset 0 0 0 1px #eee" }}>
                {l === "modern" && <div className="mb-1 h-1.5 rounded" style={{ background: f.accent_color }} />}
                <div className="mb-1 h-1 w-1/2 rounded" style={{ background: l === "minimal" ? "#111" : f.accent_color }} />
                <div className="space-y-0.5">{[0, 1, 2].map(i => <div key={i} className="h-1 rounded bg-gray-200" />)}</div>
              </div>
              <b className="text-[13px]">{l}</b><span className="block text-[11px]" style={{ color: "var(--muted)" }}>{l === "classic" ? "accent title, boxed totals" : l === "modern" ? "top colour band" : "black & white, printer friendly"}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium">Accent:</span>
          {swatches.map(sw => <button key={sw} className="h-7 w-7 rounded-full border-2" style={{ background: sw, borderColor: f.accent_color === sw ? "var(--text)" : "transparent" }} onClick={() => setF({ ...f, accent_color: sw })} />)}
          <input type="color" className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" value={f.accent_color} onChange={(e) => setF({ ...f, accent_color: e.target.value })} />
        </div>
      </Form>
      <Form title="Numbering prefixes" desc={`Sequence counters live in Settings → Accounting policy. Last printed: ${c.invoice_prefix}-…${c.next_invoice_no ? `#${String(c.next_invoice_no - 1).padStart(4, "0")}` : ""}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Invoice"><TextInput value={f.invoice_prefix} onChange={(e: any) => setF({ ...f, invoice_prefix: e.target.value })} /></Field>
          <Field label="Quote"><TextInput value={f.quote_prefix} onChange={(e: any) => setF({ ...f, quote_prefix: e.target.value })} /></Field>
          <Field label="Bill"><TextInput value={f.bill_prefix} onChange={(e: any) => setF({ ...f, bill_prefix: e.target.value })} /></Field>
        </div>
      </Form>
      <div className="flex items-center gap-3">
        <Submit busy={busy} onClick={async () => { const d = await post("/api/settings", { scope: "company", ...f }); if (d?.message) { ui.toast("success", d.message); router.refresh(); } }}>Save design</Submit>
        <Link className="link text-[12.5px]" href="/app/sales/invoices/new">open an invoice editor to see it live →</Link>
        <FormError />
      </div>
    </div>
  );
}

export function CurrencyForm({ c, rates }: { c: any; rates: any[] }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [from, setFrom] = useState("USD");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(today());
  return (
    <div className="max-w-3xl space-y-4">
      <Form title="Base currency" desc="Ledger + reports are kept in this currency. Changing it does not restate historical postings.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Base currency"><Select value={c.base_currency} onChange={(e: any) => e.target.value && postBase(e.target.value)} options={[...new Set([c.base_currency, "UZS", "USD", "EUR", "RUB", "KZT"])]} /></Field>
          <p className="max-w-sm text-[11.5px]" style={{ color: "var(--muted)" }}>Only change this if you are actually moving books — documents keep their own currency.</p>
        </div>
      </Form>
      <Form title="Exchange rates" desc="Manual rates (the only source that never surprises you). Documents convert at the rate recorded on their date; missing rate → today’s latest.">
        <div className="mb-3 grid gap-2 sm:grid-cols-[auto_auto_auto_1fr] sm:items-end">
          <Field label="From"><Select value={from} onChange={(e: any) => setFrom(e.target.value)} options={["USD", "EUR", "RUB", "KZT", "CNY"].filter(x => x !== c.base_currency)} /></Field>
          <Field label="To"><TextInput value={c.base_currency} disabled /></Field>
          <Field label="Date"><TextInput type="date" value={date} max={today()} onChange={(e: any) => setDate(e.target.value)} /></Field>
          <div className="flex items-end gap-2">
            <Field label={`Rate (1 ${from} = ? ${c.base_currency})`} className="flex-1"><TextInput inputMode="decimal" value={rate} onChange={(e: any) => setRate(e.target.value)} placeholder="12 600" /></Field>
            <Submit busy={busy} onClick={async () => {
              if (!rate) { ui.toast("error", "Enter a rate."); return; }
              const d = await post("/api/settings", { scope: "currencies", action: "rate", from_currency: from, to_currency: c.base_currency, rate: parseFloat(rate), date });
              if (d?.message) { ui.toast("success", d.message); setRate(""); router.refresh(); }
            }}>Save</Submit>
          </div>
        </div>
        <table className="tbl w-full text-left text-[12.5px]">
          <thead><tr className="text-[11px] uppercase" style={{ color: "var(--muted)" }}><th className="py-1.5 font-medium">Date</th><th className="py-1.5 font-medium">Pair</th><th className="py-1.5 text-right font-medium">Rate</th><th className="py-1.5 text-right font-medium">Source</th></tr></thead>
          <tbody>{rates.map((r: any) => (
            <tr key={r.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="num py-1.5">{r.date}</td><td className="py-1.5 font-semibold">{r.from_currency}→{r.to_currency}</td>
              <td className="num py-1.5 text-right">{r.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
              <td className="py-1.5 text-right text-[11px]" style={{ color: "var(--muted)" }}>{r.source}</td>
            </tr>))}
            {rates.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-[12.5px]" style={{ color: "var(--muted)" }}>No rates yet — add one above.</td></tr>}</tbody>
        </table>
      </Form>
      <FormError />
    </div>
  );
  async function postBase(cur: string) {
    if (!confirm(`Set base currency to ${cur}? Historical postings keep their recorded base amounts.`)) return;
    const d = await post("/api/settings", { scope: "currencies", action: "base", base_currency: cur });
    if (d?.message) { ui.toast("success", d.message); router.refresh(); }
  }
}

export function TaxesClient({ rates, jurisdiction }: { rates: any[]; jurisdiction: string | null }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [edit, setEdit] = useState<any>(null);
  const blank = { id: 0, name: "", rate_pct: "12", kind: "output_input", applies: "both", is_default: false, jurisdiction: jurisdiction ?? "" };
  const [f, setF] = useState<any>(blank);
  const open = (r?: any) => { setEdit(r ?? blank); setF(r ? { ...r, jurisdiction: r.jurisdiction ?? "" } : { ...blank }); };
  return (
    <>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[13px]">
          <thead><tr className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 text-right font-medium">Rate</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Applies</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Kind</th><th className="px-4 py-2.5" /></tr></thead>
          <tbody>
            {rates.map((r: any) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--line)", opacity: r.archived ? 0.5 : 1 }}>
                <td className="px-4 py-2 font-medium">{r.name}{r.is_default ? <span className="chip chip-good ml-2 !py-0 text-[10px]">default</span> : null}{r.archived ? <span className="chip ml-2 !py-0 text-[10px]">archived</span> : null}</td>
                <td className="num px-4 py-2 text-right font-semibold">{r.rate_pct}%</td>
                <td className="hidden px-4 py-2 text-[12px] capitalize sm:table-cell" style={{ color: "var(--muted)" }}>{r.applies}</td>
                <td className="hidden px-4 py-2 text-[12px] md:table-cell" style={{ color: "var(--muted)" }}>{r.kind === "output_input" ? "output & input" : r.kind === "withholding" ? "withholding" : "informational"}</td>
                <td className="px-4 py-2 text-right"><button className="btn-ghost btn-sm" onClick={() => open(r)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => open()}><Plus size={14} /> New rate</button>
        <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>Taxes are configured to match your jurisdiction’s rules — Mizom applies what you set, it does not decide legality for you.</p>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={f.id ? `Edit ${f.name}` : "New tax rate"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} placeholder="VAT" /></Field>
          <Field label="Rate %"><TextInput inputMode="decimal" value={String(f.rate_pct)} onChange={(e: any) => setF({ ...f, rate_pct: e.target.value })} /></Field>
          <Field label="Applies to"><Select value={f.applies} onChange={(e: any) => setF({ ...f, applies: e.target.value })} options={[["both", "Sales & purchases"], ["sales", "Sales (output)"], ["purchases", "Purchases (input)"]].map(([v, l]) => ({ v, label: l }))} /></Field>
          <Field label="Kind" hint="withholding taxes sit in their own bucket in reports"><Select value={f.kind} onChange={(e: any) => setF({ ...f, kind: e.target.value })} options={[["output_input", "output & input"], ["withholding", "withholding"], ["none", "informational"]].map(([v, l]) => ({ v, label: l }))} /></Field>
          <Field label="Jurisdiction note"><TextInput value={f.jurisdiction ?? ""} onChange={(e: any) => setF({ ...f, jurisdiction: e.target.value })} placeholder="e.g. Uzbekistan" /></Field>
          <Check label="Default rate for new document lines" checked={f.is_default} onChange={(e: any) => setF({ ...f, is_default: e.target.checked })} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Submit busy={busy} onClick={async () => {
            const d = await post("/api/settings", { scope: "taxes", id: f.id || undefined, name: f.name, rate_pct: parseFloat(f.rate_pct), kind: f.kind, applies: f.applies, is_default: f.is_default, jurisdiction: f.jurisdiction || null });
            if (d?.message) { ui.toast("success", d.message); setEdit(null); router.refresh(); }
          }}>{f.id ? "Save" : "Create"}</Submit>
          {!!f.id && (
            <button className="btn-ghost btn-sm ml-auto" style={{ color: "var(--neg)" }} onClick={async () => {
              const d = await post("/api/settings", { scope: "taxes", action: f.archived ? "archive" : "archive", id: f.id, archived: f.archived ? 0 : 1 });
              if (d?.message) { ui.toast("success", d.message); setEdit(null); router.refresh(); }
            }}>{f.archived ? "Unarchive" : "Archive"}</button>)}
        </div>
        <FormError />
      </Modal>
    </>
  );
}

export function AccountingClient({ c, locks }: { c: any; locks: any[] }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [n, setN] = useState({
    next_invoice_no: String(c.next_invoice_no ?? 1), next_quote_no: String(c.next_quote_no ?? 1), next_bill_no: String(c.next_bill_no ?? 1),
    next_order_no: String(c.next_order_no ?? 1), next_po_no: String(c.next_po_no ?? 1), next_je_no: String(c.next_je_no ?? 1), next_payment_no: String(c.next_payment_no ?? 1),
    lock_date: c.lock_date ?? "",
  });
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [note, setNote] = useState("");
  const lockState: Record<string, string> = Object.fromEntries(locks.map((l: any) => [l.period, l.status]));
  const doLock = async (status: "closed" | "locked" | "open") => {
    const d = await post("/api/settings", { scope: "accounting", action: "lock", period, status, note: note || null });
    if (d?.message) { ui.toast("success", d.message); setNote(""); router.refresh(); }
  };
  return (
    <div className="max-w-3xl space-y-4">
      <Form title="Number sequences" desc="Next number each prefix will use. Gaps are fine — corrections happen; the counter may only move forward through this UI.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["next_invoice_no", "Invoices"], ["next_quote_no", "Quotes"], ["next_bill_no", "Bills"], ["next_order_no", "Sales orders"], ["next_po_no", "Purchase orders"], ["next_je_no", "Journal entries"], ["next_payment_no", "Payments"]].map(([k, label]) => (
            <Field key={k} label={label}><TextInput type="number" min={1} value={(n as any)[k]} onChange={(e: any) => setN({ ...n, [k]: e.target.value })} /></Field>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Submit busy={busy} onClick={async () => {
            const d = await post("/api/settings", { scope: "accounting", ...Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === "lock_date" ? v : +v])) });
            if (d?.message) { ui.toast("success", d.message); router.refresh(); }
          }}>Save counters</Submit>
          <FormError />
        </div>
      </Form>
      <Form title="Period closing & locks" desc="Locking a period blocks new postings with earlier dates. Owners/CFOs/chief accountants only.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Period"><TextInput type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} /></Field>
          <Field label="Note (kept in the audit log)" className="sm:col-span-2"><TextInput value={note} onChange={(e: any) => setNote(e.target.value)} placeholder="e.g. bank statement 2026-09-30 attached" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Submit busy={busy} onClick={() => doLock("closed")}>Close period</Submit>
          <Submit danger busy={busy} onClick={() => doLock("locked")}>Lock</Submit>
          <button className="btn-outline btn-sm" disabled={busy} onClick={() => doLock("open")}>Re-open</button>
          <span className="text-[12px] num" style={{ color: "var(--muted)" }}>{period}: <b>{lockState[period] ?? "open"}</b></span>
        </div>
        {locks.length > 0 && (
          <table className="tbl mt-3 w-full text-left text-[12.5px]">
            <thead><tr className="text-[11px] uppercase" style={{ color: "var(--muted)" }}><th className="py-1.5 pr-3 font-medium">Period</th><th className="py-1.5 pr-3 font-medium">Status</th><th className="py-1.5 font-medium">Note</th></tr></thead>
            <tbody>{locks.map((l: any) => (
              <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="num py-1.5 pr-3">{l.period}</td>
                <td className="py-1.5 pr-3"><span className={`chip ${l.status === "open" ? "chip-good" : l.status === "closed" ? "chip-info" : "chip-warn"}`}>{l.status}</span></td>
                <td className="py-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>{l.note ?? "—"}</td>
              </tr>))}</tbody>
          </table>)}
      </Form>
    </div>
  );
}

export function UsersClient({ members, roles, me }: { members: any[]; roles: Record<string, any>; me: number }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [invite, setInvite] = useState(false);
  const [f, setF] = useState({ email: "", name: "", role: "accountant" });
  const [temp, setTemp] = useState<string | null>(null);
  return (
    <div className="max-w-3xl space-y-4">
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[13px]">
          <thead><tr className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">Member</th><th className="px-4 py-2.5 font-medium">Role</th><th className="px-4 py-2.5" /></tr></thead>
          <tbody>
            {members.map((m: any) => (
              <tr key={m.user_id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="px-4 py-2.5"><div className="font-semibold">{m.name}{m.user_id === me && <span className="chip chip-info ml-2 !py-0 text-[10px]">you</span>}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{m.email}</div></td>
                <td className="px-4 py-2.5">
                  <select className="input !w-44 !py-1 text-[12.5px]" value={m.role} disabled={busy}
                    onChange={async (e) => { const d = await post("/api/settings", { scope: "users", action: "set_role", user_id: m.user_id, role: e.target.value }); if (d?.message) { ui.toast("success", d.message); router.refresh(); } }}>
                    {Object.entries(roles).map(([code, r]: any) => <option key={code} value={code}>{(r as any).label}</option>)}
                  </select>
                  <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--muted)" }}>{roles[m.role]?.desc}</div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {m.user_id !== me && <button className="btn-ghost btn-sm !px-2" style={{ color: "var(--neg)" }} onClick={async () => {
                    if (!confirm(`Remove ${m.name} from this company?`)) return;
                    const d = await post("/api/settings", { scope: "users", action: "remove", user_id: m.user_id });
                    if (d?.message) { ui.toast("success", d.message); router.refresh(); }
                  }}><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary btn-sm" onClick={() => setInvite(true)}>Invite member</button>
        <FormError />
      </div>
      <Modal open={invite} onClose={() => { setInvite(false); setTemp(null); }} title="Invite a team member">
        {temp ? (
          <div className="space-y-3">
            <p className="text-[13.5px]">Account created. This deployment has <b>no email provider</b>, so share the temporary password yourself — they should change it under Profile right after signing in.</p>
            <div className="num rounded-xl px-3.5 py-3 text-[15px] font-bold" style={{ background: "var(--accent-soft)" }}>{temp}</div>
            <button className="btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(temp); ui.toast("success", "Copied."); }}>Copy password</button>
            <div><button className="btn-primary btn-sm" onClick={() => { setInvite(false); setTemp(null); router.refresh(); }}>Done</button></div>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <Field label="Email"><TextInput value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} placeholder="colleague@company.uz" /></Field>
              <Field label="Name"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Role"><Select value={f.role} onChange={(e: any) => setF({ ...f, role: e.target.value })} options={Object.entries(roles).map(([code, r]: any) => ({ v: code, label: `${(r as any).label} — ${(r as any).desc}` }))} /></Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Submit busy={busy} onClick={async () => {
                const d = await post("/api/settings", { scope: "users", action: "invite", ...f });
                if (d?.temp_password) { setTemp(d.temp_password); ui.toast("success", d.message); }
              }}>Invite</Submit>
              <button className="btn-outline" onClick={() => setInvite(false)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export function NotifClient({ kinds, current }: { kinds: string[]; current: Record<string, boolean> }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [p, setP] = useState<Record<string, boolean>>(Object.fromEntries(kinds.map(k => [k, current[k] !== false])));
  const LABELS: Record<string, string> = {
    invoice_overdue: "Invoice overdue", upcoming_bills: "Bills due within 14 days", approval: "Expense awaiting approval", approval_decision: "Approval decisions",
    reconciliation: "Bank lines to review", low_cash: "Low cash warning", tax_deadline: "Tax deadline", period_close: "Period closing reminder",
    payment_received: "Payment received", document_sent: "Document sent", recon: "Reconciliation events", invoice_issued: "Invoices issued",
  };
  return (
    <div className="glass max-w-xl rounded-2xl p-4 sm:p-5">
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Which alerts land in your bell (top-right). The red strip in the app and dashboard cards always reflect your data — these only tune notifications.</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {kinds.map(k => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--accent-soft)]">
            <input type="checkbox" className="accent-[var(--accent)]" checked={p[k] !== false} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />
            {LABELS[k] ?? k.replace(/_/g, " ")}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Submit busy={busy} onClick={async () => { const d = await post("/api/settings", { scope: "notifications", prefs: p }); if (d?.message) { ui.toast("success", d.message); router.refresh(); } }}>Save preferences</Submit>
        <FormError />
      </div>
    </div>
  );
}

export function SecurityClient({ user, sessions }: { user: any; sessions: any[] }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [twofa, setTwofa] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  return (
    <div className="max-w-2xl space-y-4">
      <Form title="Two-factor authentication" desc="TOTP (Google Authenticator, 1Password, Aegis…). Time-based 6-digit codes.">
        {user.twofa_enabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip chip-good inline-flex items-center gap-1"><ShieldCheck size={12} /> enabled</span>
            <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>Codes are required at sign-in.</span>
            <div className="ml-auto flex items-center gap-2">
              <TextInput className="!w-28" placeholder="code" value={code} onChange={(e: any) => setCode(e.target.value)} />
              <Submit danger busy={busy} onClick={async () => {
                const d = await post("/api/settings", { scope: "security", action: "2fa_disable", code });
                if (d?.message) { ui.toast("success", d.message); setCode(""); router.refresh(); }
              }}>Disable</Submit>
            </div>
          </div>
        ) : twofa ? (
          <div className="space-y-3">
            <p className="text-[13px]">Add this secret to your authenticator (scan not rendered here — paste manually), then confirm with a code:</p>
            <div className="rounded-xl p-3 text-[12px]" style={{ background: "var(--accent-soft)" }}>
              <div className="num break-all font-bold tracking-wide">{twofa.secret}</div>
              <div className="mt-1 break-all text-[10.5px]" style={{ color: "var(--muted)" }}>{twofa.otpauth}</div>
            </div>
            <div className="flex items-center gap-2">
              <TextInput className="!w-32" placeholder="6-digit code" value={code} onChange={(e: any) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <Submit busy={busy} onClick={async () => {
                const d = await post("/api/settings", { scope: "security", action: "2fa_enable", code });
                if (d?.message) { ui.toast("success", d.message); setTwofa(null); router.refresh(); }
              }}>Verify & enable</Submit>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Off — your password is the only gate.</p>
            <Submit busy={busy} className="ml-auto" onClick={async () => {
              const d = await post("/api/settings", { scope: "security", action: "2fa_enable" });
              if (d?.secret) setTwofa({ secret: d.secret, otpauth: d.otpauth });
            }}>Set up 2FA</Submit>
          </div>
        )}
        <FormError />
      </Form>
      <Form title="Active sessions" desc="This browser is marked. Revoking signs out everything else immediately.">
        <div className="space-y-1.5">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px]" style={{ background: s.current ? "var(--accent-soft)" : "transparent" }}>
              <span className="font-medium">{s.device ?? "unknown device"}</span>
              {s.ip && <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{s.ip}</span>}
              <span className="ml-auto num text-[11px]" style={{ color: "var(--muted)" }}>since {s.created_at?.slice(0, 16).replace("T", " ")} · expires {s.expires_at?.slice(0, 10)}</span>
              {s.current && <span className="chip chip-info !py-0 text-[10px]">current</span>}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Submit danger busy={busy} onClick={async () => {
            if (!confirm("Sign out all other devices?")) return;
            const d = await post("/api/settings", { scope: "security", action: "revoke_sessions" });
            if (d?.message) { ui.toast("success", d.message); router.refresh(); }
          }}>Revoke other sessions</Submit>
        </div>
      </Form>
    </div>
  );
}

export function ProfileForm({ user }: { user: any }) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({ name: user.name ?? "", email: user.email ?? "", current_password: "", new_password: "", new_password2: "" });
  return (
    <div className="glass max-w-lg rounded-2xl p-4 sm:p-5">
      <div className="grid gap-3">
        <Field label="Name"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} /></Field>
        <div className="mt-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <div className="mb-2 text-[13px] font-semibold">Change password</div>
          <div className="grid gap-3">
            <Field label="Current password"><TextInput type="password" value={f.current_password} onChange={(e: any) => setF({ ...f, current_password: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" hint="min 8 characters"><TextInput type="password" value={f.new_password} onChange={(e: any) => setF({ ...f, new_password: e.target.value })} /></Field>
              <Field label="Repeat new"><TextInput type="password" value={f.new_password2} onChange={(e: any) => setF({ ...f, new_password2: e.target.value })} /></Field>
            </div>
          </div>
        </div>
        <Submit busy={busy} onClick={async () => {
          if (f.new_password && f.new_password !== f.new_password2) { ui.toast("error", "New passwords don’t match."); return; }
          const d = await post("/api/settings", { scope: "profile", name: f.name, email: f.email, ...(f.new_password ? { current_password: f.current_password, new_password: f.new_password } : {}) });
          if (d?.message) { ui.toast("success", d.message); setF({ ...f, current_password: "", new_password: "", new_password2: "" }); router.refresh(); }
        }}>Save profile</Submit>
        <FormError />
      </div>
    </div>
  );
}
