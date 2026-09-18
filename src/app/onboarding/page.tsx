import { currentUserIdOrNull, userCompanies } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OnboardForm } from "./client";
import { Landmark } from "lucide-react";

export const metadata = { title: "Welcome to Mizom" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: any) {
  const uid = currentUserIdOrNull();
  if (!uid) redirect("/login");
  const companies = userCompanies(uid);
  const adding = searchParams?.new === "1";
  if (companies.length > 0 && !adding) redirect("/app");
  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg,#16a68d,#0d7c68)" }}><Landmark size={21} /></span>
            <span className="text-2xl font-extrabold tracking-tight">Mizom</span>
          </Link>
          <h1 className="mt-4 text-xl font-bold">{adding ? "Add another company" : "Set up your first company"}</h1>
          <p className="mt-1.5 max-w-sm text-[13.5px]" style={{ color: "var(--muted)" }}>
            We create a chart of accounts matched to your base currency, assign you as owner, and you land in the dashboard. Nothing is sent anywhere.
          </p>
        </div>
        <div className="card p-6">
          <OnboardForm hasOther={companies.length > 0} />
        </div>
      </div>
    </div>
  );
}
