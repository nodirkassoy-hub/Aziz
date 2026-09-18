import { requireUser } from "@/lib/ctx";
import { generateInsights } from "@/lib/ai";
import { PageHeader } from "@/components/shell";
import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CfoChat } from "./client";

export const metadata = { title: "AI CFO" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const insights = generateInsights(user.companyId, user.company.base_currency);
  return (
    <>
      <PageHeader title="AI CFO" desc="Answers computed from your ledger — each reply cites its method and links to the underlying report. It never invents: if the data isn’t there, it says so." />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <CfoChat />
        <div>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Current insights</h2>
          {insights.length === 0 ? <p className="glass rounded-2xl p-4 text-[13px]" style={{ color: "var(--muted)" }}>No anomalies found in recent postings — a quiet month. Ask a question on the left to dig deeper.</p>
            : <div className="space-y-3">{insights.map((i: any) => <InsightCard key={i.id} i={i} />)}</div>}
        </div>
      </div>
    </>
  );
}

const SEV: Record<string, { icon: any; color: string }> = {
  info: { icon: Info, color: "var(--accent)" }, warn: { icon: AlertTriangle, color: "var(--warn)" },
  danger: { icon: AlertTriangle, color: "var(--neg)" }, success: { icon: CheckCircle2, color: "var(--pos)" },
};
function InsightCard({ i }: { i: any }) {
  const { icon: Icon, color } = SEV[i.severity] ?? SEV.info;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <span className="rounded-lg p-1.5" style={{ background: "var(--accent-soft)" }}><Icon size={15} style={{ color }} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold leading-snug">{i.title}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{i.reason}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="chip !py-0 text-[10.5px]"><TrendingUp size={10} className="mr-1 inline" />{i.data}</span>
            <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>{i.period}</span>
            {i.action && <Link className="link ml-auto !text-[12px]" href={i.action.href}>{i.action.label} →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
