import { handler, bad } from "@/lib/api";
import { get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { postEntry, accountBySubtype, postOpeningBalance } from "@/lib/postings";
import { today } from "@/lib/dates";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const action = body.action ?? "create";
  const table = body.party_type === "supplier" ? "suppliers" : "customers";

  if (action === "delete" || action === "archive") {
    const p = get<any>(`SELECT * FROM ${table} WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    const openDocs = get<any>(`SELECT COUNT(*) n FROM trade_docs WHERE company_id=? AND party_id=? AND kind=? AND status IN ('sent','partial','overdue')`, cid, p.id, table === "customers" ? "invoice" : "bill")?.n ?? 0;
    if (action === "delete" && openDocs > 0) bad(`${p.name} still has ${openDocs} unpaid document(s). Settle them first — or archive the contact to hide it from pickers while keeping the history.`);
    run(`UPDATE ${table} SET archived=? WHERE id=?`, action === "archive" ? 1 : 0, p.id);
    if (action === "delete") run(`UPDATE ${table} SET archived=1 WHERE id=?`, p.id); // never hard-delete ledger-linked parties
    audit({ companyId: cid, userId: user.id, userName: user.name, action: action === "archive" ? "edited" : "deleted", entityKind: table, entityId: p.id, summary: `${p.name} ${action === "archive" ? "archived" : "deleted (archived — history kept)"}` });
    return { message: action === "archive" ? `${p.name} archived.` : `${p.name} removed from active list (documents & ledger history are preserved).` };
  }

  if (action === "opening_balance") {
    const p = get<any>(`SELECT * FROM ${table} WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    const amt = Math.round(+body.amount || 0);
    if (!amt) bad("Enter an opening balance amount.");
    return runInTransaction(() => {
      const acc = accountBySubtype(cid, table === "customers" ? "ar" : "ap");
      postEntry({
        companyId: cid, date: body.date || today(), userId: user.id,
        description: `Opening balance — ${p.name}`, ref: null as any, sourceKind: "opening", sourceId: p.id,
        lines: table === "customers"
          ? [{ accountId: acc.id, debit: amt, credit: 0 }, { accountId: accountBySubtype(cid, "capital").id, debit: 0, credit: amt, memo: "Opening balance equity" }]
          : [{ accountId: accountBySubtype(cid, "capital").id, debit: amt, credit: 0 }, { accountId: acc.id, debit: 0, credit: amt }],
      });
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: table, entityId: p.id, summary: `Opening balance ${amt / 100} for ${p.name}` });
      return { message: "Opening balance posted to the ledger." };
    });
  }

  // create / update
  const fields = table === "customers"
    ? { name: 1, contact_person: 1, phone: 1, email: 1, tax_id: 1, address: 1, credit_limit: 1, currency: 1, notes: 1 }
    : { name: 1, contact_person: 1, phone: 1, email: 1, tax_id: 1, address: 1, currency: 1, notes: 1, payment_terms_days: 1 };
  const keys = Object.keys(fields).filter(k => body[k] !== undefined);
  if (action === "create" && !body.name) bad("Name is required.");
  if (action === "create") {
    const cols = keys.join(", "), marks = keys.map(() => "?").join(",");
    const id = insert(`INSERT INTO ${table} (company_id, ${cols}) VALUES (?,${marks})`, cid, ...keys.map(k => k === "credit_limit" ? Math.round(+body[k] * 100) : body[k]));
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: table, entityId: id, summary: `${table === "customers" ? "Customer" : "Supplier"} ${body.name} added`, new: { name: body.name } });
    return { id, message: `${body.name} added.` };
  }
  if (action === "update") {
    const p = get<any>(`SELECT * FROM ${table} WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    const sets = keys.map(k => `${k}=?`).join(", ");
    run(`UPDATE ${table} SET ${sets} WHERE id=?`, ...keys.map(k => k === "credit_limit" ? Math.round(+body[k] * 100) : body[k]), p.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: table, entityId: p.id, summary: `${p.name} updated`, old: p, new: body });
    return { message: "Saved." };
  }
  bad("Unknown action.");
});
