import { requireUser } from "@/lib/ctx";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompanyForm } from "../forms";

export const metadata = { title: "Company details" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "manage_settings")) redirect("/app/settings");
  return (
    <>
      <PageHeader title="Company details" desc="Legal identity, document footers, defaults and the expense approval threshold." />
      <SettingsTabs user={user} active="/app/settings/company" />
      <CompanyForm c={{ ...user.company }} />
    </>
  );
}
