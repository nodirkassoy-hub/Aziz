"use client";
import { useRouter } from "next/navigation";

export function ForecastControls({ scenario, horizon }: { scenario: string; horizon: number }) {
  const router = useRouter();
  const set = (s: string, h?: number) => router.push(`/app/finance/cash-flow?scenario=${s}&horizon=${h ?? horizon}`);
  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {(["conservative", "base", "optimistic"] as const).map(s => (
        <button key={s} onClick={() => set(s)} className={`chip ${scenario === s ? "chip-info" : ""}`}
          style={scenario === s ? { borderColor: "var(--accent)", color: "var(--accent)" } : { color: "var(--muted)" }}>{s}</button>
      ))}
      <select className="input !w-28 !py-1 text-xs" value={horizon} onChange={(e) => set(scenario, +e.target.value)}>
        {[14, 30, 60, 90, 180].map(h => <option key={h} value={h}>{h} days</option>)}
      </select>
    </span>
  );
}
