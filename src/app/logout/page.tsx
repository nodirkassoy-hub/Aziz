import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function LogoutPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) run(`DELETE FROM sessions WHERE id=?`, token);
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
