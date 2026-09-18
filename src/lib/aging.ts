import { openDocs } from "./reports";
import { daysBetween, today } from "./dates";

export function agingBuckets(cid: number, kind: "invoice" | "bill", overdueOnly = false) {
  const rows = openDocs(cid, kind, { overdueOnly });
  const t = today();
  const buckets = [
    { label: "Current", lo: -99999, hi: 0, total: 0, count: 0 },
    { label: "1–15 days", lo: 1, hi: 15, total: 0, count: 0 },
    { label: "16–30 days", lo: 16, hi: 30, total: 0, count: 0 },
    { label: "31–60 days", lo: 31, hi: 60, total: 0, count: 0 },
    { label: "61–90 days", lo: 61, hi: 90, total: 0, count: 0 },
    { label: "90+ days", lo: 91, hi: 99999, total: 0, count: 0 },
  ].map(b => ({ ...b }));
  for (const d of rows) {
    const late = d.due_date ? -daysBetween(d.due_date, t) : 0; // positive = days overdue
    const b = buckets.find(x => late >= x.lo && late <= x.hi) ?? buckets[0];
    b.total += d.total_base - d.paid; b.count++;
  }
  const total = rows.reduce((s, d) => s + (d.total_base - d.paid), 0);
  const overdue = rows.filter((d: any) => d.due_date && d.due_date < t).reduce((s, d) => s + (d.total_base - d.paid), 0);
  const dueSoon = rows.filter((d: any) => d.due_date && d.due_date >= t && daysBetween(t, d.due_date) <= 7).reduce((s, d) => s + (d.total_base - d.paid), 0);
  return { rows, buckets, total, overdue, dueSoon };
}
