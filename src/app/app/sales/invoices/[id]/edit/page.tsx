import { editorData } from "@/lib/editor-data";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { DocEditorClient } from "@/components/editor-shell";

export const metadata = { title: "Edit draft" };
export const dynamic = "force-dynamic";
export default function Page({ params }: any) {
  const d = editorData("invoice", +params.id);
  if (!d) notFound();
  if (d.existing.status !== "draft") redirect(`/app/sales/invoices/${params.id}`);
  return (
    <>
      <PageHeader title={<>Edit draft <span className="num font-mono text-base opacity-70">{d.existing.number}</span></>} desc="Only drafts are editable; posted documents are protected for audit." />
      <DocEditorClient initial={d.state as any} parties={d.parties as any} taxRates={d.taxRates as any} accounts={d.accounts as any} company={d.company as any} canPost={d.canPost} />
    </>
  );
}
