"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Money } from "@/components/kit";
import { Field, Select, Submit, TextInput, usePost } from "@/components/forms";
import { useUI } from "@/components/ui";
import { BookOpen, ChevronDown, Pencil, Plus } from "lucide-react";
import Link from "next/link";

const SUBTYPES: Record<string, string[]> = {
  asset: ["cash", "bank", "receivable", "ar", "inventory", "prepaid", "fixed", "depreciation"],
  liability: ["payable", "ap", "tax", "accrued", "debt"],
  equity: ["capital", "retained", "drawings"],
  revenue: ["sales", "other_income"],
  expense: ["cogs", "category", "payroll", "bank_fees", "tax_expense"],
};

export function AccountsClient({ rows, base, disp, canEdit, groups }: any) {
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r: any) => !t || `${r.code} ${r.name} ${r.subtype ?? ""}`.toLowerCase().includes(t));
  }, [q, rows]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput className="!w-64" placeholder="Filter by code, name, subtype…" value={q} onChange={(e: any) => setQ(e.target.value)} />
        {canEdit && <button className="btn-primary btn-sm ml-auto inline-flex items-center gap-1.5" onClick={() => setNewOpen(true)}><Plus size={14} /> New account</button>}
      </div>
      <div className="space-y-4">
        {groups.map((g: any) => {
          const accs = filtered.filter((r: any) => r.type === g.type);
          if (!accs.length) return null;
          const total = accs.reduce((s: number, r: any) => s + (r.type === "asset" || r.type === "expense" ? r.balance : -r.balance), 0);
          return (
            <details key={g.type} className="glass overflow-hidden rounded-2xl" open>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                <BookOpen size={15} style={{ color: "var(--accent)" }} />
                <span className="text-[14px] font-semibold">{g.label}</span>
                <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{g.hint}</span>
                <span className="num ml-auto text-[13px] font-bold"><Money v={accs.reduce((s: number, r: any) => s + r.balance_conv, 0) * (g.type === "asset" || g.type === "expense" ? 1 : 1)} currency={disp} /></span>
                <ChevronDown size={14} style={{ color: "var(--muted)" }} />
              </summary>
              <table className="tbl w-full text-left text-[13px]">
                <tbody>
                  {accs.map((a: any) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="num w-20 py-2 pl-4 font-semibold">{a.code}{a.archived ? <span className="chip ml-1 !py-0 text-[10px]">arch</span> : null}</td>
                      <td className="py-2 pr-2"><span className={a.is_system ? "font-medium" : ""}>{a.name}</span>
                        <span className="ml-2 text-[11px]" style={{ color: "var(--muted)" }}>{a.subtype}{a.linked_bank ? " · bank-linked" : ""}{a.used > 0 ? ` · ${a.used} postings` : " · unused"}</span></td>
                      <td className="num w-44 py-2 pr-4 text-right" style={{ color: !a.has_activity ? "var(--muted)" : undefined }}><Money v={a.balance_conv} currency={disp} /></td>
                      <td className="w-40 py-2 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Link className="btn-ghost btn-sm !px-2 text-xs no-underline" href={`/app/accounting/ledger?account=${a.id}`}>Ledger</Link>
                          {canEdit && !a.is_system && a.used === 0 && <button className="btn-ghost btn-sm !px-1.5" title="Edit" onClick={() => setEdit(a)}><Pencil size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
      <AccountModal open={newOpen} onClose={() => setNewOpen(false)} mode="create" base={base} />
      <AccountModal open={!!edit} onClose={() => setEdit(null)} mode="update" account={edit} base={base} />
    </>
  );
}

function AccountModal({ open, onClose, mode, account, base }: any) {
  const ui = useUI(); const router = useRouter();
  const { post, busy, err, FormError } = usePost();
  const [f, setF] = useState({ code: account?.code ?? "", name: account?.name ?? "", type: account?.type ?? "expense", subtype: account?.subtype ?? "", description: account?.description ?? "" });
  const isCreate = mode === "create";
  const subtypes = SUBTYPES[f.type] ?? [];
  async function save() {
    const d = await post("/api/accounts", isCreate
      ? { action: "create", code: f.code, name: f.name, type: f.type, subtype: f.subtype || null, description: f.description || null }
      : { action: "update", id: account.id, name: f.name, subtype: f.subtype || null, description: f.description || null });
    if (d?.message) { ui.toast("success", d.message); onClose(); router.refresh(); }
  }
  async function archive(hard = false) {
    const d = await post("/api/accounts", { action: account.archived ? "archive" : "archive", id: account.id, archived: account.archived ? 0 : 1, hard });
    if (d?.message) { ui.toast("success", d.message); onClose(); router.refresh(); }
  }
  return (
    <Modal open={open} onClose={onClose} title={isCreate ? "New account" : `${account?.code} · ${account?.name}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {isCreate && <Field label="Code" hint="e.g. 6310"><TextInput value={f.code} onChange={(e: any) => setF({ ...f, code: e.target.value })} /></Field>}
        <Field label="Name"><TextInput value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} /></Field>
        {isCreate && <Field label="Type">
          <Select value={f.type} onChange={(e: any) => setF({ ...f, type: e.target.value, subtype: "" })}
            options={[["asset", "Asset"], ["liability", "Liability"], ["equity", "Equity"], ["revenue", "Revenue"], ["expense", "Expense"]].map(([v, l]) => ({ v, label: l }))} />
        </Field>}
        <Field label="Subtype" hint={isCreate ? "drives report classification — e.g. cogs for margin" : undefined}>
          <Select value={f.subtype} onChange={(e: any) => setF({ ...f, subtype: e.target.value })} options={[{ v: "", label: "— none —" }, ...subtypes.map(s => ({ v: s, label: s }))]} />
        </Field>
        <Field label="Description" className="sm:col-span-2"><TextInput value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      {!isCreate && account?.used > 0 && <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>{account.used} postings use this account — editing the name is fine; the account can be archived but never deleted.</p>}
      <div className="mt-4 flex items-center gap-2">
        <Submit busy={busy} onClick={save}>{isCreate ? "Create account" : "Save"}</Submit>
        {!isCreate && !account?.is_system && (
          <button className="btn-outline btn-sm ml-auto" style={{ color: "var(--neg)" }} onClick={() => account?.used > 0 ? archive() : confirm("Delete this unused account?") && post("/api/accounts", { action: "delete", id: account.id }).then(d => { if (d) { onClose(); router.refresh(); } })}>
            {account?.used > 0 ? (account.archived ? "Restore" : "Archive") : "Delete"}
          </button>)}
      </div>
      <FormError />
    </Modal>
  );
}
