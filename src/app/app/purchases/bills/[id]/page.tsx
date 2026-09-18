import { notFound } from "next/navigation";
import { docDetail } from "@/lib/doc-detail";
import { DocView } from "@/components/doc-view";
import { all } from "@/lib/db";

export const metadata = { title: "Bill" };
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string } }) {
  const d = docDetail("purchases", +params.id);
  if (!d) notFound();
  const banks = all<any>(`SELECT id, name, currency FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, d.cid);
  const partyDocs = all<any>(`SELECT id, kind, number, currency, total_base, paid, (total_base-paid) AS outstanding FROM trade_docs WHERE company_id=? AND party_id=? AND kind IN ('invoice','bill') AND status IN ('sent','partial','overdue') AND (total_base-paid)>0 ORDER BY due_date`, d.cid, d.doc.party_id);
  return <DocView {...d} banks={banks} partyDocs={partyDocs} backHref={`/app/purchases/${d.doc.kind === "purchase_order" ? "purchase-orders" : "bills"}`} />;
}
