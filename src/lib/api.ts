/** Shared API handler: auth, JSON parse, error normalization. */
import { NextResponse } from "next/server";
import { currentUser, can, type Perm, type Area } from "./auth";
import { LockError } from "./postings";

export type Ctx = { user: NonNullable<ReturnType<typeof currentUser>>; body: any; req: Request };

export function handler(fn: (ctx: Ctx) => Promise<any> | any, opts: { perm?: Perm; area?: Area; anon?: boolean } = {}) {
  return async (req: Request) => {
    let body: any = {};
    try {
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        const ct = req.headers.get("content-type") || "";
        body = ct.includes("application/json") ? await req.json() : Object.fromEntries(await req.formData());
      }
    } catch { body = {}; }
    const user = currentUser();
    if (!user && !opts.anon) return NextResponse.json({ error: "Not signed in — your session may have expired. Sign in again." }, { status: 401 });
    if (user && opts.perm && !can(user.role, opts.perm, opts.area)) {
      return NextResponse.json({ error: `Your role (${user.role}) is not allowed to ${opts.perm} in ${opts.area ?? "this area"}.` }, { status: 403 });
    }
    try {
      const out = await fn({ user: user as any, body, req });
      if (out instanceof NextResponse) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof LockError) return NextResponse.json({ error: e.message }, { status: 423 });
      const msg = String(e?.message || e);
      if (msg.startsWith("UNBALANCED_ENTRY") || msg.startsWith("EMPTY_ENTRY")) return NextResponse.json({ error: msg.replace(/_/g, " — ") }, { status: 422 });
      console.error("[api]", msg);
      return NextResponse.json({ error: msg || "Unable to save. Please try again." }, { status: 500 });
    }
  };
}
export function bad(msg: string): never { throw new Error(msg); }
