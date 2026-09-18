"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";
import { Field, FormCard, Submit, TextInput, usePost } from "@/components/forms";
import { parseMoney, minorToInput } from "@/lib/money";
import { today } from "@/lib/dates";
import { Plus, X } from "lucide-react";

type L = { account_id: string; debit: string; credit: string; memo: string };
const emptyLine = (): L => ({ account_id: "", debit: "", credit: "", memo: "" });

export function ManualJeForm({ accounts, base, editId }: any) {
  const router = useRouter(); const ui = useUI();
  const { post, busy, err, FormError } = usePost();
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [ref, setRef] = useState("");
  const [lines, setLines] = useState<L[]>([emptyLine(), emptyLine()]);

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + parseMoney(l.debit || "0"), 0);
    const c = lines.reduce((s, l) => s + parseMoney(l.credit || "0"), 0);
    return { d, c, diff: d - c };
  }, [lines]);
  const balanced = totals.diff === 0 && totals.d > 0;

  async function save(status: "draft" | "posted") {
    const payload = {
      action: editId ? "update" : "create", id: editId, date, description: desc, ref: ref || null, status,
      lines: lines.filter(l => l.account_id).map(l => ({ account_id: +l.account_id, debit: parseMoney(l.debit || "0"), credit: parseMoney(l.credit || "0"), memo: l.memo || null })),
    };
    const d = await post("/api/journal", payload);
    if (d?.id) { ui.toast("success", d.message); router.push("/app/accounting/journal"); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <FormCard title="Entry">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><TextInput value={desc} onChange={(e: any) => setDesc(e.target.value)} placeholder="Accrual — December utilities" /></Field>
          <Field label="Reference" className="sm:col-span-3"><TextInput value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="optional — contract no, memo id…" /></Field>
        </div>
        <div className="mt-4 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-5">
                <select className="input" value={l.account_id} onChange={(e) => setLines(ls => ls.map((x, j) => j === i ? { ...x, account_id: e.target.value } : x))}>
                  <option value="">Account…</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <input className="input col-span-2 text-right num" placeholder="Debit" inputMode="decimal" value={l.debit}
                onChange={(e) => setLines(ls => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: "" } : x))} />
              <input className="input col-span-2 text-right num" placeholder="Credit" inputMode="decimal" value={l.credit}
                onChange={(e) => setLines(ls => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: "" } : x))} />
              <input className="input col-span-2 text-xs" placeholder="memo" value={l.memo} onChange={(e) => setLines(ls => ls.map((x, j) => j === i ? { ...x, memo: e.target.value } : x))} />
              <button className="col-span-1 btn-ghost btn-sm !px-1.5" onClick={() => setLines(ls => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)}><X size={13} /></button>
            </div>
          ))}
          <button className="btn-ghost btn-sm inline-flex items-center gap-1" onClick={() => setLines(ls => [...ls, emptyLine()])}><Plus size={13} /> add line</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t pt-3 text-[13px]" style={{ borderColor: "var(--line)" }}>
          <span className="num" style={{ color: "var(--muted)" }}>debits <b className="text-[var(--text)]">{minorToInput(totals.d)}</b> · credits <b className="text-[var(--text)]">{minorToInput(totals.c)}</b></span>
          <span className={`chip ${balanced ? "chip-good" : "chip-warn"}`}>{balanced ? "balanced ✓" : totals.d === 0 ? "enter amounts" : `off by ${minorToInput(Math.abs(totals.diff))} ${base}`}</span>
        </div>
      </FormCard>
      <div className="flex items-center gap-3">
        <Submit busy={busy} onClick={() => save("posted")} className={balanced ? "" : "opacity-60"}>Post entry</Submit>
        <button className="btn-outline" disabled={busy} onClick={() => save("draft")}>Save draft</button>
        <button className="btn-ghost" onClick={() => router.push("/app/accounting/journal")}>Cancel</button>
        <div className="min-w-0 flex-1"><FormError /></div>
      </div>
    </div>
  );
}
