import { docsListData } from "@/lib/list-helpers";
import { PageHeader } from "@/components/shell";
import { DocListView } from "@/components/doc-list";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";

export const metadata = { title: "Purchase orders" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  const d = docsListData("purchase_order", searchParams);
  const createHref = "/app/purchases/purchase-orders/new";
  return (
    <>
      <PageHeader title="Purchase orders" desc="Track what you ordered before the bill arrives; convert a PO into a bill on receipt." />
      {d.count === 0 ? (
        <EmptyState title="Nothing here yet" desc="No purchase orders yet. Issue a PO, then convert it into a bill when goods arrive."
          action={d.canCreate ? { href: createHref, label: "Create one" } : undefined} />
      ) : (
        <>
          <DocListView rows={d.rows as any} kind="purchase_order" hrefBase="/app/purchases/purchase-orders" base={d.base} disp={d.disp}
            totals={undefined} canCreate={d.canCreate} createHref={createHref} />
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/purchases/purchase-orders?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
