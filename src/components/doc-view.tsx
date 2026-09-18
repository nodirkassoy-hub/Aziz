import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { StatusBadge } from "@/components/kit";
import { DocPaper } from "@/components/doc-preview";
import { DocActions } from "@/components/doc-detail-actions";
import { fmtMoney } from "@/lib/money";
import { fmtDate, today, daysBetween } from "@/lib/dates";
import { all } from "@/lib/db";

export function DocView({ user, doc, items, party, isSales, payments, origin, children, creditNotes, open, je, perms, company, files, banks, partyDocs, backHref }: any) {
  const late = doc.due_date && doc.due_date < today() && open > 0 && doc.status !== "draft" && doc.status !== "cancelled";
  const preview = {
    company, kind: doc.kind, number: doc.number, status: doc.status,
    customer: isSales ? party : null, supplier: !isSales ? party : null,
    date: doc.date, due_date: doc.due_date, currency: doc.currency, fx_rate: doc.fx_rate,
    items: items.map((i: any) => ({ description: i.description, qty: i.qty, unit_price: i.unit_price, discount_pct: i.discount_pct, tax_pct: i.tax_pct, amount: i.amount, tax_amount: i.tax_amount })),
    subtotal: doc.subtotal, discount: doc.discount, tax: doc.tax, total: doc.total, paid: doc.currency === user.company.base_currency ? doc.paid : Math.round((doc.paid * doc.total) / (doc.total_base || 1)),
    notes: doc.notes, terms: doc.terms,
  };
  const auditRows = all<any>(`SELECT * FROM audit_log WHERE company_id=? AND entity_kind=? AND entity_id=? ORDER BY created_at DESC LIMIT 8`, doc.company_id, doc.kind, doc.id);
  return (
    <>
      <div className="mb-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm no-underline hover:underline" style={{ color: "var(--muted)" }}><ArrowLeft size={14} /> All {doc.kind.replace(/_/g, " ")}s</Link>
      </div>
      <PageHeader
        title={<span className="flex items-center gap-3 flex-wrap"><span className="num">{doc.number}</span><StatusBadge status={doc.status} />{late && <span className="chip chip-bad">{daysBetween(doc.due_date, today())} days late</span>}</span>}
        desc={<>{isSales ? "Customer" : "Supplier"}: {party ? <Link className="link font-semibold" href={`/app/${isSales ? "sales/customers" : "purchases/suppliers"}/${party.id}`}>{party.name}</Link> : "—"} · {fmtDate(doc.date)}{doc.due_date ? ` · due ${fmtDate(doc.due_date)}` : ""}</>}
        actions={<DocActions doc={doc} open={open} isSales={isSales} perms={perms} banks={banks} partyDocs={partyDocs} />}
      />

      {(origin || children.length > 0 || creditNotes.length > 0) && (
        <div className="card p-3.5 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Document chain</span>
          {origin && <Link className="link inline-flex items-center gap-1.5" href={`/app/${["invoice", "quote", "sales_order", "credit_note"].includes(origin.kind) ? "sales" : "purchases"}/${origin.kind === "quote" ? "quotes" : origin.kind === "sales_order" ? "orders" : origin.kind === "purchase_order" ? "purchase-orders" : "invoices"}/${origin.id}`}>← {origin.number} <StatusBadge status={origin.status} /></Link>}
          <span className="inline-flex items-center gap-1.5"><b className="num">{doc.number}</b> <StatusBadge status={doc.status} /></span>
          {children.map((c: any) => (
            <Link key={c.id} className="link inline-flex items-center gap-1.5" href={`/app/${["invoice", "quote", "sales_order", "credit_note"].includes(c.kind) ? "sales" : "purchases"}/${c.kind === "quote" ? "quotes" : c.kind === "sales_order" ? "orders" : c.kind === "purchase_order" ? "purchase-orders" : c.kind === "credit_note" ? "invoices" : "invoices"}/${c.id}`}>{c.kind === "sales_order" ? "order" : c.kind === "purchase_order" ? "PO" : c.kind} {c.number} → <StatusBadge status={c.status} /></Link>
          ))}
          {creditNotes.map((c: any) => <Link key={c.id} className="chip chip-warn" href={`/app/sales/invoices/${c.id}`}>credit note {c.number}</Link>)}
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="card overflow-hidden">
          <DocPaper doc={preview} />
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">Money</h3>
            <Row label="Subtotal" value={fmtMoney(doc.subtotal, doc.currency)} />
            {doc.discount > 0 && <Row label="Discount" value={`−${fmtMoney(doc.discount, doc.currency)}`} />}
            <Row label="Tax" value={fmtMoney(doc.tax, doc.currency)} />
            <Row label={doc.kind === "bill" ? "Bill total" : "Total"} value={fmtMoney(doc.total, doc.currency)} bold />
            {doc.currency !== user.company.base_currency && <Row label={`In ${user.company.base_currency}`} value={fmtMoney(doc.total_base, user.company.base_currency)} small />}
            {["invoice", "bill", "credit_note"].includes(doc.kind) && (
              <>
                <Row label="Paid" value={fmtMoney(doc.paid, user.company.base_currency)} />
                <Row label={open > 0 ? "Outstanding" : "Remaining"} value={fmtMoney(Math.max(0, open), user.company.base_currency)} bold neg={open > 0 && late} />
              </>
            )}
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center justify-between">Payments {payments.length > 0 && <span className="chip">{payments.length}</span>}</h3>
            {payments.length === 0 && <p className="text-xs" style={{ color: "var(--faint)" }}>No payments allocated yet{doc.status === "draft" ? " — this is still a draft." : "."}</p>}
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="chip num !text-[10px]">{p.date}</span>
                  <span className="num font-semibold">{fmtMoney(p.applied, user.company.base_currency)}</span>
                  <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>{p.number}{p.reference ? ` · ${p.reference}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
          {je && (
            <Link href={`/app/accounting/journal?ref=${je.entry_no}`} className="card p-4 block no-underline hover:border-[var(--accent)] transition-colors">
              <div className="flex items-center gap-2">
                <span className="chip chip-good">ledger</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">Posted to journal — {je.entry_no}</div>
                  <div className="text-[11px]" style={{ color: "var(--faint)" }}>{je.description} · {fmtMoney(je.debit, user.company.base_currency)} balanced · click to drill into lines</div>
                </div>
              </div>
            </Link>
          )}
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Paperclip size={13} /> Attachments</h3>
            {files.length === 0 ? <p className="text-xs" style={{ color: "var(--faint)" }}>No files attached.</p> : files.map((f: any) => (
              <a key={f.id} href={`/api/files/${f.id}`} target="_blank" className="flex items-center gap-2 text-[13px] py-1 link">{f.name}<span className="ml-auto text-[10px]" style={{ color: "var(--faint)" }}>{(f.size / 1024).toFixed(0)} KB</span></a>
            ))}
            <p className="mt-2 text-[10.5px]" style={{ color: "var(--faint)" }}>Attach files from Documents — link the invoice as the reference.</p>
          </div>
          {auditRows.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-2">History</h3>
              <div className="space-y-2.5">
                {auditRows.map((a: any) => (
                  <div key={a.id} className="flex gap-2.5 text-[12px]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    <div className="min-w-0"><span className="font-medium">{a.summary}</span><span className="block text-[10.5px]" style={{ color: "var(--faint)" }}>{a.user_name} · {fmtDate(a.created_at)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Row({ label, value, bold, neg, small }: any) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "border-t mt-1 pt-2.5" : ""}`} style={{ borderColor: "var(--line)" }}>
      <span className={`${small ? "text-[11px]" : "text-[13px]"}`} style={{ color: "var(--muted)" }}>{label}</span>
      <b className={`num ${small ? "text-[12px]" : "text-[14px]"} font-semibold`} style={neg ? { color: "var(--neg)" } : undefined}>{value}</b>
    </div>
  );
}
