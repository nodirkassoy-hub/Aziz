import { handler } from "@/lib/api";
import { globalSearch } from "@/lib/search";
export const GET = handler(async ({ user, req }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return { groups: [] };
  return { groups: globalSearch(user.companyId, q.trim()) };
});
