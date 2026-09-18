import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/kit";
import { Pager } from "@/components/pager";
import { can } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Audit trail" };
export const dynamic = "force-dynamic";

const KIND_COLOR: Record<string, string> = {
  created: "var(--pos)", paid: "var(--pos)", posted: "var(--pos)", approved: "var(--pos)",
  edited: "var(--warn)", updated: "var(--warn)", locked: "var(--warn)", unmatched: "var(--warn)", rejected: "var(--neg)",
  deleted: "var(--neg)", cancelled: "var(--neg)", uploaded: "var(--accent)", matched: "var(--accent)", signed_in: "var(--muted)", signed_out: "var(--muted)",
};

export default async function Page({ searchParams }: any) {
  const user = requireUser();
  if (!can(user.role, "view", "settings") && user.role !== "auditor") {
    return <PageHeader title="Audit trail" desc="The audit log is visible to owners, accountants and auditors." />;
  }
  const sp = searchParams ?? {};
  const params: any[] = [user.companyId];
  let where = `company_id=?`;
  if (sp.kind) { where += ` AND action=?`; params.push(sp.kind); }
  if (sp.q) { where += ` AND (summary LIKE ? OR user_name LIKE ? OR entity_kind LIKE ?)`; const l = `%${sp.q}%`; params.push(l, l, l); }
  const per = 50; const page = Math.max(1, Number(sp.page ?? 1));
  const count = get<any>(`SELECT COUNT(*) n FROM audit_log WHERE ${where}`, ...params)?.n ?? 0;
  const rows = all<any>(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, per, (page - 1) * per);
  const kinds = all<any>(`SELECT DISTINCT action FROM audit_log WHERE company_id=? ORDER BY action`, user.companyId).map((r: any) => r.action);
  return (
    <>
      <PageHeader title="Audit trail" desc="Append-only log of every mutation: who, when, from which device, and what changed. Nothing here is editable — including by you." />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input className="input !w-56" name="q" placeholder="Search summary, user, entity…" defaultValue={sp.q ?? ""} />
        <select className="input !w-40" name="kind" defaultValue={sp.kind ?? ""}>
          <option value="">All actions</option>
          {kinds.map((k: string) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="btn-outline btn-sm">Filter</button>
      </form>
      {rows.length === 0 ? <EmptyState title="No events" desc={count ? "Filters are too tight." : "The log fills as you work."} /> : (
        <div className="glass rounded-2xl p-2 sm:p-3">
          {rows.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b px-2 py-2.5 last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="chip !py-0 text-[10.5px] font-semibold" style={{ color: KIND_COLOR[r.action] ?? "var(--muted)", borderColor: "transparent", background: "var(--accent-soft)" }}>{r.action}</span>
              <span className="num text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtDateTime(r.created_at)}</span>
              <span className="text-[13px]"><b>{r.user_name ?? "system"}</b> · {r.entity_kind}{r.entity_id ? ` #${r.entity_id}` : ""}</span>
              <span className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--muted)" }}>{r.summary}</span>
              {(r.old_json || r.new_json) && <details className="text-[11px]"><summary className="cursor-pointer" style={{ color: "var(--accent)" }}>diff</summary>
                <pre className="mt-1 max-w-[60vw] overflow-x-auto whitespace-pre-wrap rounded-lg p-2 text-[10.5px]" style={{ background: "var(--accent-soft)" }}>{JSON.stringify({ old: r.old_json ? safeParse(r.old_json) : null, new: r.new_json ? safeParse(r.new_json) : null }, null, 1)}</pre></details>}
              {r.device && <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>{r.device}{r.ip ? ` · ${r.ip}` : ""}</span>}
            </div>
          ))}
        </div>
      )}
      <Pager page={page} pages={Math.ceil(count / per)} hrefFor={(p) => `/app/audit?${new URLSearchParams({ ...sp, page: String(p) })}`} />
    </>
  );
}
function safeParse(s: string) { try { return JSON.parse(s); } catch { return s; } }
