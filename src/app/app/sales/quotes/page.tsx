import { docsListData } from "@/lib/list-helpers";
import { PageHeader } from "@/components/shell";
import { DocListView } from "@/components/doc-list";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";

export const metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  const d = docsListData("quote", searchParams);
  const createHref = "/app/sales/quotes/new";
  return (
    <>
      <PageHeader title="Quotes" desc="Convert an accepted quote into a sales order or invoice with one click — the document chain stays linked." />
      {d.count === 0 ? (
        <EmptyState title="Nothing here yet" desc="No quotes yet. Send a quote to win a deal, then convert it to an invoice without retyping anything."
          action={d.canCreate ? { href: createHref, label: "Create one" } : undefined} />
      ) : (
        <>
          <DocListView rows={d.rows as any} kind="quote" hrefBase="/app/sales/quotes" base={d.base} disp={d.disp}
            totals={d.totals} canCreate={d.canCreate} createHref={createHref} />
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/sales/quotes?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
