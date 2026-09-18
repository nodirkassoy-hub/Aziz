import { handler } from "@/lib/api";
import { all, get, run } from "@/lib/db";
import { pushAlertsAsNotifications } from "@/lib/reports";

export const GET = handler(async ({ user }) => {
  pushAlertsAsNotifications(user.companyId);
  const items = all(`SELECT n.*, CASE WHEN n.read_at IS NULL THEN 0 ELSE 1 END AS is_read,
    CASE WHEN n.created_at >= datetime('now','-1 hour') THEN strftime('%M min ago', 'now', n.created_at)
         WHEN n.created_at >= datetime('now','-1 day') THEN strftime('%H h ago', 'now', n.created_at)
         ELSE substr(n.created_at, 6, 5) END AS "when"
    FROM notifications n WHERE (n.user_id=? OR (n.user_id IS NULL AND n.company_id=?)) ORDER BY n.created_at DESC LIMIT 40`, user.id, user.companyId);
  const unread = get(`SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL`, user.id)?.n ?? 0;
  return { items, unread };
});
export const POST = handler(async ({ user, body }) => {
  if (body.read) for (const id of body.read) run(`UPDATE notifications SET read_at=datetime('now') WHERE id=? AND (user_id=? OR user_id IS NULL)`, id, user.id);
  if (body.readAll) run(`UPDATE notifications SET read_at=datetime('now') WHERE user_id=? AND read_at IS NULL`, user.id);
  return { ok: true };
});
