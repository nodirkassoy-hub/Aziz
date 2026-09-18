import { PageHeader } from "@/components/shell";
import { requireUser } from "@/lib/ctx";
import { all } from "@/lib/db";
import { openDocs } from "@/lib/reports";
import { PaymentForm } from "./client";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth";

export const metadata = { title: "Record payment" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  if (!can(user.role, "create", "sales") && !can(user.role, "create", "purchases")) redirect("/app/sales/payments");
  const cid = user.companyId;
  const parties = {
    customers: all<any>(`SELECT id, name FROM customers WHERE company_id=? AND archived=0 ORDER BY name`, cid),
    suppliers: all<any>(`SELECT id, name FROM suppliers WHERE company_id=? AND archived=0 ORDER BY name`, cid),
  };
  const banks = all<any>(
    `SELECT ba.id, ba.name, ba.currency, ba.is_cash,
       ba.opening_balance + COALESCE((SELECT SUM(l.debit - l.credit) FROM journal_lines l
         JOIN accounts a ON a.id=l.account_id JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
         WHERE a.id=ba.account_id), 0) AS balance
     FROM bank_accounts ba WHERE ba.company_id=? AND ba.archived=0 ORDER BY ba.is_cash, ba.name`, cid);
  const map = (d: any) => ({ id: d.id, party_id: d.party_id, number: d.number, date: d.date, due_date: d.due_date, total_base: d.total_base, paid: d.paid, outstanding: d.total_base - d.paid });
  const invoices = openDocs(cid, "invoice").map(map);
  const bills = openDocs(cid, "bill").map(map);
  const openExpenses = all<any>(`SELECT e.id, e.supplier_id AS party_id, e.date, e.description AS number, e.amount + e.tax AS outstanding
    FROM expenses e WHERE e.company_id=? AND e.status='posted' AND e.account_id IS NULL AND e.supplier_id IS NOT NULL ORDER BY e.date`, cid);
  return (
    <>
      <PageHeader title="Record payment" desc="Money in or out — allocate it against open documents; anything left over sits on account and settles against future invoices or bills." />
      <PaymentForm parties={parties} banks={banks} invoices={invoices} bills={bills} openExpenses={openExpenses}
        base={user.company.base_currency} initial={{ dir: searchParams?.dir === "out" ? "out" : "in", party_id: searchParams?.party ? Number(searchParams.party) : undefined }} />
    </>
  );
}
