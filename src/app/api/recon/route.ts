import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { accountBySubtype, accountIdByCode, postEntry, assertPeriodOpen, linkedLedgerAccount } from "@/lib/postings";
import { today } from "@/lib/dates";
import { notifyUsers } from "@/app/api/docs/route";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const action = body.action;

  if (action === "start") {
    const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=? AND company_id=?`, body.account_id, cid) ?? bad("Account not found.");
    const existing = get<any>(`SELECT * FROM reconciliations WHERE company_id=? AND account_id=? AND status='open'`, cid, ba.id);
    if (existing) return { id: existing.id, message: "Resumed the open reconciliation session for this account." };
    const id = insert(`INSERT INTO reconciliations (company_id, account_id, opening_balance, ending_balance, start_date, end_date, created_by)
      VALUES (?,?,?,?,?,?,?)`, cid, ba.id, Math.round(+body.opening_balance || 0), Math.round(+body.ending_balance || 0), body.start_date || "2020-01-01", body.end_date || today(), user.id);
    return { id, message: "Reconciliation session started." };
  }

  if (action === "match") {
    // link a bank line to a book movement (payment/expense) or simply mark reconciled
    const line = get<any>(`SELECT * FROM bank_lines WHERE id=? AND company_id=?`, body.line_id, cid) ?? bad("Bank line not found.");
    if (line.status === "matched") bad("This line is already matched.");
    return runInTransaction(() => {
      let matchedTo = "";
      if (body.payment_id) {
        const p = get<any>(`SELECT * FROM payments WHERE id=? AND company_id=?`, body.payment_id, cid) ?? bad("Payment not found.");
        if (p.account_id !== line.account_id) bad("The payment uses a different account than this statement line.");
        run(`UPDATE bank_lines SET status='matched', matched_payment_id=?, category=COALESCE(?,category) WHERE id=?`, p.id, body.category ?? null, line.id);
        matchedTo = p.number ?? `payment #${p.id}`;
      } else if (body.expense_id) {
        run(`UPDATE bank_lines SET status='matched', matched_expense_id=?, category=COALESCE(?,category) WHERE id=?`, +body.expense_id, body.category ?? null, line.id);
        matchedTo = `expense #${body.expense_id}`;
      } else if (body.amount === line.amount && body.amount !== undefined) bad("Provide a payment or expense to match against.");
      else {
        // manual match: mark line as reviewed+matched with no counterpart (rare) → needs review instead
        bad("Manual matches must reference a payment or expense. Or use 'Ignore' for noise lines.");
      }
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "matched", entityKind: "bank_line", entityId: line.id, summary: `Bank line “${line.description}” (${(line.amount / 100).toLocaleString("en-US")}) matched to ${matchedTo}` });
      return { message: `Matched to ${matchedTo}.` };
    });
  }

  if (action === "auto_match") {
    const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=? AND company_id=?`, body.account_id, cid) ?? bad("Pick an account first.");
    let count = 0;
    return runInTransaction(() => {
      const lines = all<any>(`SELECT * FROM bank_lines WHERE company_id=? AND account_id=? AND status IN ('unmatched','review')`, cid, ba.id);
      for (const l of lines) {
        // exact amount + ±3 day window against recorded payments
        const p = get<any>(
          `SELECT * FROM payments WHERE company_id=? AND account_id=? AND je_id IS NOT NULL AND (CASE WHEN direction='in' THEN amount ELSE -amount END)=?
             AND date BETWEEN date(?,'-3 days') AND date(?,'+3 days') AND id NOT IN (SELECT matched_payment_id FROM bank_lines WHERE matched_payment_id IS NOT NULL)
           LIMIT 1`, cid, ba.id, l.amount, l.date, l.date);
        if (p) { run(`UPDATE bank_lines SET status='matched', matched_payment_id=? WHERE id=?`, p.id, l.id); count++; }
      }
      if (count) audit({ companyId: cid, userId: user.id, userName: user.name, action: "matched", entityKind: "bank_account", entityId: ba.id, summary: `Auto-match reconciled ${count} bank line(s)` });
      return { count, message: count ? `Auto-matched ${count} line${count > 1 ? "s" : ""} by amount & date (±3 days).` : "No further exact matches found — review the rest manually." };
    });
  }

  if (action === "create_transaction") {
    // turn an unmatched bank line into a booked transaction (expense/receipt/transfer)
    const line = get<any>(`SELECT * FROM bank_lines WHERE id=? AND company_id=?`, body.line_id, cid) ?? bad("Line not found.");
    return runInTransaction(() => {
      assertPeriodOpen(cid, line.date, user.role);
      const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=?`, line.account_id)!;
      const ledgerAcc = linkedLedgerAccount(ba.id) ?? accountBySubtype(cid, "bank").id;
      const kind = body.kind || (line.amount > 0 ? "receipt" : "expense");
      const abs = Math.abs(line.amount);
      if (kind === "transfer") bad("Transfers between accounts are recorded in Finance → Transfers, then matched here.");
      const expenseAcc = body.account_id ? get<any>(`SELECT * FROM accounts WHERE id=? AND company_id=?`, body.account_id, cid) : null;
      const expenseAccId = expenseAcc?.id ?? accountIdByCode(cid, "6900")!;
      const tax = body.tax_amount ? Math.round(+body.tax_amount) : 0;
      if (kind === "receipt") {
        const je = postEntry({
          companyId: cid, date: line.date, description: line.description || "Bank receipt", sourceKind: "reconcile", sourceId: line.id, userId: user.id,
          lines: [
            { accountId: ledgerAcc, debit: abs, credit: 0, memo: line.description },
            { accountId: expenseAcc?.id && expenseAcc.type === "liability" ? expenseAcc.id : accountBySubtype(cid, "ar").id, debit: 0, credit: abs, memo: "On-account receipt (apply to invoice)" },
          ],
        });
        run(`UPDATE bank_lines SET status='created', created_doc_kind='payment', created_doc_id=?, category=? WHERE id=?`, je, body.category ?? null, line.id);
        audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "bank_line", entityId: line.id, summary: `Receipt created from bank line “${line.description}”` });
        return { message: "Receipt booked (on-account). Apply it to invoices from the Payments screen." };
      }
      if (tax > abs) bad("Input tax cannot exceed the line amount.");
      const je = postEntry({
        companyId: cid, date: line.date, description: line.description || "Bank expense", sourceKind: "reconcile", sourceId: line.id, userId: user.id,
        lines: [
          { accountId: expenseAccId, debit: abs - tax, credit: 0, memo: line.description },
          ...(tax > 0 ? [{ accountId: accountIdByCode(cid, "2100")!, debit: tax, credit: 0, memo: "Input tax" }] : []),
          { accountId: ledgerAcc, debit: 0, credit: abs, memo: line.description },
        ],
      });
      const exId = insert(`INSERT INTO expenses (company_id, date, category_account_id, description, amount, tax, account_id, status, created_by, je_id)
        VALUES (?,?,?,?,?,?,?,'posted',?,?)`, cid, line.date, expenseAccId, line.description || "From bank feed", abs - tax, tax, ba.id, user.id, je);
      void exId;
      run(`UPDATE bank_lines SET status='created', created_doc_kind='expense', created_doc_id=?, category=? WHERE id=?`, exId, body.category ?? null, line.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "bank_line", entityId: line.id, summary: `Expense booked from bank line “${line.description}”` });
      return { message: "Expense categorized and posted." };
    });
  }

  if (action === "ignore") {
    const line = get<any>(`SELECT * FROM bank_lines WHERE id=? AND company_id=?`, body.line_id, cid) ?? bad("Line not found.");
    run(`UPDATE bank_lines SET status='ignored', category=? WHERE id=?`, body.reason ?? "Ignored", line.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "bank_line", entityId: line.id, summary: `Bank line ignored${body.reason ? ` — ${body.reason}` : ""}` });
    return { message: "Line ignored for this period." };
  }
  if (action === "unmatch") {
    const line = get<any>(`SELECT * FROM bank_lines WHERE id=? AND company_id=?`, body.line_id, cid) ?? bad("Line not found.");
    if (line.status === "created") bad("Created documents must be deleted from their own screen; the line stays as evidence.");
    run(`UPDATE bank_lines SET status='review', matched_payment_id=NULL, matched_expense_id=NULL WHERE id=?`, line.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "unmatched", entityKind: "bank_line", entityId: line.id, summary: `Unmatched bank line “${line.description}”` });
    return { message: "Unmatched — needs review." };
  }
  if (action === "split") {
    const line = get<any>(`SELECT * FROM bank_lines WHERE id=? AND company_id=?`, body.line_id, cid) ?? bad("Line not found.");
    if (line.status === "matched") bad("Unmatch the line first, then split it.");
    const parts: number[] = (body.splits ?? []).map((x: any) => Math.round(+x));
    if (!parts.length) bad("Enter the split amounts.");
    const sum = parts.reduce((s: number, x: number) => s + Math.abs(x), 0);
    if (Math.abs(sum - Math.abs(line.amount)) > 1) bad(`Splits must total the line amount (difference ${Math.abs(sum - Math.abs(line.amount)) / 100}).`);
    return runInTransaction(() => {
      let rest = line.amount;
      const sign = Math.sign(line.amount) || 1;
      parts.forEach((p, i) => {
        const v = i === parts.length - 1 ? rest : sign * Math.abs(p);
        rest -= v;
        insert(`INSERT INTO bank_lines (company_id, account_id, date, description, amount, status) VALUES (?,?,?,?,?,'review')`,
          cid, line.account_id, line.date, `${line.description} (split ${i + 1})`, v);
      });
      run(`DELETE FROM bank_lines WHERE id=?`, line.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "bank_line", entityId: line.id, summary: `Bank line split into ${parts.length}` });
      return { message: `Split into ${parts.length} review lines.` };
    });
  }
  if (action === "close") {
    const rec = get<any>(`SELECT * FROM reconciliations WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Session not found.");
    const ba = get<any>(`SELECT * FROM bank_accounts WHERE id=?`, rec.account_id)!;
    const unrecon = get<any>(`SELECT COUNT(*) n FROM bank_lines WHERE company_id=? AND account_id=? AND status IN ('unmatched','review') AND date<=?`, cid, ba.id, rec.end_date)?.n ?? 0;
    if (unrecon > 0 && !body.force) bad(`${unrecon} line(s) still need review. Reconcile them to zero difference, or force-close with a note.`);
    return runInTransaction(() => {
      run(`UPDATE reconciliations SET status='closed', closed_at=datetime('now') WHERE id=?`, rec.id);
      run(`UPDATE bank_lines SET recon_id=? WHERE company_id=? AND account_id=? AND date<=? AND recon_id IS NULL AND status IN ('matched','ignored','created')`, rec.id, cid, ba.id, rec.end_date);
      const period = rec.end_date.slice(0, 7);
      const locked = body.lock ? 1 : 0;
      if (locked) run(`INSERT INTO period_locks (company_id, period, status, closed_by, closed_at, note) VALUES (?,?,?,?,datetime('now'),?) ON CONFLICT(company_id, period) DO UPDATE SET status='locked', closed_by=excluded.closed_by, closed_at=datetime('now')`, cid, period, "locked", user.id, `Closed from reconciliation${unrecon ? ` with ${unrecon} forced lines` : ""}`);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "locked", entityKind: "reconciliation", entityId: rec.id, summary: `Reconciled ${ba.name} through ${rec.end_date}${locked ? " and locked the period" : ""}` });
      notifyUsers(cid, "recon", "success", `Reconciliation closed — ${ba.name}`, `Statement through ${rec.end_date} is reconciled${locked ? ` and ${period} is locked` : ""}.`, "/app/accounting/reconciliation");
      return { message: `Reconciliation closed${locked ? `; period ${period} locked` : ""}.` };
    });
  }
  bad("Unknown action.");
}, { perm: "edit", area: "accounting" });
