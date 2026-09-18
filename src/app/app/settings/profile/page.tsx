import { requireUser } from "@/lib/ctx";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { ProfileForm } from "../forms";
import { all } from "@/lib/db";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  const companies = all<any>(`SELECT c.name, m.role FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=?`, user.id);
  return (
    <>
      <PageHeader title="Profile" desc="Your account across all companies." />
      <SettingsTabs user={user} active="/app/settings/profile" />
      <div className="max-w-lg space-y-4">
        <ProfileForm user={{ name: user.name, email: user.email }} />
        <div className="glass rounded-2xl p-4">
          <div className="mb-2 text-[13px] font-semibold">Memberships</div>
          {companies.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 border-t py-1.5 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
              <span className="font-medium">{c.name}</span><span className="chip !py-0 text-[10.5px]">{c.role.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
