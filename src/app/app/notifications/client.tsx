"use client";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui";

export function MarkRead({ id, all: markAll }: { id?: number; all?: boolean }) {
  const router = useRouter(); const ui = useUI();
  return (
    <button className={markAll ? "btn-outline btn-sm" : "btn-ghost btn-sm !px-2 text-[12px]"} onClick={async () => {
      await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(markAll ? { readAll: true } : { read: [id] }) });
      ui.toast("success", markAll ? "All marked as read." : "Marked as read.");
      router.refresh();
    }}>{markAll ? `Mark all as read` : "mark read"}</button>
  );
}
