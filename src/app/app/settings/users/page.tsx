import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { can, ROLES } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "../forms";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "manage_settings")) redirect("/app/settings");
  const members = all<any>(
    `SELECT m.user_id, m.role, u.name, u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, u.name`, user.companyId);
  return (
    <>
      <PageHeader title="Team" desc="Roles decide what each person can post, approve or delete — every capability check is enforced server-side." />
      <SettingsTabs user={user} active="/app/settings/users" />
      <UsersClient members={members} roles={ROLES} me={user.id} />
    </>
  );
}
