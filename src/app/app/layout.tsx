import { requireUser, companiesOf, listCurrencies } from "@/lib/ctx";
import { Shell } from "@/components/shell";
import { resolvePeriod } from "@/lib/dates";

export const dynamic = "force-dynamic";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = requireUser();
  const companies = companiesOf(user);
  const currencies = listCurrencies(user.companyId);
  const periodLabel = resolvePeriod(user.period).label;
  return (
    <Shell user={user} companies={companies} currencies={currencies} periodLabel={periodLabel}>
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-7 py-5 sm:py-7">{children}</div>
    </Shell>
  );
}
