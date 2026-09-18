import Link from "next/link";
import { can } from "@/lib/auth";
import { SessionUser } from "@/lib/auth";

export const SETTINGS_TABS: { href: string; label: string; priv?: boolean }[] = [
  { href: "/app/settings", label: "Overview" },
  { href: "/app/settings/company", label: "Company", priv: true },
  { href: "/app/settings/invoice-designer", label: "Invoice design" },
  { href: "/app/settings/taxes", label: "Taxes", priv: true },
  { href: "/app/settings/currency", label: "Currency & FX", priv: true },
  { href: "/app/settings/accounting", label: "Accounting policy", priv: true },
  { href: "/app/settings/users", label: "Team", priv: true },
  { href: "/app/settings/notifications", label: "Notifications" },
  { href: "/app/settings/integrations", label: "Integrations" },
  { href: "/app/settings/security", label: "Security" },
  { href: "/app/settings/profile", label: "Profile" },
];

export function SettingsTabs({ user, active }: { user: SessionUser; active: string }) {
  const admin = can(user.role, "manage_settings");
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b no-scrollbar -mb-px print:hidden" style={{ borderColor: "var(--line)" }}>
      {SETTINGS_TABS.filter(t => !t.priv || admin).map(t => (
        <Link key={t.href} href={t.href}
          className={`whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium no-underline transition-colors ${active === t.href ? "border-[var(--accent)]" : "border-transparent hover:opacity-80"}`}
          style={{ color: active === t.href ? "var(--accent)" : "var(--muted)" }}>{t.label}</Link>
      ))}
    </div>
  );
}
