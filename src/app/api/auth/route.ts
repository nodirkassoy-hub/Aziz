import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { all, get, insert } from "@/lib/db";
import { createSession, hashPassword, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // eslint-disable-next-line
  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "login";
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  if (mode === "register") {
    if (get(`SELECT id FROM users WHERE lower(email)=?`, email))
      return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
    const name = String(body.name ?? "").trim() || email.split("@")[0];
    const uid = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, email, name, hashPassword(password));
    const token = createSession(uid, { device: req.headers.get("user-agent") ?? undefined, ip: req.headers.get("x-forwarded-for") ?? undefined });
    cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return NextResponse.json({ ok: true, next: "/onboarding" });
  }

  const u = get<any>(`SELECT * FROM users WHERE lower(email)=?`, email);
  if (!u || !verifyPassword(password, u.password_hash))
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  if (u.twofa_enabled) {
    const code = String(body.code ?? "");
    if (!code) return NextResponse.json({ need_2fa: true }, { status: 200 });
    const { verifyLoginTotp } = await import("./twofa");
    if (!verifyLoginTotp(u.twofa_secret, code)) return NextResponse.json({ error: "Invalid authenticator code." }, { status: 401 });
  }
  const token = createSession(u.id, { device: req.headers.get("user-agent") ?? undefined, ip: req.headers.get("x-forwarded-for") ?? undefined });
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const hasCompany = !!get(`SELECT 1 AS x FROM memberships WHERE user_id=? LIMIT 1`, u.id);
  return NextResponse.json({ ok: true, next: hasCompany ? "/app" : "/onboarding" });
}
