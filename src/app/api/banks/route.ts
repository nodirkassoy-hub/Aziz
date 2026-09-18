import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { accountBySubtype, ensureCoa, postTransferJE, postOpeningBalance } from "@/lib/postings";
import { today } from "@/lib/dates";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const action = body.action;

  if (action === "create_account") {
    return runInTransaction(() => {
      ensureCoa(cid);
      const name = String(body.name || "").trim();
      if (!name) bad("Account name is required.");
      // dedicated ledger account for this bank/cash account
      const maxCode = Number(get<any>(`SELECT MAX(CAST(code AS INT)) m FROM accounts WHERE company_id=? AND CAST(code AS INT) BETWEEN 1001 AND 1999`, cid)?.m ?? 1000);
      const accCode = String(Math.min(1999, maxCode + 1));
      const accId = insert(`INSERT INTO accounts (company_id, code, name, type, subtype) VALUES (?,?,?,?,?)`,
        cid, accCode, name, "asset", body.is_cash ? "cash" : "bank");
      const opening = Math.round(+body.opening_balance || 0);
      const id = insert(`INSERT INTO bank_accounts (company_id, name, bank, number, currency, is_cash, opening_balance, opening_date, account_id) VALUES (?,?,?,?,?,?,?,?,?)`,
        cid, name, body.bank || null, body.number || null, body.currency || "UZS", body.is_cash ? 1 : 0, opening, body.opening_date || today(), accId);
      if (opening) postOpeningBalance(cid, accId, opening, body.opening_date || today(), user.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "bank_account", entityId: id, summary: `Bank/cash account ${name} created with opening balance` });
      return { id, message: `${name} created${opening ? ` with an opening balance posted to equity` : ""}.` };
    });
  }
  if (action === "update_account") {
    const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    run(`UPDATE bank_accounts SET name=?, bank=?, number=?, currency=?, archived=? WHERE id=?`,
      body.name ?? ba.name, body.bank ?? ba.bank, body.number ?? ba.number, body.currency ?? ba.currency, body.archived ? 1 : 0, ba.id);
    if (ba.account_id) run(`UPDATE accounts SET name=? WHERE id=?`, body.name ?? ba.name, ba.account_id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "bank_account", entityId: ba.id, summary: `Account ${ba.name} updated` });
    return { message: "Saved." };
  }
  if (action === "add_transaction") {
    // direct bank transaction (manual feed line) e.g. owner deposit / misc
    return runInTransaction(() => {
      const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=? AND company_id=?`, body.account_id, cid) ?? bad("Pick an account.");
      const amount = Math.round(+body.amount || 0);
      if (!amount) bad("Enter a signed amount (negative = money out).");
      const date = body.date || today();
      const lineId = insert(`INSERT INTO bank_lines (company_id, account_id, date, description, amount, status, category) VALUES (?,?,?,?,?,'unmatched',?)`,
        cid, ba.id, date, body.description || "Manual line", amount, body.category || null);
      return { id: lineId, message: "Bank statement line added. Categorize it in Reconciliation to book it." };
    });
  }
  if (action === "transfer") {
    return runInTransaction(() => {
      const amount = Math.round(+body.amount || 0);
      if (amount <= 0) bad("Enter an amount.");
      if (+body.from === +body.to) bad("Choose two different accounts.");
      const je = postTransferJE({ companyId: cid, date: body.date || today(), fromBankId: +body.from, toBankId: +body.to, amount, memo: body.memo || undefined, userId: user.id, role: user.role });
      const from = get<any>(`SELECT name FROM bank_accounts WHERE id=?`, body.from), to = get<any>(`SELECT name FROM bank_accounts WHERE id=?`, body.to);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "transfer", entityId: je, summary: `Transfer ${(amount / 100).toLocaleString("en-US")} from ${from?.name} → ${to?.name}` });
      return { message: `Transfer posted: ${from?.name} → ${to?.name}.` };
    });
  }
  if (action === "sync") {
    bad("No bank feed provider is connected yet. Import statement lines manually or via CSV — Settings → Integrations shows the provider slot.");
  }
  bad("Unknown action.");
}, { perm: "create", area: "finance" });
