"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { EmptyState } from "@/components/kit";
import { useUI } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import Link from "next/link";

export function DocumentsClient({ rows, canUpload, tab, autoOpen }: any) {
  const ui = useUI(); const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f); fd.append("kind", tab === "receipts" ? "receipt" : tab === "contracts" ? "contract" : "file");
      const r = await fetch("/api/files", { method: "POST", body: fd });
      if (r.ok) ok++; else { const d = await r.json().catch(() => ({})); ui.toast("error", d.error ?? `“${f.name}” failed`); }
    }
    setBusy(false);
    if (ok) ui.toast("success", `${ok} file${ok > 1 ? "s" : ""} uploaded.`);
    if (tab === "receipts" && ok) router.push("/app/purchases/expenses?ocr=1");
    else router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  }
  async function del(id: number, name: string) {
    if (!confirm(`Delete “${name}”?`)) return;
    const r = await fetch("/api/files", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const d = await r.json();
    ui.toast(r.ok ? "success" : "error", d.message ?? d.error);
    router.refresh();
  }
  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (canUpload) upload(e.dataTransfer.files); }}>
      {canUpload && (
        <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-4 py-4" style={{ borderColor: "var(--line)" }}>
          <Upload size={18} style={{ color: "var(--accent)" }} />
          <div className="min-w-0 flex-1 text-[13px]">
            <b>Drop files here</b> <span style={{ color: "var(--muted)" }}>— receipts, contracts, anything (PDF/image/office, ≤10 MB). {tab === "receipts" ? "After upload you’ll be taken to the OCR reviewer." : ""}</span>
          </div>
          <button className="btn-primary btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Uploading…" : "Choose files"}</button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No files yet" desc={canUpload ? "Upload attachments with a document, or drop them right here." : "Files attached to invoices, bills and expenses will be listed here."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((f: any) => {
            const isImg = (f.mime ?? "").startsWith("image/");
            const Icon = isImg ? ImageIcon : f.mime === "application/pdf" ? FileText : Paperclip;
            return (
              <div key={f.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                  {isImg ? <img src={`/api/files/${f.id}`} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> :
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)" }}><Icon size={17} style={{ color: "var(--accent)" }} /></span>}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{f.name}</span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>
                      {f.kind !== "file" ? <span className="chip mr-1.5 !py-0 !text-[9.5px]">{f.kind}</span> : null}
                      {(f.size / 1024).toFixed(0)} KB · {f.entity_label ? `${f.entity_label} · ` : ""}{fmtDateTime(f.created_at)}{f.uploader ? ` · ${f.uploader}` : ""}</span>
                  </span>
                </a>
                {canUpload && <button className="btn-ghost btn-sm !px-1.5 shrink-0" title="Delete" style={{ color: "var(--neg)" }} onClick={() => del(f.id, f.name)}><Trash2 size={14} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
