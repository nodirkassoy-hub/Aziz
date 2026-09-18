import { requireUser } from "@/lib/ctx";
import { all, get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { Calculator, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const c = user.company;
  const stats = {
    users: get<any>(`SELECT COUNT(*) n FROM memberships WHERE company_id=?`, c.id)?.n ?? 0,
    accounts: get<any>(`SELECT COUNT(*) n FROM accounts WHERE company_id=? AND archived=0`, c.id)?.n ?? 0,
    docs: get<any>(`SELECT COUNT(*) n FROM trade_docs WHERE company_id=?`, c.id)?.n ?? 0,
    journals: get<any>(`SELECT COUNT(*) n FROM journal_entries WHERE company_id=? AND status='posted'`, c.id)?.n ?? 0,
  };
  return (
    <>
      <PageHeader title="Settings" desc={c.is_demo ? "You’re in a demo workspace — settings are yours to play with; nothing real is connected." : "Company-wide configuration. Tax behaviour is fully configurable per jurisdiction — Mizom never claims automatic compliance."} />
      <SettingsTabs user={user} active="/app/settings" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Invoice design", "Layout, accent colour, logos, default notes — plus a live document preview.", "/app/settings/invoice-designer", Calculator],
          ["Taxes", "Rates, withholding, jurisdiction notes. Reports follow your configuration.", "/app/settings/taxes", Calculator],
          ["Currency & FX", "Base currency and manual daily rates used for multi-currency postings.", "/app/settings/currency", Calculator],
          ["Accounting policy", "Numbering sequences, fiscal year, period locks and closing.", "/app/settings/accounting", ShieldCheck],
          ["Team", "Invite people, set roles, what each role can do.", "/app/settings/users", Users],
          ["Notifications", "Which alerts you get and where they surface.", "/app/settings/notifications", ShieldCheck],
          ["Integrations", "Bank feeds and email connectors — honestly listed, nothing auto-syncs silently.", "/app/settings/integrations", ShieldCheck],
          ["Security", "Sessions and two-factor authentication.", "/app/settings/security", ShieldCheck],
          ["Profile", "Your name, email and password.", "/app/settings/profile", Users],
        ].map(([title, desc, href, Icon]: any) => (
          <Link key={href} href={href} className="glass group rounded-2xl p-4 no-underline transition-transform hover:-translate-y-0.5">
            <Icon size={17} style={{ color: "var(--accent)" }} />
            <div className="mt-2 text-[14px] font-semibold group-hover:underline">{title}</div>
            <div className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--muted)" }}>{desc}</div>
          </Link>
        ))}
      </div>
      <div className="glass mt-4 grid grid-cols-2 gap-3 rounded-2xl p-4 text-[13px] sm:grid-cols-4">
        {[["Members", stats.users], ["Active accounts", stats.accounts], ["Documents", stats.docs], ["Posted entries", stats.journals]].map(([l, v]: any) => (
          <div key={l}><div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{l}</div><div className="num text-[18px] font-bold">{v.toLocaleString("en-US")}</div></div>
        ))}
      </div>
      {c.is_demo === 1 && (
        <p className="mt-4 text-[12px]" style={{ color: "var(--muted)" }}>Demo data note: this company is flagged DEMO. Deleting seeded documents will make reports shrink accordingly — that’s expected, not a bug.</p>
      )}
    </>
  );
}
