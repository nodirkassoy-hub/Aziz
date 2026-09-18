import { all } from "./db";
import { notifyUser } from "./reports";

/** Fan out a notification to the company's finance roles. */
export function notifyUsers(cid: number, kind: string, severity: string, title: string, body: string, link: string) {
  for (const m of all<any>(`SELECT user_id FROM memberships WHERE company_id=? AND role IN ('owner','cfo','chief_accountant','accountant','finance_manager')`, cid)) {
    notifyUser(cid, m.user_id, { kind, severity, title, body, link });
  }
}
