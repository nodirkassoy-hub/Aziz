import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { can } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { ManualJeForm } from "./client";
import { redirect } from "next/navigation";

export const metadata = { title: "Manual journal entry" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  if (!can(user.role, "post", "accounting")) redirect("/app/accounting/journal");
  const accounts = all<any>(`SELECT id, code, name, type FROM accounts WHERE company_id=? AND archived=0 ORDER BY code`, user.companyId);
  return (
    <>
      <PageHeader title="Manual journal entry" desc="Adjustments, accruals, corrections — balanced debits and credits, posted straight to the ledger." />
      <ManualJeForm accounts={accounts} base={user.company.base_currency}
        editId={searchParams?.edit ? +searchParams.edit : undefined} />
    </>
  );
}
