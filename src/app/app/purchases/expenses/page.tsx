import { PageHeader } from "@/components/shell";
import { listExpenses } from "@/lib/query";
import { requireUser, convert } from "@/lib/ctx";
import { all } from "@/lib/db";
import { can } from "@/lib/auth";
import { EmptyState, Money, StatusBadge } from "@/components/kit";
import { Pager } from "@/components/pager";
import { fmtDate } from "@/lib/dates";
import { ExpRowActions } from "./row-actions";
import { OcrModal } from "./ocr-modal";
import Link from "next/link";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const sp = { ...(searchParams ?? {}) };
  if (sp.filter === "approvals") sp.status = "pending_approval";
  const d = listExpenses(user.companyId, sp);
  const cats = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND type='expense' AND archived=0 ORDER BY code`, user.companyId);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, user.companyId);
  const canApprove = can(user.role, "approve", "purchases");
  const canDelete = can(user.role, "delete", "purchases");
  const canCreate = can(user.role, "create", "purchases");
  return (
    <>
      <PageHeader title="Expenses" desc="Receipts, bills-you-pay-instantly and recurring costs. Anything above the approval threshold waits for sign-off before it posts."
        actions={<>
          {canCreate && <Link href="/app/purchases/expenses?ocr=1" className="btn-outline btn-sm">Scan receipt (OCR)</Link>}
          {canCreate && <Link href="/app/purchases/expenses/new" className="btn-primary btn-sm">Add expense</Link>}
        </>} />
      {d.pendingCount > 0 && sp.filter !== "approvals" && (
        <Link href="/app/purchases/expenses?filter=approvals" className="mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] no-underline"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          <b>{d.pendingCount}</b> expense{d.pendingCount > 1 ? "s" : ""} waiting for your approval — review now →
        </Link>
      )}
      {d.count === 0 ? (
        <EmptyState title="No expenses yet" desc="Add one manually, or scan a supplier receipt — extraction proposes the values, you confirm."
          action={canCreate ? { href: "/app/purchases/expenses/new", label: "Add your first expense" } : undefined} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl w-full text-left text-[13px]">
            <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Category</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Supplier / paid from</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr></thead>
            <tbody>
              {d.rows.map((e: any) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="num whitespace-nowrap px-4 py-2.5">{fmtDate(e.date)}</td>
                  <td className="max-w-[240px] px-4 py-2.5"><span className="block truncate font-medium">{e.description ?? "—"}</span>
                    {e.status === "rejected" && e.reject_reason && <span className="block truncate text-[11.5px]" style={{ color: "var(--neg)" }}>rejected: {e.reject_reason}</span>}</td>
                  <td className="hidden px-4 py-2.5 text-xs lg:table-cell" style={{ color: "var(--muted)" }}>{e.cat_code ? `${e.cat_code} · ${e.cat_name}` : "—"}</td>
                  <td className="hidden px-4 py-2.5 text-xs md:table-cell" style={{ color: "var(--muted)" }}>
                    {e.supplier_name ?? "—"}{e.account_name ? ` · ${e.account_name}` : e.supplier_name ? " · on credit" : ""}
                  </td>
                  <td className="num whitespace-nowrap px-4 py-2.5 text-right font-semibold"><Money v={conv(e.total)} currency={disp} />
                    {e.tax > 0 && <span className="block text-[10.5px] font-normal" style={{ color: "var(--muted)" }}>incl. {e.tax_pct}% tax</span>}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-3 py-2.5 text-right"><ExpRowActions ex={e} canApprove={canApprove} canDelete={canDelete} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={d.page} pages={d.pages} hrefFor={(p) => `/app/purchases/expenses?${new URLSearchParams({ ...(searchParams ?? {}), page: String(p) })}`} />
        </div>
      )}
      <OcrModal open={searchParams?.ocr === "1" && canCreate}
        banks={all<any>(`SELECT id, name, currency FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, user.companyId)}
        suppliers={all<any>(`SELECT id, name FROM suppliers WHERE company_id=? AND archived=0 ORDER BY name`, user.companyId)}
        categories={cats} />
    </>
  );
}
