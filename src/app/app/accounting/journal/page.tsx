import { requireUser, convert } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EmptyState, Money, StatusBadge } from "@/components/kit";
import { Pager } from "@/components/pager";
import { fmtDate } from "@/lib/dates";
import { can } from "@/lib/auth";
import { JournalClient } from "./client";
import Link from "next/link";

export const metadata = { title: "Journal entries" };
export const dynamic = "force-dynamic";

const DOC_LINKS: Record<string, string> = {
  quote: "/app/sales/quotes", sales_order: "/app/sales/orders", invoice: "/app/sales/invoices",
  credit_note: "/app/sales/invoices", bill: "/app/purchases/bills", purchase_order: "/app/purchases/purchase-orders",
};

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  const sp = searchParams ?? {};
  const cid = user.companyId;
  const params: any[] = [cid];
  let where = `e.company_id=?`;
  if (sp.status) { where += ` AND e.status=?`; params.push(sp.status); } else { where += ` AND e.status='posted'`; }
  if (sp.status === "all") { where = `e.company_id=?`; params.length = 1; }
  if (sp.ref) { where += ` AND (e.ref=? OR e.entry_no=? OR e.id=?)`; params.push(sp.ref, sp.ref, +sp.ref || 0); }
  if (sp.q) { where += ` AND (e.description LIKE ? OR e.ref LIKE ? OR e.entry_no LIKE ?)`; const l = `%${sp.q}%`; params.push(l, l, l); }
  if (sp.from) { where += ` AND e.date>=?`; params.push(sp.from); }
  if (sp.to) { where += ` AND e.date<=?`; params.push(sp.to); }
  if (sp.account) { where += ` AND EXISTS (SELECT 1 FROM journal_lines xl WHERE xl.entry_id=e.id AND xl.account_id=?)`; params.push(+sp.account); }
  const page = Math.max(1, Number(sp.page ?? 1)); const per = 30;
  const count = get<any>(`SELECT COUNT(*) n FROM journal_entries e WHERE ${where}`, ...params)?.n ?? 0;
  const rows = all<any>(
    `SELECT e.*, COALESCE(u.name, '') AS created_by_name,
       (SELECT COALESCE(SUM(l.debit),0) FROM journal_lines l WHERE l.entry_id=e.id) AS total_d
     FROM journal_entries e LEFT JOIN users u ON u.id=e.created_by
     WHERE ${where} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`, ...params, per, (page - 1) * per);
  const linesMap: Record<number, any[]> = {};
  if (rows.length) {
    const ids = rows.map(r => r.id);
    for (const l of all<any>(
      `SELECT l.*, a.code, a.name AS account FROM journal_lines l JOIN accounts a ON a.id=l.account_id
       WHERE l.entry_id IN (${ids.map(() => "?").join(",")}) ORDER BY l.debit DESC, l.credit DESC, l.id`, ...ids))
      (linesMap[l.entry_id] ??= []).push(l);
  }
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  const rowsOut = rows.map(r => ({ ...r, total_conv: conv(r.total_d), lines: (linesMap[r.id] ?? []).map(l => ({ ...l, debit_conv: conv(l.debit), credit_conv: conv(l.credit) })) }));
  const filters = (
    <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
      <input className="input !w-44" name="q" placeholder="Search desc / ref / no." defaultValue={sp.q ?? ""} />
      <select className="input !w-32" name="status" defaultValue={sp.status ?? "posted"}>
        <option value="posted">Posted</option><option value="draft">Drafts</option><option value="all">All</option>
      </select>
      <input className="input !w-36" type="date" name="from" defaultValue={sp.from ?? ""} />
      <input className="input !w-36" type="date" name="to" defaultValue={sp.to ?? ""} />
      <button className="btn-outline btn-sm">Filter</button>
      {(sp.q || sp.from || sp.to || sp.account || sp.ref || sp.status) && <Link className="text-xs link" href="/app/accounting/journal">reset</Link>}
      {sp.account && <input type="hidden" name="account" value={sp.account} />}
    </form>);
  return (
    <>
      <PageHeader title="Journal entries" desc="The full audit trail — every posting, where it came from, and what it did. Document JEs are managed from their document."
        actions={can(user.role, "post", "accounting") && <Link href="/app/accounting/journal/new" className="btn-primary btn-sm">Manual entry</Link>} />
      {filters}
      {rowsOut.length === 0 ? <EmptyState title="No entries match" desc="Adjust the filters — or post a manual entry if the period is empty." /> : (
        <JournalClient rows={rowsOut} base={user.company.base_currency} disp={disp} docLinks={DOC_LINKS}
          canPost={can(user.role, "post", "accounting")} />)}
      <Pager page={page} pages={Math.ceil(count / per)} hrefFor={(p) => `/app/accounting/journal?${new URLSearchParams({ ...(sp ?? {}), page: String(p) })}`} />
    </>
  );
}
