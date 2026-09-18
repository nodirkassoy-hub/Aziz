import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CurrencyForm } from "../forms";

export const metadata = { title: "Currency & FX" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "manage_settings")) redirect("/app/settings");
  const rates = all<any>(`SELECT * FROM exchange_rates WHERE company_id=? ORDER BY date DESC, id DESC LIMIT 40`, user.companyId);
  return (
    <>
      <PageHeader title="Currency & FX" desc="Base currency and the manual rate table used to convert foreign documents and payments." />
      <SettingsTabs user={user} active="/app/settings/currency" />
      <CurrencyForm c={{ ...user.company }} rates={rates} />
    </>
  );
}
