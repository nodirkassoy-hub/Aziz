import { docsListData } from "@/lib/list-helpers";
import { PageHeader } from "@/components/shell";
import { DocListView } from "@/components/doc-list";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";

export const metadata = { title: "Bills" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  const d = docsListData("bill", searchParams);
  const createHref = "/app/purchases/bills/new";
  return (
    <>
      <PageHeader title="Bills" desc="Supplier bills post as expense + input tax with Accounts Payable on the other side." />
      {d.count === 0 ? (
        <EmptyState title="Nothing here yet" desc="No bills yet. Record a supplier bill and it will show in payables, aging and the tax report."
          action={d.canCreate ? { href: createHref, label: "Create one" } : undefined} />
      ) : (
        <>
          <DocListView rows={d.rows as any} kind="bill" hrefBase="/app/purchases/bills" base={d.base} disp={d.disp}
            totals={d.totals} canCreate={d.canCreate} createHref={createHref} />
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/purchases/bills?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
