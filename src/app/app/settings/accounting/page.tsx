import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountingClient } from "../forms";

export const metadata = { title: "Accounting policy" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "manage_settings")) redirect("/app/settings");
  const locks = all<any>(`SELECT * FROM period_locks WHERE company_id=? ORDER BY period DESC`, user.companyId);
  return (
    <>
      <PageHeader title="Accounting policy" desc="Document numbering, fiscal behaviour and period locks — the knobs that keep a closed month closed." />
      <SettingsTabs user={user} active="/app/settings/accounting" />
      <AccountingClient c={{ ...user.company }} locks={locks} />
    </>
  );
}
