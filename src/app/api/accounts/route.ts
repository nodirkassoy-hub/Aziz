import { handler, bad } from "@/lib/api";
import { all, get, insert, run } from "@/lib/db";
import { audit } from "@/lib/auth";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  if (body.action === "create") {
    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!code || !name) bad("Code and name are required.");
    if (get(`SELECT id FROM accounts WHERE company_id=? AND code=?`, cid, code)) bad(`Code ${code} already exists.`);
    if (!["asset", "liability", "equity", "revenue", "expense"].includes(body.type)) bad("Choose a valid account type.");
    const id = insert(`INSERT INTO accounts (company_id, code, name, type, subtype, description) VALUES (?,?,?,?,?,?)`,
      cid, code, name, body.type, body.subtype || (body.type === "expense" ? "category" : null), body.description || null);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "account", entityId: id, summary: `Account ${code} — ${name} created` });
    return { id, message: `Account ${code} created.` };
  }
  if (body.action === "update") {
    const a = get<any>(`SELECT * FROM accounts WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Account not found.");
    run(`UPDATE accounts SET name=?, description=?, subtype=? WHERE id=?`, body.name ?? a.name, body.description ?? a.description, body.subtype ?? a.subtype, a.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "account", entityId: a.id, summary: `Account ${a.code} edited`, old: a, new: { name: body.name } });
    return { message: "Account updated." };
  }
  if (body.action === "archive") {
    const a = get<any>(`SELECT * FROM accounts WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Account not found.");
    const used = get<any>(`SELECT COUNT(*) n FROM journal_lines WHERE account_id=?`, a.id)?.n ?? 0;
    if (used > 0 && body.hard) bad("Account has postings — archive instead of changing type.");
    if (a.is_system && body.type) bad("System accounts keep their type so reports stay correct.");
    run(`UPDATE accounts SET archived=? WHERE id=?`, body.archived ? 1 : 0, a.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "account", entityId: a.id, summary: `Account ${a.code} ${body.archived ? "archived" : "restored"}` });
    return { message: body.archived ? "Account archived (history kept)." : "Account restored." };
  }
  if (body.action === "delete") {
    const a = get<any>(`SELECT * FROM accounts WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Account not found.");
    const used = get<any>(`SELECT COUNT(*) n FROM journal_lines WHERE account_id=?`, a.id)?.n ?? 0;
    if (used > 0) bad(`This account has ${used} postings. Archive it to keep reports intact.`);
    if (a.is_system) bad("System accounts drive core reports and cannot be deleted.");
    run(`DELETE FROM accounts WHERE id=?`, a.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: "account", entityId: a.id, summary: `Unused account ${a.code} deleted` });
    return { message: "Unused account deleted." };
  }
  bad("Unknown action.");
}, { perm: "create", area: "accounting" });
