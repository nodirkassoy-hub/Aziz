import { NextResponse } from "next/server";
import { handler, bad } from "@/lib/api";
import { all, get, insert, run } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/db";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { audit } from "@/lib/auth";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".txt": "text/plain", ".csv": "text/csv",
  ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const POST = handler(async ({ user, req }) => {
  const cid = user.companyId;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kind = String(form.get("kind") ?? "file");
  const entityKind = form.get("entity_kind") ? String(form.get("entity_kind")) : null;
  const entityId = form.get("entity_id") ? Number(form.get("entity_id")) : null;
  if (!file || typeof (file as any).arrayBuffer !== "function") bad("No file received.");
  if (file.size === 0) bad("That file is empty.");
  if (file.size > MAX_SIZE) bad(`File is ${(file.size / 1048576).toFixed(1)} MB — the limit is 10 MB.`);
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED[ext]) bad(`“${ext || "unknown"}” files are not supported. Use PDF, image, or document formats.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const storageName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, storageName), buf);
  const id = insert(`INSERT INTO files (company_id, name, mime, size, storage_name, entity_kind, entity_id, kind, uploaded_by)
    VALUES (?,?,?,?,?,?,?,?,?)`, cid, file.name || storageName, ALLOWED[ext] ?? file.type, file.size, storageName, entityKind, entityId, kind, user.id);
  if (entityKind && kind === "logo") run(`UPDATE companies SET logo_doc_id=? WHERE id=?`, id, cid);
  audit({ companyId: cid, userId: user.id, userName: user.name, action: "uploaded", entityKind: "file", entityId: id, summary: `Uploaded ${file.name} (${(file.size / 1024).toFixed(0)} KB)${entityKind ? ` → ${entityKind} #${entityId}` : ""}` });
  return { id, name: file.name, url: `/api/files/${id}`, mime: ALLOWED[ext] ?? file.type, size: file.size, message: `${file.name} uploaded.` };
}, { perm: "create", area: "purchases" });

export const DELETE = handler(async ({ user, body }) => {
  const f = get<any>(`SELECT * FROM files WHERE id=? AND company_id=?`, body.id, user.companyId) ?? bad("File not found.");
  const p = path.join(UPLOADS_DIR, f.storage_name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  run(`UPDATE companies SET logo_doc_id=NULL WHERE logo_doc_id=?`, f.id);
  run(`DELETE FROM files WHERE id=?`, f.id);
  audit({ companyId: user.companyId, userId: user.id, userName: user.name, action: "deleted", entityKind: "file", entityId: f.id, summary: `Deleted file ${f.name}` });
  return { message: `${f.name} deleted.` };
});

/* individual download/preview (auth-gated streaming) */
