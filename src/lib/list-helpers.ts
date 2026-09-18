import { requireUser } from "@/lib/ctx";
import { listDocs } from "@/lib/query";
import { can } from "@/lib/auth";
import { convert } from "@/lib/ctx";

export function docsListData(kind: string, sp: Record<string, string | undefined>) {
  const user = requireUser();
  const { rows, pages, page, totals, count } = listDocs(user.companyId, kind, sp);
  const disp = user.displayCurrency || user.company.base_currency;
  const base = user.company.base_currency;
  const conv = (v: number) => convert(v, base, disp, user.companyId);
  const canCreate = can(user.role, "create", kind === "bill" || kind === "purchase_order" ? "purchases" : "sales");
  const isSales = kind !== "bill" && kind !== "purchase_order";
  return {
    user, rows, pages, page, count, disp, base, canCreate, isSales,
    totals: { issued: conv(totals.issued), outstanding: conv(totals.outstanding), overdue: conv(totals.overdue) },
  };
}
