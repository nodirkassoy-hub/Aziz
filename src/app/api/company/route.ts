import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COMPANY_COOKIE, currentUser } from "@/lib/auth";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const u = currentUser();
  if (!u) return NextResponse.redirect(new URL("/login", req.url));
  const form = await req.formData();
  const id = Number(form.get("id"));
  const m = get(`SELECT 1 AS x FROM memberships WHERE company_id=? AND user_id=?`, id, u.id);
  if (!m) return NextResponse.json({ error: "You are not a member of that company." }, { status: 403 });
  cookies().set(COMPANY_COOKIE, String(id), { path: "/", maxAge: 31536000 });
  return NextResponse.redirect(new URL("/app", req.url), 303);
}
