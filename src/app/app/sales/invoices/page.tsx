import { docsListData } from "@/lib/list-helpers";
import { PageHeader } from "@/components/shell";
import { DocListView } from "@/components/doc-list";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  const d = docsListData("invoice", searchParams);
  return (
    <>
      <PageHeader title="Invoices" desc="Every invoice you issue posts to the ledger — AR, revenue and tax update together." />
      {d.count === 0 ? (
        <EmptyState title="No invoices yet" desc="Create your first invoice — quotes, orders and credit notes all live in this workflow."
          action={d.canCreate ? { href: "/app/sales/invoices/new", label: "Create your first invoice" } : undefined}
          hint="Tip: press ⌘K from anywhere to jump straight here." />
      ) : (
        <>
          <DocListView rows={d.rows as any} kind="invoice" hrefBase="/app/sales/invoices" base={d.base} disp={d.disp}
            totals={d.totals} canCreate={d.canCreate} createHref="/app/sales/invoices/new" />
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/sales/invoices?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
