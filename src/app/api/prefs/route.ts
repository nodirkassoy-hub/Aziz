import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PERIOD_COOKIE, CURRENCY_COOKIE, currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!currentUser()) return NextResponse.redirect(new URL("/login", req.url));
  const form = await req.formData();
  if (form.get("p")) cookies().set(PERIOD_COOKIE, String(form.get("p")), { path: "/", maxAge: 31536000 });
  if (form.get("c")) cookies().set(CURRENCY_COOKIE, String(form.get("c")), { path: "/", maxAge: 31536000 });
  return NextResponse.json({ ok: true });
}
