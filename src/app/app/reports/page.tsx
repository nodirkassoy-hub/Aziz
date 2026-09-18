import { PageHeader } from "@/components/shell";
import { FileSpreadsheet, Landmark, HandCoins, Calculator, BookOpen, Receipt, Wallet, TrendingUp, Percent, Table2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Reports" };

const REPORTS = [
  { href: "/app/reports/pl", icon: TrendingUp, title: "Profit & Loss", desc: "Revenue, costs and margin for any period, with month-over-month comparison." },
  { href: "/app/reports/balance-sheet", icon: Landmark, title: "Balance Sheet", desc: "Assets = Liabilities + Equity, proven straight from posted entries." },
  { href: "/app/reports/cash-flow", icon: HandCoins, title: "Cash Flow Statement", desc: "Opening to closing cash, split into operating / investing / financing." },
  { href: "/app/reports/trial-balance", icon: Calculator, title: "Trial Balance", desc: "The proof that every debit has a credit — printable." },
  { href: "/app/reports/ledger", icon: BookOpen, title: "General Ledger", desc: "Drill any account line by line." },
  { href: "/app/reports/ar-aging", icon: Receipt, title: "AR Aging", desc: "Who owes you what, and for how long." },
  { href: "/app/reports/ap-aging", icon: Wallet, title: "AP Aging", desc: "What you owe, oldest first." },
  { href: "/app/reports/tax", icon: Percent, title: "Tax Report", desc: "Output vs input tax for the period — the net payable figure." },
  { href: "/app/reports/expenses", icon: FileSpreadsheet, title: "Expense Analysis", desc: "Spend by category with share-of-total and monthly trend." },
  { href: "/app/reports/revenue", icon: Table2, title: "Revenue Analysis", desc: "Revenue by customer and by month." },
];

export default function Page() {
  return (
    <>
      <PageHeader title="Reports" desc="Every report reads only posted journal entries — nothing is computed from drafts, so numbers can’t drift between screens." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map(r => (
          <Link key={r.href} href={r.href} className="glass group rounded-2xl p-4 no-underline transition-transform hover:-translate-y-0.5">
            <r.icon size={19} style={{ color: "var(--accent)" }} />
            <div className="mt-2 text-[14.5px] font-semibold group-hover:underline">{r.title}</div>
            <div className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--muted)" }}>{r.desc}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
