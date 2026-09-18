"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUserIdOrNull, COMPANY_COOKIE } from "@/lib/auth";
import { get, insert, run, runInTransaction } from "@/lib/db";
import { ensureCoa, postOpeningBalance, accountIdByCode, nextNumber } from "@/lib/postings";
import { today } from "@/lib/dates";

export async function createCompany(input: { name: string; legalName?: string; taxId?: string; baseCurrency: string; jurisdiction?: string; bankOpening?: number }) {
  const uid = currentUserIdOrNull();
  if (!uid) redirect("/login");
  const name = String(input.name ?? "").trim();
  if (name.length < 2) return { error: "Company name is required." };
  const cid = runInTransaction(() => {
    const cid = insert(`INSERT INTO companies (name, legal_name, tax_id, base_currency, onboarded, invoice_prefix, quote_prefix, bill_prefix)
      VALUES (?,?,?,?,1,'INV','QUO','BILL')`, name, input.legalName?.trim() || null, input.taxId?.trim() || null, input.baseCurrency);
    run(`UPDATE companies SET tax_authority=? WHERE id=?`, input.jurisdiction?.trim() || null, cid);
    insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid, uid, "owner");
    ensureCoa(cid);
    if (input.bankOpening && input.bankOpening > 0) {
      const acc = accountIdByCode(cid, "1010")!;
      const baId = insert(`INSERT INTO bank_accounts (company_id, name, currency, is_cash, opening_balance, opening_date, account_id) VALUES (?,?,?,0,?,?,?)`,
        cid, "Primary", input.baseCurrency, input.bankOpening, today(), acc);
      void baId;
      postOpeningBalance(cid, acc, input.bankOpening, today(), uid);
    }
    return cid;
  });
  cookies().set(COMPANY_COOKIE, String(cid), { path: "/", maxAge: 31536000 });
  return { ok: true, cid };
}
