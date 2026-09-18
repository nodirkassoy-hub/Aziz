import { NextResponse } from "next/server";
import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { assertPeriodOpen, nextNumber, postPaymentJE, recalcDocStatus } from "@/lib/postings";
import { today } from "@/lib/dates";
import { notifyUsers } from "@/lib/notify";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const action = body.action ?? "create";

  if (action === "create") {
    return runInTransaction(() => {
      const date = body.date || today();
      assertPeriodOpen(cid, date, user.role);
      const bank = get<any>(`SELECT * FROM bank_accounts WHERE id=? AND company_id=?`, body.account_id, cid) ?? bad("Select a receiving/paying bank account.");
      const currency = body.currency || bank.currency || user.company.base_currency;
      const fx = currency === user.company.base_currency ? 1 : +body.fx_rate || 1;
      // amount is entered in DOCUMENT currency; base = amount * fx (when input in foreign) — here we accept base amount directly for simplicity:
      const amountBase = body.amount_foreign && currency !== user.company.base_currency
        ? Math.round(+body.amount_foreign * fx) : Math.round(+body.amount || 0);
      if (amountBase <= 0) bad("Amount must be positive.");
      const allocations: { doc_id?: number; expense_id?: number; amount: number }[] = (body.allocations ?? [])
        .filter((a: any) => +a.amount > 0)
        .map((a: any) => ({ doc_id: a.doc_id ? +a.doc_id : undefined, expense_id: a.expense_id ? +a.expense_id : undefined, amount: Math.round(+a.amount) }));
      const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
      if (allocSum > amountBase) bad("Allocated amounts exceed the payment amount.");
      if (body.direction !== "in" && body.direction !== "out") bad("Direction must be in or out.");
      if (body.direction === "out" && bank.is_cash === 0) { /* fine */ }
      const party = body.party_id ? get<any>(`SELECT * FROM ${body.direction === "in" ? "customers" : "suppliers"} WHERE id=? AND company_id=?`, body.party_id, cid) : null;
      const number = nextNumber(cid, "payment");
      const id = insert(
        `INSERT INTO payments (company_id, number, direction, date, party_id, party_type, customer_id, supplier_id, account_id, method, reference, note, currency, fx_rate, amount, amount_foreign, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'recorded',?)`,
        cid, number, body.direction, date, party?.id ?? null, party ? (body.direction === "in" ? "customer" : "supplier") : null,
        body.direction === "in" ? party?.id ?? null : null, body.direction === "out" ? party?.id ?? null : null,
        bank.id, body.method ?? "bank", body.reference || null, body.note || null, currency, fx,
        amountBase, currency !== user.company.base_currency ? Math.round(amountBase / fx) : amountBase, user.id);
      for (const a of allocations) {
        insert(`INSERT INTO payment_allocations (payment_id, doc_id, expense_id, amount) VALUES (?,?,?,?)`, id, a.doc_id ?? null, a.expense_id ?? null, a.amount);
        if (a.doc_id) {
          const d = get<any>(`SELECT * FROM trade_docs WHERE id=? AND company_id=?`, a.doc_id, cid);
          if (!d) bad("An invoice/bill being paid no longer exists.");
          if (d.paid + a.amount > d.total_base) bad(`Allocation exceeds the outstanding balance of ${d.number}.`);
          run(`UPDATE trade_docs SET paid = paid + ? WHERE id=?`, a.amount, a.doc_id);
        }
        if (a.expense_id) {
          const ex = get<any>(`SELECT * FROM expenses WHERE id=? AND company_id=?`, a.expense_id, cid) ?? bad("Expense not found.");
          run(`UPDATE expenses SET account_id=? WHERE id=?`, bank.id, a.expense_id); // marks as paid through this account
        }
      }
      const je = postPaymentJE(id, user.id, user.role);
      run(`UPDATE payments SET je_id=? WHERE id=?`, je, id);
      for (const a of allocations) if (a.doc_id) recalcDocStatus(a.doc_id);
      // match bank feed line if exists (auto-reconcile happy path)
      const bankLine = get<any>(`SELECT * FROM bank_lines WHERE company_id=? AND account_id=? AND status IN ('unmatched','review') AND amount=? AND date BETWEEN date(?,'-3 days') AND date(?,'+3 days') LIMIT 1`, cid, bank.id, body.direction === "in" ? amountBase : -amountBase, date, date);
      if (bankLine) run(`UPDATE bank_lines SET status='matched', matched_payment_id=?, recon_id=recon_id WHERE id=?`, id, bankLine.id);
      const partyName = party?.name ?? "unassigned";
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "paid", entityKind: "payment", entityId: id, summary: `${body.direction === "in" ? "Receipt" : "Payment"} ${number} — ${amountBase / 100} ${user.company.base_currency} (${partyName})`, new: { amount: amountBase } });
      if (body.direction === "in") notifyUsers(cid, "payment_received", "success", `Payment received — ${number}`, `${partyName} paid ${(amountBase / 100).toLocaleString("en-US")} ${user.company.base_currency}.`, `/app/sales/payments`);
      for (const a of allocations) if (a.doc_id) recalcDocStatus(a.doc_id);
      return { id, number, message: `${body.direction === "in" ? "Receipt" : "Payment"} ${number} recorded and posted to the ledger.` };
    });
  }

  if (action === "delete") {
    const p = get<any>(`SELECT * FROM payments WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    if (p.je_id) {
      const e = get<any>(`SELECT status FROM journal_entries WHERE id=?`, p.je_id);
      if (e?.status === "posted") assertPeriodOpen(cid, p.date, user.role);
    }
    return runInTransaction(() => {
      for (const a of all<any>(`SELECT * FROM payment_allocations WHERE payment_id=?`, p.id)) {
        if (a.doc_id) run(`UPDATE trade_docs SET paid = MAX(0, paid - ?) WHERE id=?`, a.amount, a.doc_id);
      }
      if (p.je_id) {
        run(`INSERT INTO journal_entries (company_id, entry_no, date, description, source_kind, source_id, status, period, created_by)
             VALUES (?,?,?, 'Reversal of payment '||?, 'manual',?, 'draft', strftime('%Y-%m',?), ?)`, cid, "DRAFT", p.date, p.id, p.id, p.date, user.id);
        run(`DELETE FROM journal_lines WHERE entry_id=?`, p.je_id);
        run(`DELETE FROM journal_entries WHERE id=?`, p.je_id);
      }
      run(`DELETE FROM payment_allocations WHERE payment_id=?`, p.id);
      run(`UPDATE bank_lines SET status='unmatched', matched_payment_id=NULL WHERE matched_payment_id=?`, p.id);
      run(`DELETE FROM payments WHERE id=?`, p.id);
      for (const a of all<any>(`SELECT doc_id FROM payment_allocations WHERE doc_id IS NOT NULL GROUP BY doc_id`, p.id)) recalcDocStatus(a.doc_id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: "payment", entityId: p.id, summary: `Payment ${p.number} deleted (reversed)` });
      return { message: `${p.number} removed. Documents were recalculated.` };
    });
  }
  bad("Unknown action.");
});
