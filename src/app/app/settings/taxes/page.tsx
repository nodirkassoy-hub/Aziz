import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TaxesClient } from "../forms";

export const metadata = { title: "Taxes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "manage_settings")) redirect("/app/settings");
  const rates = all<any>(`SELECT * FROM tax_rates WHERE company_id=? ORDER BY archived, rate_pct DESC`, user.companyId);
  return (
    <>
      <PageHeader title="Taxes" desc="Rates are what your jurisdiction requires — Mizom applies your configuration to documents and reports, nothing more." />
      <SettingsTabs user={user} active="/app/settings/taxes" />
      <TaxesClient rates={rates} jurisdiction={user.company.tax_authority ?? null} />
    </>
  );
}
