import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const f = get<any>(`SELECT * FROM files WHERE id=? AND company_id=?`, Number(params.id), user.companyId);
  if (!f) return new NextResponse("Not found", { status: 404 });
  const file = path.join(UPLOADS_DIR, path.basename(f.storage_name));
  if (!fs.existsSync(file)) return new NextResponse("Missing on disk", { status: 410 });
  const buf = fs.readFileSync(file);
  const inline = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"].includes(f.mime);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
