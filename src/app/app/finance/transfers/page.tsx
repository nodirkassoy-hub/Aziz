import { requireUser, convert } from "@/lib/ctx";
import { all } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { Money, EmptyState } from "@/components/kit";
import { fmtDate } from "@/lib/dates";
import { can } from "@/lib/auth";
import { TransferForm } from "./client";

export const metadata = { title: "Transfers" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const cid = user.companyId;
  const accounts = all<any>(`SELECT id, name, currency, is_cash FROM bank_accounts WHERE company_id=? AND archived=0 ORDER BY is_cash, name`, cid);
  const recent = all<any>(`SELECT e.id, e.date, e.description, e.entry_no,
      COALESCE((SELECT SUM(l.debit) FROM journal_lines l WHERE l.entry_id=e.id AND l.memo LIKE '%Transfer in%'),0) AS amount
    FROM journal_entries e WHERE e.company_id=? AND e.source_kind='transfer' AND e.status='posted' ORDER BY e.date DESC, e.id DESC LIMIT 25`, cid);
  const disp = user.displayCurrency || user.company.base_currency;
  const conv = (v: number) => convert(v, user.company.base_currency, disp, cid);
  return (
    <>
      <PageHeader title="Transfers" desc="Move money between your own accounts — posts a balanced journal entry, never touches income or expense." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>{can(user.role, "create", "finance")
          ? <TransferForm accounts={accounts} base={user.company.base_currency} />
          : <EmptyState title="No access" desc="Your role cannot record transfers." />}</div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="mb-3 text-[15px] font-semibold">Recent transfers</h3>
          {recent.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>None yet.</p> : recent.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 border-t py-2 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
              <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{fmtDate(r.date)}</span>
              <span className="truncate">{r.description}</span>
              <span className="num ml-auto font-semibold"><Money v={conv(r.amount)} currency={disp} /></span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
