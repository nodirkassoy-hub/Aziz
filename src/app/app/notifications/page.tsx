import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { pushAlertsAsNotifications } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/kit";
import { MarkRead } from "./client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const SEV: Record<string, { icon: any; color: string }> = {
  info: { icon: Info, color: "var(--accent)" }, warn: { icon: AlertTriangle, color: "var(--warn)" },
  danger: { icon: ShieldAlert, color: "var(--neg)" }, success: { icon: CheckCircle2, color: "var(--pos)" },
};

export default async function Page() {
  const user = requireUser();
  pushAlertsAsNotifications(user.companyId);
  const items = all<any>(`SELECT * FROM notifications WHERE (user_id=? OR (user_id IS NULL AND company_id=?)) ORDER BY read_at IS NULL DESC, created_at DESC LIMIT 60`, user.id, user.companyId);
  const unread = items.filter((i: any) => !i.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" desc="Overdues, approvals and reconciliation nudges — generated from your data, never marketing."
        actions={unread > 0 && <MarkRead all />} />
      {items.length === 0 ? <EmptyState title="All quiet" desc="Alerts about overdue documents, approvals and unreconciled lines will collect here." /> : (
        <div className="space-y-2">
          {items.map((n: any) => {
            const { icon: Icon, color } = SEV[n.severity] ?? SEV.info;
            return (
              <div key={n.id} className="glass flex items-start gap-3 rounded-2xl px-4 py-3" style={n.read_at ? { opacity: 0.6 } : undefined}>
                <span className="mt-0.5 rounded-lg p-1.5" style={{ background: "var(--accent-soft)" }}><Icon size={14} style={{ color }} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">{n.title}{!n.read_at && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />}</div>
                  {n.body && <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--muted)" }}>{n.body}</p>}
                  <div className="mt-1 text-[11px] num" style={{ color: "var(--muted)" }}>{n.created_at?.slice(0, 16).replace("T", " ")} · {n.kind}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {n.link && <Link className="btn-outline btn-sm no-underline" href={n.link}>Open</Link>}
                  {!n.read_at && <MarkRead id={n.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
