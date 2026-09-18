import { notFound } from "next/navigation";
import { docDetail } from "@/lib/doc-detail";
import { DocView } from "@/components/doc-view";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string } }) {
  const d = docDetail("purchases", +params.id);
  if (!d) notFound();
  const banks = all<any>(`SELECT id, name, currency FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, d.cid);
  const partyDocs: any[] = [];
  return <DocView {...d} banks={banks} partyDocs={partyDocs} backHref="/app/purchase-orders" />;
}
