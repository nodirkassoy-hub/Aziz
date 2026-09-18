import { all } from "./db";

export function partyRows(cid: number, type: "customer" | "supplier", q?: string) {
  const table = type === "customer" ? "customers" : "suppliers";
  const kind = type === "customer" ? "invoice" : "bill";
  const like = q ? `%${q}%` : null;
  return all<any>(
    `SELECT p.*,
       COALESCE((SELECT SUM(total_base) FROM trade_docs d WHERE d.company_id=p.company_id AND d.party_id=p.id AND d.kind='${kind}' AND d.status NOT IN ('draft','cancelled')),0) AS billed,
       COALESCE((SELECT SUM(paid)      FROM trade_docs d WHERE d.company_id=p.company_id AND d.party_id=p.id AND d.kind='${kind}' AND d.status NOT IN ('draft','cancelled')),0) AS collected,
       COALESCE((SELECT COUNT(*)       FROM trade_docs d WHERE d.company_id=p.company_id AND d.party_id=p.id AND d.kind='${kind}' AND d.status IN ('sent','partial','overdue') AND d.total_base > d.paid),0) AS open_docs,
       (SELECT MAX(date) FROM trade_docs d WHERE d.company_id=p.company_id AND d.party_id=p.id) AS last_activity
     FROM ${table} p
     WHERE p.company_id=? ${like ? "AND (p.name LIKE ? OR p.tax_id LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)" : ""}
     ORDER BY p.name`,
    cid, ...(like ? [like, like, like, like] : []));
}
