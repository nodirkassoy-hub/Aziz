import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit, can, ROLES, SESSION_COOKIE, hashPassword, verifyPassword } from "@/lib/auth";
import { randomToken, userCompanies } from "@/lib/auth";
import { ensureCoa, accountBalance, postOpeningBalance, accountIdByCode, assertPeriodOpen } from "@/lib/postings";
import { cookies } from "next/headers";
import { today } from "@/lib/dates";
import crypto from "crypto";
import { CURRENCY_COOKIE, COMPANY_COOKIE } from "@/lib/auth";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const scope = body.scope;
  const PRIV = ["company", "taxes", "accounting", "users", "currencies"]; // security & profile are self-service
  if (PRIV.includes(scope) && !can(user.role, "manage_settings")) bad("Your role cannot change company settings.");

  if (scope === "company") {
    const fields = ["name", "legal_name", "tax_id", "address", "phone", "email", "website", "bank_name", "bank_account_no", "bank_currency", "tax_authority", "tax_registration", "invoice_notes", "invoice_terms", "accent_color", "invoice_layout", "invoice_prefix", "quote_prefix", "bill_prefix", "payment_terms_days", "fiscal_year_start_month", "approval_expense_threshold", "approval_auto_post_ocr"];
    const sets: string[] = [], vals: any[] = [];
    for (const f of fields) if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(["payment_terms_days", "fiscal_year_start_month", "approval_expense_threshold"].includes(f) ? +body[f] : f === "approval_auto_post_ocr" ? (body[f] ? 1 : 0) : f === "approval_expense_threshold" ? Math.round(+body[f] * 100) : body[f] || null); }
    if (!sets.length) bad("Nothing to save.");
    run(`UPDATE companies SET ${sets.join(",")} WHERE id=?`, ...vals, cid);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "company", entityId: cid, summary: "Company settings updated", new: { fields: sets.length } });
    return { message: "Company settings saved." };
  }

  if (scope === "taxes") {
    const action = body.action ?? "upsert";
    if (action === "delete") {
      const t = get<any>(`SELECT * FROM tax_rates WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Tax not found.");
      const used = get<any>(`SELECT COUNT(*) n FROM trade_doc_items WHERE tax_rate_id=?`, t.id)?.n ?? 0;
      if (used) bad(`${t.name} is used by ${used} document line(s) — archive instead? Archiving keeps old documents valid.`);
      run(`DELETE FROM tax_rates WHERE id=?`, t.id);
      return { message: `${t.name} deleted.` };
    }
    if (action === "archive") { run(`UPDATE tax_rates SET archived=? WHERE id=?`, body.archived ? 1 : 0, body.id); return { message: "Saved." }; }
    const rate_pct = +body.rate_pct || 0;
    if (rate_pct < 0 || rate_pct > 100) bad("Rate must be between 0 and 100.");
    if (body.id) {
      run(`UPDATE tax_rates SET name=?, rate_pct=?, kind=?, applies=?, is_default=?, jurisdiction=? WHERE id=? AND company_id=?`,
        body.name || "Tax", rate_pct, body.kind || "output_input", body.applies || "both", body.is_default ? 1 : 0, body.jurisdiction || null, body.id, cid);
      if (body.is_default) { run(`UPDATE tax_rates SET is_default=0 WHERE company_id=? AND id!=?`, cid, body.id); run(`UPDATE companies SET default_tax_rate_id=? WHERE id=?`, body.id, cid); }
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "tax", entityId: +body.id, summary: `Tax ${body.name} (${rate_pct}%) updated` });
      return { message: "Tax rate updated." };
    }
    const id = insert(`INSERT INTO tax_rates (company_id, name, rate_pct, kind, applies, is_default, jurisdiction) VALUES (?,?,?,?,?,?,?)`,
      cid, body.name || "Tax", rate_pct, body.kind || "output_input", body.applies || "both", body.is_default ? 1 : 0, body.jurisdiction || null);
    if (body.is_default) { run(`UPDATE tax_rates SET is_default=0 WHERE company_id=? AND id!=?`, cid, id); run(`UPDATE companies SET default_tax_rate_id=? WHERE id=?`, id, cid); }
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "tax", entityId: id, summary: `Tax ${body.name} (${rate_pct}%) created` });
    return { id, message: "Tax rate created." };
  }

  if (scope === "accounting") {
    if (body.action === "lock") {
      const period = String(body.period ?? "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(period)) bad("Pick a period (YYYY-MM).");
      if (period > today().slice(0, 7)) bad("You can only close/lock the current or past periods.");
      if (!["owner", "chief_accountant", "cfo", "super_admin"].includes(user.role)) bad("Only owners/CFOs/chief accountants can lock periods.");
      assertPeriodOpen(cid, period + "-01", "owner");
      if (body.status === "open") run(`UPDATE period_locks SET status='open' WHERE company_id=? AND period=?`, cid, period);
      else run(`INSERT INTO period_locks (company_id, period, status, closed_by, closed_at, note) VALUES (?,?,?,?,datetime('now'),?) ON CONFLICT(company_id,period) DO UPDATE SET status=excluded.status, closed_by=?, closed_at=datetime('now'), note=?`, cid, period, body.status, user.id, body.note ?? null, user.id, body.note ?? null);
      run(`UPDATE companies SET lock_date=? WHERE id=?`, body.status === "locked" || body.status === "closed" ? `${period}-28` : get<any>(`SELECT lock_date FROM companies WHERE id=?`, cid)?.lock_date ?? null, cid);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: body.status === "open" ? "unlocked" : "locked", entityKind: "period", entityId: null, summary: `Period ${period} → ${body.status}${body.note ? ` (${body.note})` : ""}` });
      return { message: `Period ${period} is now ${body.status}.` };
    }
    const fields = ["next_invoice_no", "next_quote_no", "next_bill_no", "next_order_no", "next_po_no", "next_je_no", "next_payment_no", "invoice_prefix", "quote_prefix", "bill_prefix", "payment_terms_days", "fiscal_year_start_month", "lock_date"];
    const sets: string[] = [], vals: any[] = [];
    for (const f of fields) if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(f === "lock_date" ? (body[f] || null) : +body[f]); }
    if (sets.length) run(`UPDATE companies SET ${sets.join(",")} WHERE id=?`, ...vals, cid);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "company", entityId: cid, summary: "Accounting policy updated" });
    return { message: "Accounting settings saved." };
  }

  if (scope === "users") {
    const action = body.action;
    if (action === "invite") {
      const email = String(body.email ?? "").toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad("Enter a valid email.");
      if (!ROLES[body.role]) bad("Pick a role.");
      const existing = get<any>(`SELECT * FROM users WHERE lower(email)=?`, email);
      if (existing) {
        if (get(`SELECT id FROM memberships WHERE company_id=? AND user_id=?`, cid, existing.id)) bad("That person is already a member of this company.");
        insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid, existing.id, body.role);
        audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "membership", entityId: existing.id, summary: `Added ${email} as ${body.role.replace(/_/g, " ")}` });
        return { message: `${email} added to this company (account already existed — no invite email configured in this deployment).` };
      }
      // create placeholder user with a random temp password the admin can share; in production this would be an invite email link
      const temp = randomToken(6);
      const uid = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, email, body.name || email.split("@")[0], hashPassword(temp));
      insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid, uid, body.role);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "membership", entityId: uid, summary: `Invited ${email} as ${body.role.replace(/_/g, " ")}` });
      return { message: `${email} invited as ${body.role.replace(/_/g, " ")}.`, temp_password: temp };
    }
    if (action === "set_role") {
      const m = get<any>(`SELECT * FROM memberships WHERE company_id=? AND user_id=?`, cid, body.user_id) ?? bad("Member not found.");
      if (!ROLES[body.role]) bad("Pick a role.");
      const owners = get<any>(`SELECT COUNT(*) n FROM memberships WHERE company_id=? AND role IN ('owner','super_admin')`, cid)?.n ?? 0;
      if (owners <= 1 && ["owner", "super_admin"].includes(m.role) && !["owner", "super_admin"].includes(body.role)) bad("The company must keep at least one owner.");
      run(`UPDATE memberships SET role=? WHERE id=?`, body.role, m.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "membership", entityId: m.id, summary: `Role changed: ${m.role} → ${body.role}`, old: { role: m.role }, new: { role: body.role } });
      return { message: "Role updated." };
    }
    if (action === "remove") {
      const m = get<any>(`SELECT * FROM memberships WHERE company_id=? AND user_id=?`, cid, body.user_id) ?? bad("Member not found.");
      const owners = get<any>(`SELECT COUNT(*) n FROM memberships WHERE company_id=? AND role IN ('owner','super_admin')`, cid)?.n ?? 0;
      if (owners <= 1 && ["owner", "super_admin"].includes(m.role)) bad("You cannot remove the last owner.");
      if (m.user_id === user.id) bad("Remove your own access from the profile page instead.");
      run(`DELETE FROM memberships WHERE id=?`, m.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: "membership", entityId: m.id, summary: `Removed member #${m.user_id} from company` });
      return { message: "Member removed from this company." };
    }
    bad("Unknown user action.");
  }

  if (scope === "currencies") {
    if (body.action === "rate") {
      const from = String(body.from_currency).toUpperCase(), to = String(body.to_currency).toUpperCase();
      if (from === to) bad("Currencies must differ.");
      const rate = +body.rate;
      if (!(rate > 0)) bad("Enter a positive rate.");
      run(`INSERT INTO exchange_rates (company_id, date, from_currency, to_currency, rate, source) VALUES (?,?,?,?,?,'manual')
           ON CONFLICT(company_id, date, from_currency, to_currency) DO UPDATE SET rate=excluded.rate`, cid, body.date || today(), from, to, rate);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "exchange_rate", entityId: null, summary: `FX ${from}/${to} = ${rate} (${body.date || today()})` });
      return { message: `Rate ${from}→${to} saved.` };
    }
    if (body.action === "base") {
      const cur = String(body.base_currency).toUpperCase();
      run(`UPDATE companies SET base_currency=? WHERE id=?`, cur, cid);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "company", entityId: cid, summary: `Base currency changed to ${cur}` });
      return { message: `Base currency is now ${cur}. Older postings stay in their recorded base amounts.` };
    }
    bad("Unknown currency action.");
  }

  if (scope === "profile") {
    run(`UPDATE users SET name=?, email=? WHERE id=?`, body.name || user.name, body.email || user.email, user.id);
    if (body.new_password) {
      if (!verifyPassword(body.current_password ?? "", get<any>(`SELECT password_hash FROM users WHERE id=?`, user.id).password_hash)) bad("Current password is incorrect.");
      if (String(body.new_password).length < 8) bad("New password must be at least 8 characters.");
      run(`UPDATE users SET password_hash=? WHERE id=?`, hashPassword(String(body.new_password)), user.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "user", entityId: user.id, summary: "Password changed" });
    }
    return { message: "Profile saved." };
  }

  if (scope === "security") {
    if (body.action === "revoke_sessions") {
      run(`DELETE FROM sessions WHERE user_id=? AND id != ?`, user.id, cookies().get(SESSION_COOKIE)?.value);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "user", entityId: user.id, summary: "Revoked all other sessions" });
      return { message: "Other sessions were signed out." };
    }
    if (body.action === "2fa_enable") {
      let secret = get<any>(`SELECT twofa_secret FROM users WHERE id=?`, user.id)?.twofa_secret;
      if (!secret) { secret = base32Encode(crypto.randomBytes(20)); run(`UPDATE users SET twofa_secret=? WHERE id=?`, secret, user.id); }
      if (!body.code) return { secret, otpauth: `otpauth://totp/Mizom:${user.email}?secret=${secret}&issuer=Mizom&period=30&digits=6` };
      if (!verifyTotp(secret, String(body.code))) bad("Code doesn't match — check your authenticator app (30 s window).");
      run(`UPDATE users SET twofa_enabled=1 WHERE id=?`, user.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "user", entityId: user.id, summary: "Two-factor authentication enabled" });
      return { message: "2FA enabled. Save your recovery notes before signing out." };
    }
    if (body.action === "2fa_disable") {
      if (!verifyTotp(get<any>(`SELECT twofa_secret FROM users WHERE id=?`, user.id)?.twofa_secret ?? "", String(body.code ?? ""))) bad("Enter a valid authenticator code to disable 2FA.");
      run(`UPDATE users SET twofa_enabled=0, twofa_secret=NULL WHERE id=?`, user.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "user", entityId: user.id, summary: "Two-factor authentication disabled" });
      return { message: "2FA disabled." };
    }
    bad("Unknown security action.");
  }

  if (scope === "notifications") {
    run(`UPDATE memberships SET prefs_json=? WHERE company_id=? AND user_id=?`, JSON.stringify({ notify: body.prefs ?? {} }), cid, user.id);
    return { message: "Notification preferences saved." };
  }

  bad("Unknown settings scope.");
});

/* TOTP helpers live in @/lib/totp */
import { base32Encode, verifyTotp } from "@/lib/totp";
