import { PageHeader } from "@/components/shell";
import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpenseForm } from "./client";

export const metadata = { title: "New expense" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  if (!can(user.role, "create", "purchases")) redirect("/app/purchases/expenses");
  const cid = user.companyId;
  const data = {
    base: user.company.base_currency,
    banks: all<any>(`SELECT id, name, currency, is_cash FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, cid),
    suppliers: all<any>(`SELECT id, name FROM suppliers WHERE company_id=? AND archived=0 ORDER BY name`, cid),
    accounts: all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND type='expense' AND archived=0 ORDER BY code`, cid),
    taxRates: all<any>(`SELECT id, name, rate_pct FROM tax_rates WHERE company_id=? AND archived=0 AND applies IN ('purchases','both')`, cid),
  };
  return (
    <>
      <PageHeader title="New expense" desc="Expenses over the approval threshold go to your finance approver first — everything else posts straight to the ledger." />
      <ExpenseForm data={data} />
    </>
  );
}
