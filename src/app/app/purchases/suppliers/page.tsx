import { PageHeader } from "@/components/shell";
import { requireUser, convert, listCurrencies } from "@/lib/ctx";
import { partyRows } from "@/lib/parties-ui";
import { can } from "@/lib/auth";
import { SuppliersClient } from "./client";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const rows = partyRows(user.companyId, "supplier", searchParams?.q);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  for (const r of rows) { r.open_conv = conv(Math.max(0, r.billed - r.collected)); r.billed_conv = conv(r.billed); }
  const totalOpen = conv(rows.reduce((s: number, r: any) => s + Math.max(0, r.billed - r.collected), 0));
  return (
    <>
      <PageHeader title="Suppliers" desc="What you owe each supplier is read live from bills and payments — open one for their statement." />
      <SuppliersClient rows={rows} disp={disp} canCreate={can(user.role, "create", "purchases")} totalOpen={totalOpen}
        showNew={searchParams?.new === "1"} currencies={listCurrencies(user.companyId)} />
    </>
  );
}
