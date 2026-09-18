import { PageHeader } from "@/components/shell";
import { requireUser, convert } from "@/lib/ctx";
import { partyRows } from "@/lib/parties-ui";
import { can } from "@/lib/auth";
import { listCurrencies } from "@/lib/ctx";
import { EmptyState, Money } from "@/components/kit";
import { fmtDate } from "@/lib/dates";
import { CustomersClient } from "./client";
import Link from "next/link";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const rows = partyRows(user.companyId, "customer", searchParams?.q);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const canCreate = can(user.role, "create", "sales");
  for (const r of rows) { r.open_conv = conv(Math.max(0, r.billed - r.collected)); r.billed_conv = conv(r.billed); }
  const totalOpen = conv(rows.reduce((s: number, r: any) => s + Math.max(0, r.billed - r.collected), 0));
  return (
    <>
      <PageHeader title="Customers" desc="Balances are computed live from the ledger — open a customer to see their documents, payments and statement." />
      <CustomersClient rows={rows} base={user.company.base_currency} disp={disp} canCreate={canCreate}
        totalOpen={conv(totalOpen)} showNew={searchParams?.new === "1"} currencies={listCurrencies(user.companyId)} />
    </>
  );
}
