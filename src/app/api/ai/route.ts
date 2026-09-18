import { handler, bad } from "@/lib/api";
import { askCfo, generateInsights } from "@/lib/ai";

export const POST = handler(async ({ user, body }) => {
  if (body.action === "insights") return { insights: generateInsights(user.companyId, user.company.base_currency) };
  const q = String(body.question ?? "").trim();
  if (!q) bad("Type a question.");
  const answer = askCfo(user.companyId, q, user.company.base_currency);
  return { answer };
});
