import { docsListData } from "@/lib/list-helpers";
import { PageHeader } from "@/components/shell";
import { DocListView } from "@/components/doc-list";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";

export const metadata = { title: "Sales orders" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  const d = docsListData("sales_order", searchParams);
  const createHref = "/app/sales/orders/new";
  return (
    <>
      <PageHeader title="Sales orders" desc="Orders bridge accepted quotes and invoices; the link from quote → order → invoice is kept." />
      {d.count === 0 ? (
        <EmptyState title="Nothing here yet" desc="No sales orders yet. Convert an accepted quote into an order, then issue the invoice."
          action={d.canCreate ? { href: createHref, label: "Create one" } : undefined} />
      ) : (
        <>
          <DocListView rows={d.rows as any} kind="sales_order" hrefBase="/app/sales/orders" base={d.base} disp={d.disp}
            totals={undefined} canCreate={d.canCreate} createHref={createHref} />
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/sales/orders?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
