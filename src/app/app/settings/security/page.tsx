import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { SecurityClient } from "../forms";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export const metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const currentId = cookies().get(SESSION_COOKIE)?.value ?? "";
  const sessions = all<any>(`SELECT id, device, ip, created_at, expires_at FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 10`, user.id)
    .map((s: any) => ({ ...s, current: s.id === currentId, id: s.id.slice(0, 8) + "…" }));
  return (
    <>
      <PageHeader title="Security" desc="Two-factor authentication and session hygiene." />
      <SettingsTabs user={user} active="/app/settings/security" />
      <SecurityClient user={{ id: user.id, email: user.email, twofa_enabled: get<any>(`SELECT twofa_enabled FROM users WHERE id=?`, user.id)?.twofa_enabled ?? 0 }} sessions={sessions} />
    </>
  );
}
