import { handler, bad } from "@/lib/api";
import { get, run } from "@/lib/db";
import { all } from "@/lib/db";

export const POST = handler(async ({ user, body }) => {
  if (body.action === "save") {
    const m = get(`SELECT * FROM memberships WHERE company_id=? AND user_id=?`, user.companyId, user.id);
    if (!m) bad("Membership missing.");
    let prefs: any = {}; try { prefs = JSON.parse(m.prefs_json || "{}"); } catch { }
    prefs.widgets = body.widgets;
    run(`UPDATE memberships SET prefs_json=? WHERE id=?`, JSON.stringify(prefs), m.id);
    return { message: "Dashboard layout saved." };
  }
  bad("Unknown action");
});
