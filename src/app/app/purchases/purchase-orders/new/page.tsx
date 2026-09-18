import { editorData } from "@/lib/editor-data";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { DocEditorClient } from "@/components/editor-shell";

export const metadata = { title: "New purchase order" };
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: any) {
  const preset = searchParams?.customer ? { party_id: +searchParams.customer } : undefined;
  const d = editorData("purchase_order", undefined, preset);
  if (!d) notFound();
  return (
    <>
      <PageHeader title="New purchase order" desc="Drafts don’t affect the ledger until you issue them — the preview updates live as you type." />
      <DocEditorClient initial={d.state as any} parties={d.parties as any} taxRates={d.taxRates as any} accounts={d.accounts as any} company={d.company as any} canPost={d.canPost} />
    </>
  );
}
