"use client";
import { usePost } from "@/components/forms";
import { useUI } from "@/components/ui";

export function PayRowActions({ id, number }: { id: number; number: string }) {
  const { post, busy } = usePost();
  const ui = useUI();
  return (
    <button className="btn-ghost btn-sm !px-2 text-xs" style={{ color: "var(--neg)", opacity: busy ? 0.5 : 1 }}
      onClick={async () => {
        if (!confirm(`Remove payment ${number}? The ledger entry is reversed and documents are recalculated.`)) return;
        const d = await post("/api/payments", { action: "delete", id });
        if (d?.message) ui.toast("success", d.message);
      }}>Undo</button>
  );
}
