/** Server-side helpers for authenticated pages & API routes. */
import { redirect } from "next/navigation";
import { currentUser, currentUserIdOrNull, type SessionUser, userCompanies } from "./auth";
import { all, get } from "./db";
import { CURRENCY_COOKIE, COMPANY_COOKIE, PERIOD_COOKIE } from "./auth";

export function requireUser(): SessionUser {
  const u = currentUser();
  if (!u) redirect(authed() ? "/onboarding" : "/login");
  return u!;
}
function authed(): boolean {
  try { return currentUserIdOrNull() != null && userCompanies(currentUserIdOrNull()!).length === 0; } catch { return false; }
}
export function companiesOf(u: SessionUser) { return userCompanies(u.id); }
export function listCurrencies(companyId: number): string[] {
  const sets = new Set<string>();
  const c = get<any>(`SELECT base_currency FROM companies WHERE id=?`, companyId);
  sets.add(c?.base_currency ?? "UZS");
  for (const r of all<any>(`SELECT DISTINCT currency FROM bank_accounts WHERE company_id=? AND archived=0`, companyId)) sets.add(r.currency);
  for (const r of all<any>(`SELECT DISTINCT to_currency c FROM exchange_rates WHERE company_id=?`, companyId)) if (r.c) sets.add(r.c);
  return [...sets];
}
export function convert(minor: number, from: string, to: string, companyId: number): number {
  // base -> display conversion using latest stored rate; identity when same.
  if (!from || !to || from === to) return minor;
  if (to === "UZS" && from !== "UZS") { const r = get<any>(`SELECT rate FROM exchange_rates WHERE company_id=? AND from_currency=? ORDER BY date DESC LIMIT 1`, companyId, from); return r ? Math.round(minor * r.rate) : minor; }
  if (from === "UZS") { const r = get<any>(`SELECT rate FROM exchange_rates WHERE company_id=? AND to_currency=? AND from_currency='UZS' ORDER BY date DESC LIMIT 1`, companyId, to) ?? get<any>(`SELECT rate FROM exchange_rates WHERE company_id=? AND from_currency=? AND to_currency='UZS' ORDER BY date DESC LIMIT 1`, companyId, to); return r ? Math.round(minor / r.rate) : minor; }
  return minor; // cross-rate unsupported → show base with note
}
export { CURRENCY_COOKIE, COMPANY_COOKIE, PERIOD_COOKIE };
