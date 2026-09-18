import { requireUser, convert } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/kit";
import { can } from "@/lib/auth";
import { BanksClient } from "../bank/client";

export const metadata = { title: "Cash accounts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const cid = user.companyId;
  const cashes = all<any>(`SELECT * FROM bank_accounts WHERE company_id=? AND is_cash=1 ORDER BY archived, name`, cid);
  const withBal = cashes.map((b: any) => ({
    ...b,
    book: convert((get<any>(`SELECT COALESCE(SUM(l.debit - l.credit),0) v FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.account_id=?`, b.account_id)?.v ?? 0), user.company.base_currency, user.displayCurrency || user.company.base_currency, cid),
    unrecon: get<any>(`SELECT COUNT(*) n FROM bank_lines WHERE company_id=? AND account_id=? AND status IN ('unmatched','review')`, cid, b.id)?.n ?? 0,
  }));
  const ledgerAccounts = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND archived=0 ORDER BY code`, cid);
  const disp = user.displayCurrency || user.company.base_currency;
  return (
    <>
      <PageHeader title="Cash" desc="Petty cash drawers and cash points — count discrepancies get reconciled exactly like a bank statement." />
      {cashes.length === 0 ? <EmptyState title="No cash accounts" desc="Create a cash drawer account to track petty cash." /> :
        <BanksClient accounts={withBal} ledgerAccounts={ledgerAccounts} base={user.company.base_currency} disp={disp} canManage={can(user.role, "manage_settings", "settings") || can(user.role, "create", "finance")} isCash />}
    </>
  );
}
