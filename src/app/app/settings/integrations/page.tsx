import { requireUser } from "@/lib/ctx";
import { get } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { Mail, PlugZap } from "lucide-react";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

const SLOTS = [
  ["Bank feeds", "Import statement lines (CSV or API) to reconcile against.", false, "Import CSV bank lines is available from Reconciliation; live API feeds are not wired in this deployment."],
  ["1C / accounting exchange", "Export journal entries or documents for your accountant’s system.", false, "Use the CSV exports on Reports screens — they include GL, TB, statements."],
  ["Email sending", "Send invoices to customers automatically after issuing.", false, "No SMTP provider is configured — documents mark “send email” as a task instead, never pretending to send."],
  ["OCR engine", "Receipt extraction uses a built-in text extractor; connect a provider later for photographed receipts.", true, "Text-based PDFs are parsed locally; image receipts ask you to key amounts in — always with a review step before posting."],
];

export default async function Page() {
  const user = requireUser();
  return (
    <>
      <PageHeader title="Integrations" desc="Mizom is honest about what is connected. No silent auto-sync, no imaginary providers." />
      <SettingsTabs user={user} active="/app/settings/integrations" />
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {SLOTS.map(([title, desc, active, note]: any) => (
          <div key={title} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <PlugZap size={16} style={{ color: active ? "var(--pos)" : "var(--muted)" }} />
              <span className="text-[14px] font-semibold">{title}</span>
              <span className={`chip ml-auto !py-0 text-[10.5px] ${active ? "chip-good" : ""}`}>{active ? "built in" : "not connected"}</span>
            </div>
            <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--muted)" }}>{desc}</p>
            <p className="mt-1.5 text-[11.5px] italic">{note}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--muted)" }}><Mail size={13} /> When a real provider is added, it will request explicit consent per company before moving any data.</p>
    </>
  );
}
