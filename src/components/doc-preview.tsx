/** Shared invoice/document paper preview — used in editor, detail page & print. */
import { fmtMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export type PreviewDoc = {
  company: { name: string; legal_name?: string; tax_id?: string; address?: string; phone?: string; email?: string; bank_name?: string; bank_account_no?: string; bank_currency?: string; logo_url?: string | null; accent_color?: string; invoice_layout?: string; tax_authority?: string; tax_registration?: string };
  kind: string; number: string; status?: string;
  customer: { name: string; address?: string; tax_id?: string; email?: string; phone?: string; contact_person?: string } | null;
  supplier: { name: string; address?: string; tax_id?: string; email?: string; phone?: string; contact_person?: string } | null;
  date: string; due_date?: string | null; currency: string; fx_rate?: number;
  items: { description: string; qty: number; unit_price: number; discount_pct?: number; tax_pct?: number; amount: number; tax_amount: number }[];
  subtotal: number; discount?: number; tax: number; total: number; paid?: number;
  notes?: string | null; terms?: string | null;
  amountInWords?: boolean;
};

export function DocPaper({ doc, print }: { doc: PreviewDoc; print?: boolean }) {
  const accent = doc.company.accent_color || "#0f7f6c";
  const layout = doc.company.invoice_layout || "classic";
  const isReceipt = doc.kind === "credit_note";
  const title = { invoice: "INVOICE", quote: "QUOTATION", sales_order: "SALES ORDER", bill: "BILL", purchase_order: "PURCHASE ORDER", credit_note: isReceipt ? "CREDIT NOTE" : "CREDIT NOTE" }[doc.kind] ?? "DOCUMENT";
  const money = (v: number, hide = false) => fmtMoney(v, doc.currency, { hideCode: hide });
  const rows = doc.items;
  return (
    <div className={`print-area ${print ? "" : "card-solid overflow-hidden"} ${print ? "bg-white text-black" : ""}`} style={print ? { background: "white", color: "#111" } : { fontSize: 13 }}>
      {layout === "modern" && <div style={{ height: 12, background: accent }} />}
      <div className="p-6 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            {doc.company.logo_url ? (
              <img src={doc.company.logo_url} alt="Company logo" className="h-14 w-auto object-contain max-w-[220px]" />
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-white text-lg" style={{ background: accent }}>{doc.company.name.slice(0, 1)}</span>
                <div>
                  <div className="text-lg font-extrabold tracking-tight" style={{ color: print ? "#111" : undefined }}>{doc.company.legal_name || doc.company.name}</div>
                </div>
              </div>
            )}
            {doc.company.logo_url && <div className="text-base font-extrabold mt-1.5">{doc.company.legal_name || doc.company.name}</div>}
            <div className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "#666" }}>
              {doc.company.address && <div>{doc.company.address}</div>}
              <div>{[doc.company.phone, doc.company.email].filter(Boolean).join(" · ")}</div>
              {doc.company.tax_id && <div>Tax ID: {doc.company.tax_id}</div>}
              {doc.company.tax_registration && <div>Tax reg.: {doc.company.tax_registration}</div>}
            </div>
          </div>
          <div className="text-right ml-auto">
            <div className={`font-black tracking-[0.2em] ${layout === "classic" ? "text-2xl" : "text-xl"}`} style={{ color: layout === "modern" || layout === "minimal" ? "#111" : accent }}>{title}</div>
            <div className="mt-1.5 text-[12px]" style={{ color: "#555" }}>
              <div className="font-bold" style={{ color: "#111" }}>{doc.number}</div>
              <div>Issued: {fmtDate(doc.date)}</div>
              {doc.due_date && <div>Due: {fmtDate(doc.due_date)}</div>}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ background: "#f6f8fa", border: "1px solid #eceff3" }}>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a93a5" }}>{doc.kind === "invoice" || doc.kind === "quote" || doc.kind === "sales_order" ? "Bill to" : "From supplier"}</div>
            <div className="mt-1.5 font-bold" style={{ color: "#111" }}>{(doc.customer ?? doc.supplier)?.name ?? "—"}</div>
            <div className="text-[11.5px] leading-relaxed" style={{ color: "#555" }}>
              {(doc.customer ?? doc.supplier)?.address && <div>{(doc.customer ?? doc.supplier)!.address}</div>}
              {(doc.customer ?? doc.supplier)?.contact_person && <div>Attn: {(doc.customer ?? doc.supplier)!.contact_person}</div>}
              {(doc.customer ?? doc.supplier)?.tax_id && <div>Tax ID: {(doc.customer ?? doc.supplier)!.tax_id}</div>}
              {(doc.customer ?? doc.supplier)?.email && <div>{(doc.customer ?? doc.supplier)!.email}</div>}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "#f6f8fa", border: "1px solid #eceff3" }}>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a93a5" }}>{doc.kind === "invoice" || doc.kind === "quote" || doc.kind === "sales_order" ? "Payment due" : "Pay to supplier"}</div>
            <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "#333" }}>
              {doc.due_date ? <>By <b>{fmtDate(doc.due_date)}</b></> : <>Per contract terms</>}
              {doc.company.bank_name && <div className="mt-1.5">{doc.company.bank_name}</div>}
              {doc.company.bank_account_no && <div className="num">{doc.company.bank_account_no}</div>}
              {doc.company.bank_currency && <div style={{ color: "#777" }}>{doc.company.bank_currency}</div>}
            </div>
          </div>
        </div>

        <table className="w-full mt-7 border-collapse" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th className="text-left py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }} colSpan={2}>Description</th>
              <th className="text-right py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }}>Qty</th>
              <th className="text-right py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider hidden sm:table-cell" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }}>Unit price</th>
              <th className="text-right py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider hidden sm:table-cell" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }}>Disc.</th>
              <th className="text-right py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }}>Tax</th>
              <th className="text-right py-2.5 px-2 font-semibold uppercase text-[10px] tracking-wider" style={{ color: "#fff", background: layout === "minimal" ? "#222" : accent }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center" style={{ color: "#8a93a5" }}>No line items yet</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eef1f4" }}>
                <td className="py-2.5 px-2" colSpan={2}>{r.description}</td>
                <td className="py-2.5 px-2 text-right num">{r.qty}</td>
                <td className="py-2.5 px-2 text-right num hidden sm:table-cell">{money(r.unit_price)}</td>
                <td className="py-2.5 px-2 text-right num hidden sm:table-cell">{r.discount_pct ? r.discount_pct + "%" : "—"}</td>
                <td className="py-2.5 px-2 text-right num">{r.tax_pct ? money(r.tax_amount) + ` · ${r.tax_pct}%` : "—"}</td>
                <td className="py-2.5 px-2 text-right num font-medium">{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-6">
          <div className="flex-1 min-w-[180px] text-[11.5px] leading-relaxed" style={{ color: "#555" }}>
            {doc.notes && <><div className="font-bold uppercase text-[9.5px] tracking-widest" style={{ color: "#8a93a5" }}>Notes</div>{doc.notes}</>}
            {doc.terms && <><div className="font-bold uppercase text-[9.5px] tracking-widest mt-3" style={{ color: "#8a93a5" }}>Terms</div>{doc.terms}</>}
          </div>
          <div className="w-full sm:w-64 ml-auto">
            <table className="w-full" style={{ fontSize: 12.5 }}>
              <tbody>
                <tr><td className="py-1" style={{ color: "#666" }}>Subtotal</td><td className="py-1 text-right num font-medium">{money(doc.subtotal)}</td></tr>
                {!!doc.discount && <tr><td className="py-1" style={{ color: "#666" }}>Discount</td><td className="py-1 text-right num">−{money(doc.discount)}</td></tr>}
                <tr><td className="py-1" style={{ color: "#666" }}>Tax</td><td className="py-1 text-right num">{money(doc.tax)}</td></tr>
                <tr style={{ borderTop: `2px solid ${accent}` }}>
                  <td className="pt-2 font-bold" style={{ color: "#111" }}>Total</td>
                  <td className="pt-2 text-right num font-extrabold text-[16px]" style={{ color: "#111" }}>{money(doc.total)}</td>
                </tr>
                {!!doc.paid && <>
                  <tr><td style={{ color: "#666" }}>Paid</td><td className="text-right num">{money(doc.paid)}</td></tr>
                  <tr><td className="font-semibold" style={{ color: "#111" }}>Balance due</td><td className="text-right num font-bold" style={{ color: doc.total - doc.paid > 0 ? "#c0392b" : "#1a9e83" }}>{money(doc.total - doc.paid)}</td></tr>
                </>}
              </tbody>
            </table>
            {doc.currency !== "UZS" && doc.fx_rate ? <div className="mt-2 text-[10px]" style={{ color: "#8a93a5" }}>Base currency amounts at 1 {doc.currency} = {doc.fx_rate?.toFixed?.(4) ?? doc.fx_rate}</div> : null}
          </div>
        </div>
        <div className="mt-8 pt-4 text-[10px] text-center" style={{ color: "#9aa3b2", borderTop: "1px solid #eef1f4" }}>
          {doc.company.legal_name || doc.company.name} · generated with Mizom
        </div>
      </div>
    </div>
  );
}
