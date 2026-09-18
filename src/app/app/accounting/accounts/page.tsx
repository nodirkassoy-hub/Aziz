import { requireUser, convert } from "@/lib/ctx";
import { all } from "@/lib/db";
import { trialBalance } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Money } from "@/components/kit";
import { can } from "@/lib/auth";
import { AccountsClient } from "./client";

export const metadata = { title: "Chart of Accounts" };
export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { label: string; hint: string }> = {
  asset: { label: "Assets", hint: "What the business owns — cash, receivables, inventory" },
  liability: { label: "Liabilities", hint: "What the business owes — payables, taxes, loans" },
  equity: { label: "Equity", hint: "Owner’s stake and retained earnings" },
  revenue: { label: "Revenue", hint: "Sales and other income" },
  expense: { label: "Expenses", hint: "Costs — COGS is an expense subtype so margins compute correctly" },
};

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const cid = user.companyId;
  const showArchived = searchParams?.archived === "1";
  const tb = trialBalance(cid);
  const balBy: Record<number, any> = {};
  for (const r of tb.rows) balBy[r.account_id] = r;
  const accounts = all<any>(
    `SELECT a.*,
       (SELECT COUNT(*) FROM journal_lines l WHERE l.account_id=a.id) AS used,
       (SELECT COUNT(*) FROM bank_accounts ba WHERE ba.account_id=a.id) AS linked_bank
     FROM accounts a WHERE a.company_id=? ${showArchived ? "" : "AND a.archived=0"} ORDER BY a.code`, cid);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const rows = accounts.map(a => ({ ...a, balance_conv: conv(balBy[a.id]?.balance ?? 0), has_activity: (balBy[a.id]?.debit ?? 0) !== 0 || (balBy[a.id]?.credit ?? 0) !== 0 }));
  return (
    <>
      <PageHeader title="Chart of Accounts" desc="Mizom ships with a working CoA — add sub-accounts, rename freely. System accounts are locked because reports and document posting point at them."
        actions={<>
          <a className="btn-outline btn-sm no-underline" href={`/app/accounting/accounts?archived=${showArchived ? "0" : "1"}`}>{showArchived ? "Hide archived" : "Show archived"}</a>
          <a className="btn-outline btn-sm no-underline" href="/app/accounting/trial-balance">Trial balance</a>
        </>} />
      {!tb.balanced && (
        <div className="mb-4 rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>
          ⚠ Debits ≠ Credits this period — {Math.abs(conv(tb.totalDebit - tb.totalCredit)).toLocaleString("en-US")} {disp} off. Open a recent entry from the Journal and unpost it to inspect.
        </div>
      )}
      <AccountsClient rows={rows} base={user.company.base_currency} disp={disp} canEdit={can(user.role, "post", "accounting")}
        groups={Object.entries(TYPE_META).map(([k, v]) => ({ type: k, ...v }))} />
    </>
  );
}
