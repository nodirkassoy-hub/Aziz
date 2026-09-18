import { requireUser } from "@/lib/ctx";
import { get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { NotifClient } from "../forms";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const KINDS = ["invoice_overdue", "upcoming_bills", "approval", "approval_decision", "reconciliation", "low_cash", "tax_deadline", "period_close", "payment_received", "invoice_issued"];

export default async function Page() {
  const user = requireUser();
  const prefs = get<any>(`SELECT prefs_json FROM memberships WHERE company_id=? AND user_id=?`, user.companyId, user.id)?.prefs_json;
  let current: Record<string, boolean> = {};
  try { current = JSON.parse(prefs ?? "{}")?.notify ?? {}; } catch { /* noop */ }
  return (
    <>
      <PageHeader title="Notifications" desc="Bell alerts for your account." />
      <SettingsTabs user={user} active="/app/settings/notifications" />
      <NotifClient kinds={KINDS} current={current} />
    </>
  );
}
