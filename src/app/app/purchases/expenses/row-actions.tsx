"use client";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";
import { usePost } from "@/components/forms";
import Link from "next/link";

export function ExpRowActions({ ex, canApprove, canDelete }: { ex: any; canApprove: boolean; canDelete: boolean }) {
  const { post, busy } = usePost(); const ui = useUI(); const router = useRouter();
  const pending = ex.status === "pending_approval";
  const unpaid = ex.status === "posted" && !ex.account_id;
  return (
    <div className="flex items-center justify-end gap-1">
      {pending && canApprove && (
        <>
          <button disabled={busy} className="btn-primary btn-sm !px-2.5 text-xs" onClick={async () => {
            const d = await post("/api/expenses", { action: "approve", id: ex.id });
            if (d?.message) ui.toast("success", d.message);
          }}>Approve</button>
          <button disabled={busy} className="btn-outline btn-sm !px-2.5 text-xs" style={{ color: "var(--neg)" }} onClick={async () => {
            const reason = prompt("Rejection reason (optional) — the submitter will be notified.");
            if (reason === null) return;
            const d = await post("/api/expenses", { action: "reject", id: ex.id, reason: reason || null });
            if (d?.message) ui.toast("success", d.message);
          }}>Reject</button>
        </>
      )}
      {unpaid && ex.supplier_id && (
        <Link href={`/app/sales/payments/new?dir=out&party=${ex.supplier_id}`} className="btn-outline btn-sm !px-2.5 text-xs">Pay supplier</Link>
      )}
      {canDelete && (ex.status === "pending_approval" || ex.status === "rejected" || ex.status === "draft") && (
        <button disabled={busy} className="btn-ghost btn-sm !px-2 text-xs" style={{ color: "var(--neg)" }} onClick={async () => {
          if (!confirm(`Delete this expense (${ex.cat_name ?? "uncategorized"})?`)) return;
          const d = await post("/api/expenses", { action: "delete", id: ex.id });
          if (d?.message) { ui.toast("success", d.message); router.refresh(); }
        }}>Delete</button>
      )}
    </div>
  );
}
