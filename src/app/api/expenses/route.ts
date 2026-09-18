import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit, can, ROLES } from "@/lib/auth";
import { assertPeriodOpen, postExpenseJE, accountIdByCode } from "@/lib/postings";
import { today } from "@/lib/dates";
import { notifyUser } from "@/lib/reports";
import { notifyUsers } from "@/app/api/docs/route";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const c = user.company;
  const action = body.action ?? "create";

  if (action === "create") {
    return runInTransaction(() => {
      const date = body.date || today();
      assertPeriodOpen(cid, date, user.role);
      const amount = Math.round(+body.amount || 0);
      if (amount <= 0) bad("Enter an amount.");
      const tax = Math.round(+body.tax || 0);
      const catAcc = body.category_account_id ? +body.category_account_id : accountIdByCode(cid, "6900")!;
      const threshold = c.approval_expense_threshold ?? 0;
      const needsApproval = amount + tax > threshold;
      const status = user.role === "employee" || needsApproval ? (needsApproval ? "pending_approval" : "posted") : (body.status === "draft" ? "draft" : "posted");
      const id = insert(
        `INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, tax_pct, tax_rate_id, account_id, receipt_doc_id, status, created_by, recur_freq, recur_dom, recur_ends)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        cid, date, body.supplier_id || null, catAcc, body.description || null, amount, tax, +body.tax_pct || 0, body.tax_rate_id || null,
        body.account_id ? +body.account_id : null, body.receipt_doc_id || null, status, user.id,
        body.recur_freq || null, body.recur_dom || null, body.recur_ends || null);
      if (status === "posted") {
        const je = postExpenseJE(id, user.id, user.role);
        run(`UPDATE expenses SET je_id=? WHERE id=?`, je, id);
      } else if (status === "pending_approval") {
        insert(`INSERT INTO approval_requests (company_id, entity_kind, entity_id, step, status, actor_role) VALUES (?,?,?,1,'pending','finance_manager')`, cid, "expense", id);
        notifyUsers(cid, "approval", "warn", "Expense awaiting approval", `${(amount / 100).toLocaleString("en-US")} ${c.base_currency} — ${body.description || "expense"} exceeds the ${((threshold / 100)).toLocaleString("en-US")} approval threshold.`, "/app/purchases/expenses?filter=approvals");
      }
      if (body.receipt_doc_id) run(`UPDATE files SET entity_kind='expense', entity_id=? WHERE id=? AND company_id=?`, id, body.receipt_doc_id, cid);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "expense", entityId: id, summary: `Expense — ${body.description || ""} (${amount / 100})`, new: { amount, tax, status } });
      return { id, status, message: status === "pending_approval" ? "Expense submitted for approval." : status === "draft" ? "Draft saved." : "Expense saved and posted to the ledger." };
    });
  }
  if (action === "update") {
    const ex = get<any>(`SELECT * FROM expenses WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Expense not found.");
    if (ex.status === "posted") bad("Posted expenses are locked for edits — duplicate instead, or ask an accountant to reverse.");
    assertPeriodOpen(cid, body.date ?? ex.date, user.role);
    run(`UPDATE expenses SET date=?, supplier_id=?, category_account_id=?, description=?, amount=?, tax=?, tax_pct=?, account_id=? WHERE id=?`,
      body.date ?? ex.date, body.supplier_id || null, +body.category_account_id || ex.category_account_id, body.description ?? ex.description,
      Math.round(+body.amount || ex.amount), Math.round(+body.tax || 0), +body.tax_pct || 0, body.account_id ? +body.account_id : ex.account_id, ex.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "expense", entityId: ex.id, summary: "Expense edited", old: { amount: ex.amount }, new: { amount: body.amount } });
    return { message: "Expense updated." };
  }
  if (action === "approve") {
    const ex = get<any>(`SELECT * FROM expenses WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    if (ex.status !== "pending_approval" && ex.status !== "approved") bad("Only pending expenses can be approved.");
    if (!can(user.role, "approve", "purchases")) bad("Your role cannot approve expenses.");
    return runInTransaction(() => {
      assertPeriodOpen(cid, ex.date, user.role);
      const je = postExpenseJE(ex.id, user.id, user.role);
      run(`UPDATE expenses SET status='posted', je_id=?, approved_by=?, approved_at=datetime('now') WHERE id=?`, je, user.id, ex.id);
      run(`UPDATE approval_requests SET status='approved', decided_by=?, decided_at=datetime('now'), comment=? WHERE entity_kind='expense' AND entity_id=? AND status='pending'`, user.id, body.comment ?? null, ex.id);
      notifyUser(cid, ex.created_by, { kind: "approval_decision", severity: "success", title: "Expense approved", body: `Your expense (${(ex.amount / 100).toLocaleString("en-US")}) was approved and posted.`, link: "/app/purchases/expenses" });
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "approved", entityKind: "expense", entityId: ex.id, summary: `Expense approved${body.comment ? ` — "${body.comment}"` : ""}` });
      return { message: "Approved, posted to the ledger." };
    });
  }
  if (action === "reject") {
    const ex = get<any>(`SELECT * FROM expenses WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Not found.");
    if (!can(user.role, "approve", "purchases")) bad("Your role cannot reject expenses.");
    run(`UPDATE expenses SET status='rejected', reject_reason=? WHERE id=?`, body.reason ?? null, ex.id);
    run(`UPDATE approval_requests SET status='rejected', decided_by=?, decided_at=datetime('now'), comment=? WHERE entity_kind='expense' AND entity_id=? AND status='pending'`, user.id, body.reason ?? null, ex.id);
    if (ex.created_by) notifyUser(cid, ex.created_by, { kind: "approval_decision", severity: "warn", title: "Expense rejected", body: body.reason || "See expense details for the reason.", link: "/app/purchases/expenses" });
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "rejected", entityKind: "expense", entityId: ex.id, summary: `Expense rejected${body.reason ? ` — ${body.reason}` : ""}` });
    return { message: "Expense rejected." };
  }
  if (action === "delete") {
    const ex = get<any>(`SELECT * FROM expenses WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Expense not found.");
    const payAlloc = get<any>(`SELECT pa.id FROM payment_allocations pa WHERE pa.expense_id=?`, ex.id);
    if (payAlloc) bad("A payment is allocated to this expense — remove the payment first.");
    if (ex.status === "posted") bad("Posted expenses keep their history. Record a supplier credit instead — or an accountant can post a manual reversing entry.");
    return runInTransaction(() => {
      assertPeriodOpen(cid, ex.date, user.role);
      if (ex.je_id) { // draft entry only
        run(`DELETE FROM journal_lines WHERE entry_id=?`, ex.je_id);
        run(`DELETE FROM journal_entries WHERE id=? AND status='draft'`, ex.je_id);
      }
      run(`UPDATE approval_requests SET status='skipped' WHERE entity_kind='expense' AND entity_id=? AND status='pending'`, ex.id);
      run(`DELETE FROM expenses WHERE id=?`, ex.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: "expense", entityId: ex.id, summary: `Expense deleted (${(ex.amount / 100).toFixed(0)})` });
      return { message: "Expense deleted." };
    });
  }
  bad("Unknown action.");
});