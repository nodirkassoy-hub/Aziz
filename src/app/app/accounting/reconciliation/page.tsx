import { requireUser, convert } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/kit";
import { can } from "@/lib/auth";
import { today } from "@/lib/dates";
import { ReconClient } from "./client";

export const metadata = { title: "Bank reconciliation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const banks = all<any>(`SELECT ba.id, ba.name, ba.currency, ba.is_cash, ba.account_id,
      ba.opening_balance + COALESCE((SELECT SUM(l.debit - l.credit) FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.account_id=ba.account_id),0) AS book_balance
    FROM bank_accounts ba WHERE ba.company_id=? AND ba.archived=0 ORDER BY ba.is_cash, ba.name`, cid);
  const sel = banks.find((b: any) => String(b.id) === String(searchParams?.account)) ?? banks[0];
  if (!sel) return (<><PageHeader title="Bank reconciliation" desc="Add a bank account first (Finance → Bank Accounts)." /><EmptyState title="No bank accounts" /></>);
  const lines = all<any>(`SELECT bl.*, (SELECT p.number FROM payments p WHERE p.id=bl.matched_payment_id) AS matched_payment_no,
      (SELECT ex.description FROM expenses ex WHERE ex.id=bl.matched_expense_id) AS matched_expense_desc
    FROM bank_lines bl WHERE bl.company_id=? AND bl.account_id=? ORDER BY bl.date DESC, bl.id DESC LIMIT 300`, cid, sel.id);
  const session = get<any>(`SELECT * FROM reconciliations WHERE company_id=? AND account_id=? AND status='open'`, cid, sel.id);
  const payments = all<any>(
    `SELECT p.id, p.number, p.date, CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END AS signed_amount, COALESCE(c.name,s.name) AS party
     FROM payments p LEFT JOIN customers c ON c.id=p.party_id AND p.direction='in' LEFT JOIN suppliers s ON s.id=p.party_id AND p.direction='out'
     WHERE p.company_id=? AND p.account_id=? AND p.date<=? AND p.id NOT IN (SELECT matched_payment_id FROM bank_lines WHERE matched_payment_id IS NOT NULL)
     ORDER BY p.date DESC LIMIT 400`, cid, sel.id, session?.end_date ?? today());
  const expenses = all<any>(
    `SELECT e.id, e.date, COALESCE(e.description,'expense') AS description, e.amount + e.tax AS signed_amount, -1 AS is_expense
     FROM expenses e WHERE e.company_id=? AND e.account_id=? AND e.je_id IS NOT NULL ORDER BY e.date DESC LIMIT 300`, cid, sel.id);
  const expenseAccounts = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND type='expense' AND archived=0 ORDER BY code`, cid);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  return (
    <>
      <PageHeader title="Bank reconciliation" desc="Match bank feed lines against recorded payments, or book what’s missing straight from the feed. Close the statement when the difference is zero — and lock the period." />
      <ReconClient banks={banks} sel={sel} lines={lines.map(l => ({ ...l, amount_conv: conv(l.amount) }))} session={session}
        payments={payments} expenses={expenses} expenseAccounts={expenseAccounts}
        bookBalance={conv(sel.book_balance)} base={user.company.base_currency} disp={disp}
        canEdit={can(user.role, "edit", "accounting")} />
    </>
  );
}
