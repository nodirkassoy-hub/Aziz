import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE, audit } from "@/lib/auth";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST() {
  const u = currentUser();
  if (u) audit({ companyId: u.companyId, userId: u.id, userName: u.name, action: "logout", entityKind: "session", summary: "Signed out" });
  destroySession();
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
