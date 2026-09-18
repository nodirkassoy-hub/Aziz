import { cookies } from "next/headers";
import crypto from "crypto";
import { all, get, insert, run } from "./db";

export const SESSION_COOKIE = "mizom_session";
export const COMPANY_COOKIE = "mizom_cid";
export const CURRENCY_COOKIE = "mizom_cur";
export const PERIOD_COOKIE = "mizom_period";

/* ---------------- passwords (scrypt) ---------------- */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [alg, saltHex, hashHex] = stored.split("$");
    if (alg !== "scrypt") return false;
    const expect = crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64));
    return expect;
  } catch { return false; }
}
export function randomToken(n = 32) { return crypto.randomBytes(n).toString("base64url"); }

/* ---------------- roles & permissions ---------------- */
export type Perm = "view" | "create" | "edit" | "delete" | "approve" | "post" | "export" | "manage_settings" | "override_lock";
export type Area = "all" | "sales" | "purchases" | "accounting" | "finance" | "reports" | "settings";

export const ROLES: Record<string, { label: string; desc: string; perms: Perm[]; areas: Area[] }> = {
  super_admin:      { label: "Super Admin",      desc: "Platform-level administration",       perms: ["view", "create", "edit", "delete", "approve", "post", "export", "manage_settings", "override_lock"], areas: ["all"] },
  owner:            { label: "Owner / Director", desc: "Full control of the company books",    perms: ["view", "create", "edit", "delete", "approve", "post", "export", "manage_settings", "override_lock"], areas: ["all"] },
  cfo:              { label: "CFO",              desc: "Strategy, approvals, reporting",       perms: ["view", "create", "edit", "approve", "post", "export", "manage_settings"], areas: ["all"] },
  chief_accountant: { label: "Chief Accountant", desc: "Owns accounting policy & periods",    perms: ["view", "create", "edit", "delete", "approve", "post", "export", "manage_settings"], areas: ["all"] },
  accountant:       { label: "Accountant",       desc: "Daily entries & reconciliation",       perms: ["view", "create", "edit", "post", "export"], areas: ["all"] },
  finance_manager:  { label: "Finance Manager",  desc: "Cash, banking & approvals",            perms: ["view", "create", "edit", "approve", "export"], areas: ["sales", "purchases", "finance", "reports"] },
  sales_manager:    { label: "Sales Manager",    desc: "Quotes, invoices & customers",         perms: ["view", "create", "edit", "export"], areas: ["sales", "reports"] },
  employee:         { label: "Employee",         desc: "Expenses & receipts only",             perms: ["view", "create"], areas: ["purchases"] },
  auditor:          { label: "Auditor",          desc: "Read-only, full visibility",           perms: ["view", "export"], areas: ["all"] },
};
export const ALL_PERMS: Perm[] = ["view", "create", "edit", "delete", "approve", "post", "export", "manage_settings", "override_lock"];
export const ALL_AREAS: Area[] = ["all", "sales", "purchases", "accounting", "finance", "reports", "settings"];

export function can(role: string, perm: Perm, area?: Area): boolean {
  const r = ROLES[role]; if (!r) return false;
  if (!r.perms.includes(perm)) return false;
  if (!area) return true;
  return r.areas.includes("all") || r.areas.includes(area);
}

/* ---------------- sessions ---------------- */
export type SessionUser = {
  id: number; email: string; name: string; avatar?: string | null;
  companyId: number; role: string; company: any;
  displayCurrency: string; period: string;
};

export function currentUser(): SessionUser | null {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = get<any>(`SELECT u.*, sc.expires_at AS session_expires FROM sessions sc JOIN users u ON u.id=sc.user_id WHERE sc.id=? AND sc.expires_at > datetime('now')`, token);
  if (!s) return null;
  const cidRaw = store.get(COMPANY_COOKIE)?.value;
  let cid = cidRaw ? Number(cidRaw) : null;
  let membership = cid ? get<any>(`SELECT * FROM memberships WHERE company_id=? AND user_id=?`, cid, s.id) : null;
  if (!membership) {
    membership = get<any>(`SELECT * FROM memberships WHERE user_id=? ORDER BY id LIMIT 1`, s.id);
    cid = membership?.company_id ?? null;
  }
  if (!membership || !cid) return null;
  const company = get<any>(`SELECT * FROM companies WHERE id=?`, cid);
  if (!company) return null;
  return {
    id: s.id, email: s.email, name: s.name, avatar: s.avatar,
    companyId: cid, role: membership.role, company,
    displayCurrency: store.get(CURRENCY_COOKIE)?.value || company.base_currency || "UZS",
    period: store.get(PERIOD_COOKIE)?.value || "this_month",
  };
}

export function currentUserIdOrNull(): number | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return get<any>(`SELECT user_id FROM sessions WHERE id=? AND expires_at > datetime('now')`, token)?.user_id ?? null;
}

export function createSession(userId: number, meta?: { device?: string; ip?: string }): string {
  const token = randomToken(32);
  run(`INSERT INTO sessions (id, user_id, device, ip, expires_at) VALUES (?,?,?,?,datetime('now','+30 days'))`,
    token, userId, (meta?.device || "unknown").slice(0, 250), meta?.ip?.slice(0, 64) || null);
  return token;
}
export function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) run(`DELETE FROM sessions WHERE id=?`, token);
}
export function userCompanies(userId: number) {
  return all<any>(`SELECT c.*, m.role FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=? ORDER BY c.name`, userId);
}

/* ---------------- audit ---------------- */
export function audit(o: {
  companyId?: number | null; userId?: number | null; userName?: string | null;
  action: "created" | "edited" | "deleted" | "approved" | "rejected" | "posted" | "unposted" | "paid" | "cancelled" | "sent" | "locked" | "unlocked" | "login" | "logout" | "exported" | "uploaded" | "converted" | "matched" | "unmatched" | "imported";
  entityKind: string; entityId?: number | null; summary: string;
  old?: any; new?: any; ip?: string; device?: string;
}) {
  insert(
    `INSERT INTO audit_log (company_id, user_id, user_name, action, entity_kind, entity_id, summary, old_json, new_json, ip, device)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    o.companyId ?? null, o.userId ?? null, o.userName ?? null, o.action, o.entityKind, o.entityId ?? null,
    o.summary, o.old !== undefined ? JSON.stringify(o.old) : null, o.new !== undefined ? JSON.stringify(o.new) : null,
    o.ip ?? null, o.device ?? null
  );
}
