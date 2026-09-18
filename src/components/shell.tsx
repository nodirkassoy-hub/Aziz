"use client";
/** App shell: sidebar (desktop) + drawer (mobile), topbar with selectors, global search + ⌘K. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, FileText, Landmark, Receipt, Users, HandCoins, Truck, Wallet, BookOpen,
  Table2, Calculator, Banknote, ArrowLeftRight, Building2, FolderOpen, Sparkles, Settings,
  Search, Bell, Sun, Moon, Menu, X, ChevronDown, Plus, Command, LogOut, UserRound, ShieldCheck,
  ArrowRight, ScrollText, BellRing,
} from "lucide-react";
import { api } from "@/components/ui";

type NavItem = { href: string; label: string; icon?: any; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "", items: [{ href: "/app", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Sales", items: [
    { href: "/app/sales/invoices", label: "Invoices", icon: FileText },
    { href: "/app/sales/quotes", label: "Quotes", icon: ScrollText },
    { href: "/app/sales/payments", label: "Payments", icon: HandCoins },
    { href: "/app/sales/customers", label: "Customers", icon: Users },
    { href: "/app/sales/receivables", label: "Receivables", icon: Landmark },
  ] },
  { label: "Purchases", items: [
    { href: "/app/purchases/bills", label: "Bills", icon: Receipt },
    { href: "/app/purchases/expenses", label: "Expenses", icon: Wallet },
    { href: "/app/purchases/suppliers", label: "Suppliers", icon: Truck },
    { href: "/app/purchases/payables", label: "Payables", icon: ArrowLeftRight },
  ] },
  { label: "Accounting", items: [
    { href: "/app/accounting/accounts", label: "Chart of Accounts", icon: BookOpen },
    { href: "/app/accounting/journal", label: "Journal Entries", icon: Table2 },
    { href: "/app/accounting/ledger", label: "General Ledger", icon: Calculator },
    { href: "/app/accounting/trial-balance", label: "Trial Balance", icon: Table2 },
    { href: "/app/accounting/reconciliation", label: "Bank Reconciliation", icon: Banknote },
  ] },
  { label: "Finance", items: [
    { href: "/app/finance/cash-flow", label: "Cash Flow", icon: HandCoins },
    { href: "/app/finance/bank", label: "Bank Accounts", icon: Building2 },
    { href: "/app/finance/cash", label: "Cash", icon: Wallet },
    { href: "/app/finance/transfers", label: "Transfers", icon: ArrowLeftRight },
  ] },
  { label: "Reports", items: [
    { href: "/app/reports/pl", label: "Profit & Loss", icon: Table2 },
    { href: "/app/reports/balance-sheet", label: "Balance Sheet", icon: Landmark },
    { href: "/app/reports/cash-flow", label: "Cash Flow Statement", icon: HandCoins },
    { href: "/app/reports/trial-balance", label: "Trial Balance", icon: Calculator },
    { href: "/app/reports/ledger", label: "General Ledger", icon: BookOpen },
    { href: "/app/reports/ar-aging", label: "AR Aging", icon: Receipt },
    { href: "/app/reports/ap-aging", label: "AP Aging", icon: Receipt },
    { href: "/app/reports/tax", label: "Tax Reports", icon: Landmark },
  ] },
  { label: "Documents", items: [
    { href: "/app/documents", label: "Files", icon: FolderOpen },
    { href: "/app/documents?tab=receipts", label: "Receipts", icon: Receipt },
    { href: "/app/documents?tab=contracts", label: "Contracts", icon: ScrollText },
  ] },
  { label: "", items: [
    { href: "/app/ai-cfo", label: "AI CFO", icon: Sparkles },
    { href: "/app/settings", label: "Settings", icon: Settings },
  ] },
];

export function Shell({ user, companies, currencies, periodLabel, children }: {
  user: any; companies: any[]; currencies: string[]; periodLabel: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(p => !p); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href.split("?")[0]));

  const nav = (
    <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-5">
      {NAV.map((g, gi) => (
        <div key={gi}>
          {g.label && <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--faint)" }}>{g.label}</div>}
          <div className="space-y-0.5">
            {g.items.map(it => (
              <Link key={it.href + gi} href={it.href}
                className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all no-underline ${isActive(it.href) ? "text-[var(--accent)]" : "hover:bg-[var(--accent-soft)]"}`}
                style={{ color: isActive(it.href) ? "var(--accent)" : "var(--muted)", background: isActive(it.href) ? "var(--accent-soft)" : undefined, ...(isActive(it.href) ? { color: "var(--accent)" } : {}) }}>
                {it.icon && <it.icon size={16.5} className={isActive(it.href) ? "opacity-100" : "opacity-70 group-hover:opacity-100"} />}
                <span className="truncate" style={{ color: isActive(it.href) ? "var(--accent)" : "inherit" }}>{it.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
  return (
    <div className="min-h-dvh">
      <div className="app-bg" />
      {/* sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col border-r glass-2 z-40" style={{ borderColor: "var(--line)" }}>
        <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
          <Link href="/app" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={17} /></span>
            <span className="text-[19px] font-extrabold tracking-tight">Mizom</span>
          </Link>
          <span className="ml-auto chip text-[9px]">v1.0</span>
        </div>
        <CompanySwitcher user={user} companies={companies} />
        {nav}
        <div className="p-3 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/app/notifications" className="btn-icon relative" title="Notifications"><BellRing size={18} /></Link>
            <Link href="/app/audit" className="btn-icon" title="Audit trail"><ShieldCheck size={18} /></Link>
            <button className="btn-icon ml-auto" title="Sign out" onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80] lg:hidden animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] card-solid flex flex-col animate-fade-up rounded-r-3xl">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={15} /></span>
                <b className="text-lg tracking-tight">Mizom</b>
              </div>
              <button className="btn-icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <CompanySwitcher user={user} companies={companies} />
            {nav}
            <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: "var(--line)" }}>
              <ThemeToggle />
              <Link href="/app/notifications" className="btn-icon"><BellRing size={18} /></Link>
              <Link href="/app/audit" className="btn-icon"><ShieldCheck size={18} /></Link>
              <button className="btn-icon ml-auto" onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}><LogOut size={17} /></button>
            </div>
          </div>
        </div>
      )}
      {/* topbar */}
      <header className="sticky top-0 z-30 lg:pl-[248px] no-print">
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 glass-2 border-b" style={{ borderColor: "var(--line)" }}>
          <button className="btn-icon lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={20} /></button>
          <button onClick={() => setPalette(true)} className="hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 text-sm min-w-[220px] max-w-[340px] flex-1 border" style={{ borderColor: "var(--line-strong)", color: "var(--faint)", background: "var(--input-bg)" }}>
            <Search size={15} /> Search invoices, people, journals…
            <span className="ml-auto chip text-[10px] !py-0">⌘K</span>
          </button>
          <button className="btn-icon sm:hidden ml-auto" onClick={() => setPalette(true)} aria-label="Search"><Search size={19} /></button>
          <div className="flex items-center gap-2 ml-auto">
            <PeriodPicker companies={companies} label={periodLabel} />
            <CurrencyPicker currencies={currencies} current={user.displayCurrency} />
            <NotifBell />
            <button className="btn-icon lg:hidden"><UserRound size={18} /></button>
            <Link href="/app/sales/invoices/new" className="btn-primary btn-sm !hidden sm:!inline-flex ml-1"><Plus size={15} /> New invoice</Link>
          </div>
        </div>
        {user.company?.is_demo === 1 && (
          <div className="text-center text-[11px] font-semibold tracking-wide py-1.5" style={{ background: "linear-gradient(90deg,rgba(26,158,131,.14),rgba(60,109,240,.14))", color: "var(--muted)" }}>
            DEMO DATA — this workspace contains a generated, internally consistent dataset. Every figure on your own company reflects real postings only.
          </div>
        )}
      </header>
      <main className="lg:pl-[248px]">{children}</main>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

