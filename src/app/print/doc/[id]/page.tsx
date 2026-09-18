import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get, all } from "@/lib/db";
import { DocPaper } from "@/components/doc-preview";

export const dynamic = "force-dynamic";
export default function PrintPage({ params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) redirect("/login");
  const doc = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, +params.id, user.companyId);
  if (!doc) notFound();
  const items = all<any>(`SELECT * FROM trade_doc_items WHERE doc_id=? ORDER BY sort, id`, doc.id);
  const isSales = ["invoice", "quote", "sales_order", "credit_note"].includes(doc.kind);
  const party = get<any>(`SELECT * FROM ${isSales ? "customers" : "suppliers"} WHERE id=?`, doc.party_id);
  const c = user.company;
  const preview = {
    company: { name: c.name, legal_name: c.legal_name, tax_id: c.tax_id, address: c.address, phone: c.phone, email: c.email,
      bank_name: c.bank_name, bank_account_no: c.bank_account_no, bank_currency: c.bank_currency,
      accent_color: c.accent_color, invoice_layout: c.invoice_layout, tax_registration: c.tax_registration,
      logo_url: c.logo_doc_id ? `/api/files/${c.logo_doc_id}` : null },
    kind: doc.kind, number: doc.number, status: doc.status,
    customer: isSales ? party : null, supplier: !isSales ? party : null,
    date: doc.date, due_date: doc.due_date, currency: doc.currency, fx_rate: doc.fx_rate,
    items: items.map((i: any) => ({ description: i.description, qty: i.qty, unit_price: i.unit_price, discount_pct: i.discount_pct, tax_pct: i.tax_pct, amount: i.amount, tax_amount: i.tax_amount })),
    subtotal: doc.subtotal, discount: doc.discount, tax: doc.tax, total: doc.total,
    paid: doc.currency === c.base_currency ? doc.paid : null,
    notes: doc.notes, terms: doc.terms,
  };
  return (
    <div className="min-h-dvh bg-white text-black print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "#e5e7eb", background: "#fff" }}>
        <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="btn-outline" onClick={() => history.back()}>Back</button>
        <span className="text-xs ml-auto" style={{ color: "#667" }}>Use your browser dialog and choose “Save as PDF” for a pixel-perfect copy.</span>
      </div>
      <div className="max-w-[800px] mx-auto p-6">
        <DocPaper doc={preview as any} print />
      </div>
    </div>
  );
}
