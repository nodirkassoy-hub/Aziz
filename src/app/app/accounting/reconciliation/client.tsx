"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Link2, Plus, Scissors, SplitSquareHorizontal, X } from "lucide-react";
import { Modal, Money, StatusBadge } from "@/components/kit";
import { Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";
import { fmtDate, today } from "@/lib/dates";
import { parseMoney, minorToInput } from "@/lib/money";

const minor = (major: string | number) => Math.round((typeof major === "number" ? major : parseFloat(major || "0")) * 100);

export function ReconClient({ banks, sel, lines, session, payments, expenses, expenseAccounts, bookBalance, base, disp, canEdit }: any) {
  const router = useRouter(); const ui = useUI();
  const { post, busy, err, FormError } = usePost();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [match, setMatch] = useState<any>(null);
  const [create, setCreate] = useState<any>(null);
  const [split, setSplit] = useState<any>(null);
  const [startOpen, setStartOpen] = useState(!session);
  const [closeOpen, setCloseOpen] = useState(false);
  const q = "";

  const visible = useMemo(() => lines.filter((l: any) =>
    filter === "all" ? true : filter === "open" ? (l.status === "unmatched" || l.status === "review") : l.status !== "unmatched" && l.status !== "review"), [lines, filter]);
  const clearedMinor = lines.filter((l: any) => ["matched", "created", "ignored"].includes(l.status)).reduce((s: number, l: any) => s + l.amount, 0);
  const openCount = lines.filter((l: any) => l.status === "unmatched" || l.status === "review").length;

  async function act(body: any, okMsg = "Done.") {
    const d = await post("/api/recon", body);
    if (d) ui.toast("success", d.message ?? okMsg);
    return d;
  }

  return (
    <div>
      {/* account tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {banks.map((b: any) => (
          <button key={b.id} onClick={() => router.push(`/app/accounting/reconciliation?account=${b.id}`)}
            className="rounded-xl px-3.5 py-2 text-[13px] no-underline inline-flex items-center gap-2"
            style={{ background: b.id === sel.id ? "var(--accent-soft)" : "transparent", color: b.id === sel.id ? "var(--accent)" : "var(--muted)", border: `1px solid ${b.id === sel.id ? "var(--accent)" : "var(--line)"}` }}>
            {b.is_cash ? <Banknote size={14} /> : <Banknote size={14} />}{b.name}
          </button>
        ))}
      </div>
      {/* summary strip */}
      <div className="glass mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-4 py-3 text-[12.5px]">
        <span style={{ color: "var(--muted)" }}>book balance <b className="num text-[14px]" style={{ color: "var(--text)" }}><Money v={bookBalance} currency={disp} /></b></span>
        {session ? <>
          <span style={{ color: "var(--muted)" }}>statement <span className="num">{fmtDate(session.start_date)} → {fmtDate(session.end_date)}</span></span>
          <span style={{ color: "var(--muted)" }}>cleared <b className="num"><Money v={clearedMinor} currency={base} /></b></span>
          <span style={{ color: "var(--muted)" }}>difference <b className="num" style={{ color: Math.abs(session.ending_balance - bookBalance) <= 1 ? "var(--pos)" : "var(--warn)" }}>{minorToInput(Math.abs(session.ending_balance - bookBalance))} {base}</b></span>
        </> : <span style={{ color: "var(--muted)" }}>no open session — start one to close &amp; lock a statement period.</span>}
        {canEdit && (<>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button className="btn-outline btn-sm" disabled={busy} onClick={() => act({ action: "auto_match", account_id: sel.id })}>⚡ Auto-match</button>
            {!session ? <button className="btn-primary btn-sm" onClick={() => setStartOpen(true)}>Start session</button>
              : <button className="btn-primary btn-sm" onClick={() => setCloseOpen(true)}>Close session</button>}
          </div>
        </>)}
      </div>
      <div className="mb-3 flex items-center gap-1 text-[12.5px]">
        {([["open", `To review (${openCount})`], ["done", "Cleared"], ["all", "All"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className="chip" style={filter === v ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent)" } : undefined}>{l}</button>
        ))}
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="tbl w-full text-left text-[12.5px]">
          <thead><tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Status</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Cleared against</th><th className="px-4 py-2.5" /></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>Nothing here — the bank feed is empty for this account. Lines appear when you import statements (Settings → Integrations) or add transactions on the bank page.</td></tr>}
            {visible.map((l: any) => {
              const open = l.status === "unmatched" || l.status === "review";
              return (
                <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="num whitespace-nowrap px-4 py-2">{fmtDate(l.date)}</td>
                  <td className="max-w-[260px] px-4 py-2"><span className="block truncate">{l.description || "—"}</span>{l.category && <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{l.category}</span>}</td>
                  <td className="num whitespace-nowrap px-4 py-2 text-right font-semibold" style={{ color: l.amount > 0 ? "var(--pos)" : undefined }}><Money v={l.amount_conv} currency={disp} signed /></td>
                  <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                  <td className="hidden max-w-[200px] px-4 py-2 text-[11.5px] md:table-cell" style={{ color: "var(--muted)" }}>
                    <span className="block truncate">{l.matched_payment_no ?? l.matched_expense_desc ?? (l.status === "created" ? `booked as ${l.created_doc_kind}` : l.status === "ignored" ? "ignored" : "—")}</span></td>
                  <td className="px-3 py-2">
                    {open && canEdit ? (
                      <div className="flex justify-end gap-1">
                        <button className="btn-primary btn-sm !px-2" title="Match to a recorded payment" onClick={() => setMatch(l)}><Link2 size={13} /></button>
                        <button className="btn-outline btn-sm !px-2" title={l.amount > 0 ? "Book as receipt" : "Book as expense"} onClick={() => setCreate(l)}><Plus size={13} /></button>
                        <button className="btn-ghost btn-sm !px-2" title="Split into lines" onClick={() => setSplit(l)}><Scissors size={13} /></button>
                        <button className="btn-ghost btn-sm !px-2" title="Ignore this line" onClick={() => act({ action: "ignore", line_id: l.id, reason: "Ignored" })}><X size={13} /></button>
                      </div>
                    ) : l.status === "matched" && canEdit ? (
                      <div className="flex justify-end"><button className="btn-ghost btn-sm !px-2 text-xs" onClick={() => act({ action: "unmatch", line_id: l.id })}>Unmatch</button></div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* MATCH modal */}
      <Modal open={!!match} onClose={() => setMatch(null)} title={`Match bank line — ${match ? (match.amount / 100).toLocaleString("en-US") + " " + base : ""}`} wide>
        {match && <MatchList line={match} payments={payments} expenses={expenses} base={base} onPick={async (kind: string, id: number) => {
          const d = await act({ action: "match", line_id: match.id, [kind === "payment" ? "payment_id" : "expense_id"]: id });
          if (d) { setMatch(null); }
        }} onClose={() => setMatch(null)} />}
      </Modal>
      {/* CREATE modal */}
      <Modal open={!!create} onClose={() => setCreate(null)} title="Book this bank line">
        {create && <CreateForm line={create} expenseAccounts={expenseAccounts} onPost={async (body: any) => {
          const d = await act({ action: "create_transaction", line_id: create.id, ...body });
          if (d) setCreate(null);
        }} busy={busy} />}
      </Modal>
      {/* SPLIT modal */}
      <Modal open={!!split} onClose={() => setSplit(null)} title="Split line">
        {split && <SplitForm line={split} busy={busy} onSplit={async (parts: number[]) => {
          const d = await act({ action: "split", line_id: split.id, splits: parts });
          if (d) setSplit(null);
        }} onCancel={() => setSplit(null)} />}
      </Modal>
      {/* START session */}
      <Modal open={startOpen} onClose={() => setStartOpen(false)} title={`Reconcile ${sel.name}`}>
        <StartForm defaultEnd={today()} bookBalance={bookBalance} base={base} busy={busy} opening={bookBalance} onStart={async (v: any) => {
          const d = await act({ action: "start", account_id: sel.id, ...v });
          if (d) { setStartOpen(false); router.refresh(); }
        }} />
      </Modal>
      {/* CLOSE session */}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Close reconciliation">
        {session && <div className="space-y-3">
          <p className="text-[13px]">Statement through <b className="num">{fmtDate(session.end_date)}</b>. {openCount > 0 && <span style={{ color: "var(--warn)" }}>{openCount} line{openCount > 1 ? "s" : ""} still need review — closing now requires “force”, and they stay open for the next session.</span>}{openCount === 0 && <span style={{ color: "var(--pos)" }}>Everything is cleared ✓</span>}</p>
          <div className="flex flex-col gap-2 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" id="force" className="accent-[var(--accent)]" /> force-close with open lines</label>
            <label className="flex items-center gap-2"><input type="checkbox" id="lock" className="accent-[var(--accent)]" defaultChecked={openCount === 0} /> also lock period {session.end_date.slice(0, 7)} (no more postings before the statement date)</label>
          </div>
          <Submit busy={busy} onClick={async () => {
            const force = (document.getElementById("force") as HTMLInputElement)?.checked;
            const lock = (document.getElementById("lock") as HTMLInputElement)?.checked;
            const d = await act({ action: "close", id: session.id, force, lock });
            if (d) { setCloseOpen(false); router.refresh(); }
          }}>Close {openCount > 0 ? "(force)" : ""}</Submit>
          <FormError />
        </div>}
      </Modal>
      {err && <div className="mt-3 rounded-xl px-3.5 py-2 text-[13px]" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>{err}</div>}
    </div>
  );
}

function MatchList({ line, payments, expenses, base, onPick, onClose }: any) {
  const [q, setQ] = useState("");
  const t = q.toLowerCase();
  const cands = [
    ...payments.filter((p: any) => !t || `${p.number} ${p.party ?? ""}`.toLowerCase().includes(t)).map((p: any) => ({ ...p, kind: "payment", label: `${p.number} · ${p.party ?? "on account"}` })),
    ...expenses.filter((e: any) => !t || `${e.description}`.toLowerCase().includes(t)).map((e: any) => ({ ...e, kind: "expense", label: `Expense · ${e.description}` })),
  ];
  const delta = (v: number) => Math.abs(v - line.amount);
  cands.sort((a: any, b: any) => delta(a.kind === "payment" ? a.signed_amount : -Math.abs(a.signed_amount)) - delta(b.kind === "payment" ? b.signed_amount : -Math.abs(b.signed_amount)));
  return (
    <div>
      <p className="mb-2 text-[12.5px]" style={{ color: "var(--muted)" }}>Best candidates first — exact amount &amp; near date match the bank line ({(line.amount / 100).toLocaleString("en-US")} {base} on {fmtDate(line.date)}).</p>
      <TextInput placeholder="Filter number, party, description…" value={q} onChange={(e: any) => setQ(e.target.value)} className="mb-2" />
      <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
        {cands.length === 0 && <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Nothing recorded matches — book the line as a new transaction instead.</p>}
        {cands.slice(0, 60).map((c: any) => {
          const amt = c.kind === "payment" ? c.signed_amount : -Math.abs(c.signed_amount);
          const diff = Math.abs(amt - line.amount);
          return (
            <button key={`${c.kind}${c.id}`} onClick={() => onPick(c.kind, c.id)} className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--accent-soft)]"
              style={{ borderColor: diff <= 1 ? "var(--pos)" : "var(--line)" }}>
              <span className="chip !py-0 text-[10.5px]">{c.kind}</span>
              <span className="num text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtDate(c.date)}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="num font-semibold"><Money v={amt} currency={base} signed /></span>
              {diff <= 1 ? <span className="chip chip-good !py-0 text-[10.5px]"><Check size={10} /> exact</span> : <span className="num text-[11px]" style={{ color: "var(--warn)" }}>Δ {(diff / 100).toLocaleString("en-US")}</span>}
            </button>
          );
        })}
      </div>
      <button className="btn-outline btn-sm mt-3" onClick={onClose}>Cancel</button>
    </div>
  );
}

function CreateForm({ line, expenseAccounts, onPost, busy }: any) {
  const isReceipt = line.amount > 0;
  const [f, setF] = useState({ account: "", tax: "", category: "6900" });
  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Posts a journal entry for {(Math.abs(line.amount) / 100).toLocaleString("en-US")} {isReceipt ? "in" : "out"} dated {fmtDate(line.date)} and marks the line “created”. You can still delete the expense from the Expenses screen.</p>
      {isReceipt ? (
        <Field label="Credited to" hint="Typically reduces what a customer owes (AR credit). Pick a liability for loans/advances.">
          <Select value={f.account} onChange={(e: any) => setF({ ...f, account: e.target.value })} options={[{ v: "", label: "— Accounts Receivable (on-account) —" }, ...expenseAccounts.map((a: any) => ({ v: a.id, label: `other: ${a.code} · ${a.name}` }))]} />
        </Field>
      ) : (
        <>
          <Field label="Expense category">
            <Select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })} options={expenseAccounts.map((a: any) => ({ v: a.code, label: `${a.code} · ${a.name}` }))} />
          </Field>
          <Field label="Input tax on this line" hint="optional — posts to the VAT account"><TextInput inputMode="decimal" value={f.tax} onChange={(e: any) => setF({ ...f, tax: e.target.value })} placeholder="0.00" /></Field>
        </>
      )}
      <Submit busy={busy} onClick={() => onPost(isReceipt ? { kind: "receipt", account_id: f.account || null } : { kind: "expense", category_code: f.category, tax_amount: minor(f.tax || "0") })}>
        Book {isReceipt ? "receipt" : "expense"}
      </Submit>
    </div>
  );
}

