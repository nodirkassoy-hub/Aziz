import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/kit";
import { can } from "@/lib/auth";
import { DocumentsClient } from "./client";

export const metadata = { title: "Files & receipts" };
export const dynamic = "force-dynamic";

function entityLabel(f: any) {
  if (!f.entity_kind) return null;
  const map: Record<string, string> = { invoice: "invoice", bill: "bill", quote: "quote", credit_note: "credit note", payment: "payment", expense: "expense", sales_order: "order", purchase_order: "order", company: "company" };
  return `${map[f.entity_kind] ?? f.entity_kind} #${f.entity_id}`;
}

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const tab = ["receipts", "contracts"].includes(searchParams?.tab) ? searchParams.tab : "all";
  const rows = all<any>(
    `SELECT f.*, u.name AS uploader FROM files f LEFT JOIN users u ON u.id=f.uploaded_by
     WHERE f.company_id=? ${tab === "all" ? "" : `AND f.kind='${tab === "receipts" ? "receipt" : "contract"}'`}
     ORDER BY f.created_at DESC LIMIT 200`, user.companyId);
  const counts = all<any>(`SELECT kind, COUNT(*) n FROM files WHERE company_id=? GROUP BY kind`, user.companyId).reduce((m: any, r) => (m[r.kind] = r.n, m), {} as Record<string, number>);
  const docs = Object.fromEntries(rows.map((r: any) => {
    let label = entityLabel(r);
    if (r.entity_kind && r.entity_id) {
      const t = r.entity_kind === "expense" ? "expenses" : r.entity_kind === "company" ? "companies" : "trade_docs";
      if (t === "trade_docs") { const d = get<any>(`SELECT number FROM trade_docs WHERE id=?`, r.entity_id); if (d) label = `${r.entity_kind} ${d.number}`; }
      else { const d = get<any>(`SELECT ${t === "expenses" ? "description" : "name"} AS number FROM ${t} WHERE id=?`, r.entity_id); if (d) label = `${r.entity_kind === "company" ? "company" : r.entity_kind} ${String(d.number).slice(0, 24)}`; }
    }
    return [r.id, label];
  }));
  return (
    <>
      <PageHeader title="Files & receipts" desc="Attachments for documents, scanned receipts and contracts. Files are evidence — they never post anything by themselves."
        tabs={[
          { href: "/app/documents", label: "All", active: tab === "all" },
          { href: "/app/documents?tab=receipts", label: `Receipts (${counts["receipt"] ?? 0})`, active: tab === "receipts" },
          { href: "/app/documents?tab=contracts", label: `Contracts (${counts["contract"] ?? 0})`, active: tab === "contracts" },
        ]} />
      <DocumentsClient rows={rows.map((r: any) => ({ ...r, entity_label: docs[r.id] }))} canUpload={can(user.role, "create", "purchases")} tab={tab} autoOpen={searchParams?.upload === "1" || searchParams?.new === "1"} />
    </>
  );
}
