import Link from "next/link";
import { notFound } from "next/navigation";
import { docDetail } from "@/lib/doc-detail";
import { PageHeader } from "@/components/shell";
import { StatusBadge } from "@/components/kit";
import { DocActions } from "@/components/doc-detail-actions";
import { DocView } from "@/components/doc-view";
import { get, all } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { fmtDate, today, daysBetween } from "@/lib/dates";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string } }) {
  const d = docDetail("sales", +params.id);
  if (!d) notFound();
  const banks = all<any>(`SELECT id, name, currency FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, d.cid);
  const partyDocs = d.isSales || d.doc.kind === "bill"
    ? all<any>(`SELECT id, kind, number, currency, total_base, paid, (total_base-paid) AS outstanding FROM trade_docs WHERE company_id=? AND party_id=? AND kind IN ('invoice','bill') AND status IN ('sent','partial','overdue') AND (total_base-paid)>0 ORDER BY due_date`, d.cid, d.doc.party_id)
    : [];
  return <DocView {...d} banks={banks} partyDocs={partyDocs} backHref={`/app/${d.isSales ? "sales" : "purchases"}/${d.doc.kind === "bill" ? "bills" : d.doc.kind === "quote" ? "quotes" : d.doc.kind === "sales_order" ? "orders" : "invoices"}`} />;
}