function SplitForm({ line, busy, onSplit, onCancel }: any) {
  const [parts, setParts] = useState<string[]>([String(Math.abs(line.amount / 2 / 100)), String(Math.abs(line.amount / 2 / 100))]);
  const sum = parts.reduce((s: number, p: string) => s + minor(p || "0"), 0);
  const target = Math.abs(line.amount);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>One bank charge covering several things? Split it into separate review lines — the parts must add up to {(target / 100).toLocaleString("en-US")} {target < 100000 ? "" : ""}exactly.</p>
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput inputMode="decimal" value={p} onChange={(e: any) => setParts(ps => ps.map((x, j) => j === i ? e.target.value : x))} />
          <button className="btn-ghost btn-sm !px-1.5" onClick={() => setParts(ps => ps.length > 1 ? ps.filter((_, j) => j !== i) : ps)}><X size={13} /></button>
        </div>
      ))}
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: Math.abs(sum - target) <= 1 ? "var(--pos)" : "var(--warn)" }}>
        <button className="btn-outline btn-sm inline-flex items-center gap-1" onClick={() => setParts(ps => [...ps, ""])}><SplitSquareHorizontal size={13} /> add part</button>
        <span className="num">{sum === target ? "totals ✓" : `off by ${(Math.abs(target - sum) / 100).toLocaleString("en-US")}`}</span>
      </div>
      <Submit busy={busy} onClick={() => Math.abs(sum - target) <= 1 && onSplit(parts.map(p => minor(p || "0")).filter(v => v > 0))}>Split line</Submit>
      <button className="btn-ghost btn-sm ml-2" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function StartForm({ defaultEnd, bookBalance, base, busy, opening, onStart }: any) {
  const [f, setF] = useState({ end_date: defaultEnd, ending: "" });
  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Enter the ending balance printed on the bank statement. Mizom compares it with what the ledger says after clearing lines — the difference must reach zero before you close (unless forced).</p>
      <Field label="Statement end date"><TextInput type="date" value={f.end_date} max={today()} onChange={(e: any) => setF({ ...f, end_date: e.target.value })} /></Field>
      <Field label="Ending balance per statement" hint={`ledger currently holds ${minorToInput(bookBalance)} ${base}`}><TextInput inputMode="decimal" value={f.ending} onChange={(e: any) => setF({ ...f, ending: e.target.value })} placeholder="0.00" /></Field>
      <Submit busy={busy} onClick={() => onStart({ opening_balance: opening, ending_balance: minor(f.ending || "0"), start_date: "2020-01-01", end_date: f.end_date })}>Start session</Submit>
    </div>
  );
}
