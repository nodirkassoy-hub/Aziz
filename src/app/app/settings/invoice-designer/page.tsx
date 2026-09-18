import { requireUser } from "@/lib/ctx";
import { PageHeader } from "@/components/shell";
import { SettingsTabs } from "@/components/settings-nav";
import { DesignerForm } from "../forms";

export const metadata = { title: "Invoice designer" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = requireUser();
  return (
    <>
      <PageHeader title="Invoice Designer" desc="Layout, colour and numbering prefixes. Print any document afterwards to see the result." />
      <SettingsTabs user={user} active="/app/settings/invoice-designer" />
      <DesignerForm c={{ ...user.company }} />
    </>
  );
}
