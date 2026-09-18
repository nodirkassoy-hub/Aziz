/** Date helpers — ISO strings (YYYY-MM-DD) everywhere, deterministic, no TZ surprises. */
export type PeriodKey = { from: string; to: string; label: string; prevFrom: string; prevTo: string };

export function today(): string { return new Date().toISOString().slice(0, 10); }
export function iso(d: Date): string { return d.toISOString().slice(0, 10); }
export function addDays(s: string, n: number): string {
  const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d);
}
export function addMonths(s: string, n: number): string {
  const d = new Date(s + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim)); return iso(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}
export function monthStart(s: string): string { return s.slice(0, 7) + "-01"; }
export function monthEnd(s: string): string {
  const d = new Date(s.slice(0, 4) + "-" + s.slice(5, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return iso(d);
}
export function monthLabel(s: string): string {
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[Number(s.slice(5, 7)) - 1]} ${s.slice(2, 4)}`;
}
export function monthsRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from.slice(0, 7) + "-01";
  while (cur <= to) { out.push(cur); cur = addMonths(cur, 1); }
  return out;
}
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = s.slice(0, 10);
  const months = ["yan", "feb", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  return `${Number(d.slice(8, 10))} ${months[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = s.length === 10 ? s + " 00:00" : s.replace("T", " ").slice(0, 16);
  return `${Number(d.slice(8, 10))} ${m[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}, ${d.slice(11, 16)}`;
}

/** Resolve a period selector into from/to (+ previous period for comparison). */
export function resolvePeriod(key: string | null | undefined): PeriodKey {
  const t = today();
  const y = t.slice(0, 4);
  switch (key) {
    case "this_month": return { from: monthStart(t), to: t, label: "This month", prevFrom: monthStart(addMonths(t, -1)), prevTo: addDays(monthStart(t), -1) };
    case "last_month": { const m = addMonths(t, -1); return { from: monthStart(m), to: monthEnd(m), label: "Last month", prevFrom: monthStart(addMonths(m, -1)), prevTo: monthEnd(addMonths(m, -1)) }; }
    case "this_quarter": {
      const q = Math.floor(Number(t.slice(5, 7)) / 3); // 0..3
      const from = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
      const to = t;
      return { from, to, label: "This quarter", prevFrom: addMonths(from, -3), prevTo: addDays(from, -1) };
    }
    case "this_year": {
      const from = `${y}-01-01`;
      return { from, to: t, label: "This year", prevFrom: `${Number(y) - 1}-01-01`, prevTo: `${Number(y) - 1}-12-31` };
    }
    case "last_12": return { from: addMonths(t, -11).slice(0, 7) + "-01", to: t, label: "Last 12 months", prevFrom: addMonths(t, -23).slice(0, 7) + "-01", prevTo: addDays(addMonths(t, -11).slice(0, 7) + "-01", -1) };
    case "all": return { from: "2000-01-01", to: "2099-12-31", label: "All time", prevFrom: "2000-01-01", prevTo: "2000-01-01" };
    default: return { from: monthStart(t), to: t, label: "This month", prevFrom: monthStart(addMonths(t, -1)), prevTo: addDays(monthStart(t), -1) };
  }
}

export const PERIOD_OPTIONS = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_year", label: "This year" },
  { key: "last_12", label: "Last 12 months" },
  { key: "all", label: "All time" },
];