function CompanySwitcher({ user, companies }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div className="px-3 pb-2 relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]" style={{ borderColor: "var(--line-strong)", background: "var(--panel)" }}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: user.company.accent_color || "#0f7f6c" }}>{user.company.name.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight">{user.company.name}</span>
          <span className="block text-[10.5px]" style={{ color: "var(--faint)" }}>{user.role.replace(/_/g, " ")} · {user.company.base_currency}</span>
        </span>
        <ChevronDown size={14} className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 left-3 right-3 mt-1 card-solid rounded-2xl p-1.5 shadow-glass-lg animate-scale-in">
          {companies.map((c: any) => (
            <form key={c.id} action="/api/company" method="post" className="contents">
              <input type="hidden" name="id" value={c.id} />
              <button className={`w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] hover:bg-[var(--accent-soft)] ${c.id === user.companyId ? "font-semibold" : ""}`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: c.accent_color || "#0f7f6c" }}>{c.name.slice(0, 2).toUpperCase()}</span>
                <span className="truncate">{c.name}{c.is_demo ? <span className="chip ml-2 !text-[8px]">demo</span> : null}</span>
                <span className="ml-auto text-[10px]" style={{ color: "var(--faint)" }}>{c.base_currency}</span>
              </button>
            </form>
          ))}
          <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--line)" }}>
            <button onClick={() => { location.href = "/onboarding?new=1"; }} className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px]" style={{ color: "var(--accent)" }}>
              <Plus size={14} /> Add another company
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodPicker({ label }: any) {
  const [open, setOpen] = useState(false);
  const opts = [["this_month", "This month"], ["last_month", "Last month"], ["this_quarter", "Quarter"], ["this_year", "This year"], ["last_12", "12 months"], ["all", "All time"]];
  return (
    <div className="relative">
      <button className="btn-outline !py-1.5 text-xs" onClick={() => setOpen(o => !o)}>{label || "This month"} <ChevronDown size={12} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <form action="/api/prefs" method="post" className="absolute right-0 z-50 mt-1 card-solid rounded-2xl p-1.5 shadow-glass-lg w-44 animate-scale-in">
            {opts.map(([v, l]) => (
              <button key={v} className="w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--accent-soft)]" formMethod="post" onClick={(e: any) => { e.preventDefault(); const fd = new FormData(e.currentTarget.form); fd.set("p", v); fetch("/api/prefs", { method: "POST", body: fd }).then(() => location.reload()); }}>
                {l}
              </button>
            ))}
          </form>
        </>
      )}
    </div>
  );
}
function CurrencyPicker({ currencies, current }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative hidden sm:block">
      <button className="btn-outline !py-1.5 text-xs" onClick={() => setOpen(o => !o)}>
        {current ?? currencies[0] ?? "UZS"} <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 card-solid rounded-2xl p-1.5 shadow-glass-lg w-36 animate-scale-in">
            {currencies.map((c: string) => (
              <button key={c} className="w-full rounded-xl px-3 py-2 text-left text-[13px] num hover:bg-[var(--accent-soft)]" onClick={() => { document.cookie = `mizom_cur=${c};path=/;max-age=31536000`; location.reload(); }}>{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function NotifBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const load = () => api("/api/notifications").then((r: any) => { setItems(r.data?.items ?? []); setUnread(r.data?.unread ?? 0); });
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if (open) load(); }, [open]);
  return (
    <div className="relative">
      <button className="btn-icon relative" aria-label="Notifications" onClick={() => setOpen(o => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d64550] px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-[min(92vw,380px)] card-solid rounded-2xl shadow-glass-lg animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
              <b className="text-sm">Notifications</b>
              <Link className="text-xs link" href="/app/notifications" onClick={() => setOpen(false)}>View all</Link>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.slice(0, 8).map((n: any) => (
                <Link key={n.id} href={n.link ?? "/app/notifications"} onClick={() => { fetch("/api/notifications", { method: "POST", body: JSON.stringify({ read: [n.id] }) }); setOpen(false); }}
                  className="flex gap-3 px-4 py-3 no-underline border-b last:border-0 hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--line)", color: "inherit" }}>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.severity === "danger" ? "var(--neg)" : n.severity === "warn" ? "var(--warn)" : n.severity === "success" ? "var(--pos)" : "var(--accent)" }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug">{n.title}</span>
                    {n.body && <span className="block text-xs leading-snug mt-0.5" style={{ color: "var(--muted)" }}>{n.body}</span>}
                    <span className="block text-[10px] mt-1" style={{ color: "var(--faint)" }}>{n.when}</span>
                  </span>
                </Link>
              ))}
              {!items.length && <div className="p-6 text-center text-sm" style={{ color: "var(--faint)" }}>Nothing new right now.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  return <button className="btn-icon" aria-label="Toggle theme" onClick={() => { const n = !dark; setDark(n); document.documentElement.classList.toggle("dark", n); localStorage.setItem("mizom_theme", n ? "dark" : "light"); }}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>;
}

/* ---------- command palette ---------- */
const ACTIONS: { label: string; href: string; group: string; kbd?: string }[] = [
  { label: "Create invoice", href: "/app/sales/invoices/new", group: "Create" },
  { label: "Create expense", href: "/app/purchases/expenses?new=1", group: "Create" },
  { label: "Add customer", href: "/app/sales/customers?new=1", group: "Create" },
  { label: "Add supplier", href: "/app/purchases/suppliers?new=1", group: "Create" },
  { label: "New quote", href: "/app/sales/quotes?new=1", group: "Create" },
  { label: "Upload receipt (OCR)", href: "/app/documents/receipts?upload=1", group: "Create" },
  { label: "Open P&L", href: "/app/reports/pl", group: "Navigate" },
  { label: "Open Balance Sheet", href: "/app/reports/balance-sheet", group: "Navigate" },
  { label: "Open cash flow", href: "/app/finance/cash-flow", group: "Navigate" },
  { label: "Bank reconciliation", href: "/app/accounting/reconciliation", group: "Navigate" },
  { label: "Journal entries", href: "/app/accounting/journal", group: "Navigate" },
  { label: "Settings", href: "/app/settings", group: "Navigate" },
  { label: "Ask AI CFO", href: "/app/ai-cfo", group: "AI" },
  { label: "Analyze profit", href: "/app/ai-cfo?q=Bu oy foydamiz qancha?", group: "AI" },
  { label: "Cash flow forecast", href: "/app/ai-cfo?q=Keyingi 30 kunlik cash flow qanday?", group: "AI" },
];
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => api(`/api/search?q=${encodeURIComponent(q)}`).then(r => setResults(r.data)), 180);
    return () => clearTimeout(t);
  }, [q]);
  const filtered = useMemo(() => {
    const act = ACTIONS.filter(a => a.label.toLowerCase().includes(q.toLowerCase()) || (!q));
    if (!q.trim()) return { actions: act, groups: groupSearch(null) };
    return { actions: act.slice(0, 6), groups: groupSearch(results) };
  }, [q, results]);
  const flat = [...filtered.actions.map(a => ({ kind: "action" as const, ...a })), ...(filtered.groups?.flat ?? [])];
  useEffect(() => { setSel(0); }, [q]);
  function go(item: any) { if (item?.href) { router.push(item.href); onClose(); } }
  return (
    <div className="fixed inset-0 z-[97] flex items-start justify-center p-4 pt-[12vh] animate-fade-in no-print">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-xl card-solid rounded-2xl shadow-glass-lg animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: "var(--line)" }}>
          <Search size={17} style={{ color: "var(--faint)" }} />
          <input ref={inputRef} autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); go(flat[sel]); }
            }}
            placeholder="Search invoices, customers, transactions… or jump to" className="w-full bg-transparent py-3.5 text-[15px] outline-none" style={{ color: "var(--text)" }} />
          <span className="chip text-[10px] hidden sm:flex items-center gap-1"><Command size={10} />K</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 && <div className="p-8 text-center text-sm" style={{ color: "var(--faint)" }}>No matches. Press Enter to search everywhere.</div>}
          {flat.map((item, i) => (
            <button key={i} onMouseEnter={() => setSel(i)} onClick={() => go(item)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] ${i === sel ? "bg-[var(--accent-soft)]" : ""}`}>
              <span className="chip !text-[9px] uppercase w-14 justify-center shrink-0">{item.kind === "action" ? item.group : item.kind}</span>
              <span className="truncate font-medium">{item.label}</span>
              {item.sub && <span className="truncate text-xs ml-1" style={{ color: "var(--faint)" }}>{item.sub}</span>}
              <ArrowRight size={13} className={`ml-auto shrink-0 transition-opacity ${i === sel ? "opacity-60" : "opacity-0"}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function groupSearch(results: any) {
  if (!results) return { flat: [] as any[] };
  const flat: any[] = [];
  for (const g of results.groups ?? []) for (const it of g.items) flat.push({ kind: g.label, label: it.label, sub: it.sub, href: it.href });
  return { flat: flat.slice(0, 10) };
}

/* ---------- shared page header ---------- */
export function PageHeader({ title, desc, actions, tabs }: { title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode; tabs?: { href: string; label: string; active?: boolean }[] }) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{title}</h1>
          {desc && <p className="mt-1 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>{desc}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:mt-1">{actions}</div>}
      </div>
      {tabs && (
        <div className="mt-4 flex gap-1 overflow-x-auto no-scrollbar border-b -mb-px" style={{ borderColor: "var(--line)" }}>
          {tabs.map(t => (
            <Link key={t.href} href={t.href} className={`whitespace-nowrap px-3.5 py-2 text-[13px] font-medium no-underline border-b-2 transition-colors ${t.active ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent hover:opacity-80"}`}
              style={{ color: t.active ? "var(--accent)" : "var(--muted)" }}>{t.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
