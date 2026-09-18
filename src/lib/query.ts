/** List queries shared by pages. */
import { all, get } from "./db";
import { today } from "./dates";

export function listDocs(cid: number, kind: string, sp: Record<string, string | undefined>) {
  const params: any[] = [cid, kind];
  let where = `d.company_id=? AND d.kind=?`;
  if (sp.status) { where += ` AND d.status=?`; params.push(sp.status); }
  if (sp.from) { where += ` AND d.date>=?`; params.push(sp.from); }
  if (sp.to) { where += ` AND d.date<=?`; params.push(sp.to); }
  if (sp.q) {
    where += ` AND (d.number LIKE ? OR COALESCE(cu.name, su.name) LIKE ? OR d.notes LIKE ?)`;
    const like = `%${sp.q}%`; params.push(like, like, like);
  }
  const page = Math.max(1, Number(sp.page ?? 1));
  const per = 25;
  const rows = all<any>(
    `SELECT d.*, COALESCE(cu.name, su.name) AS party_name
     FROM trade_docs d
     LEFT JOIN customers cu ON cu.id=d.party_id AND d.kind IN ('invoice','quote','sales_order')
     LEFT JOIN suppliers su ON su.id=d.party_id AND d.kind IN ('bill','purchase_order')
     WHERE ${where}
     ORDER BY CASE d.status WHEN 'overdue' THEN 0 WHEN 'draft' THEN 3 ELSE 1 END, d.date DESC, d.id DESC
     LIMIT ? OFFSET ?`, ...params, per, (page - 1) * per);
  const count = get<any>(
    `SELECT COUNT(*) n FROM trade_docs d LEFT JOIN customers cu ON cu.id=d.party_id LEFT JOIN suppliers su ON su.id=d.party_id WHERE ${where}`,
    ...params)?.n ?? 0;
  const sums = get<any>(
    `SELECT COALESCE(SUM(total_base),0) AS issued, COALESCE(SUM(MAX(0, total_base-paid)),0) AS outstanding,
       COALESCE(SUM(CASE WHEN due_date<? AND status IN ('sent','partial','overdue') THEN total_base-paid ELSE 0 END),0) AS overdue
     FROM trade_docs d LEFT JOIN customers cu ON cu.id=d.party_id LEFT JOIN suppliers su ON su.id=d.party_id WHERE ${where}`,
    today(), ...params) ?? { issued: 0, outstanding: 0, overdue: 0 };
  return { rows, count, pages: Math.ceil(count / per), page, totals: sums };
}

export function listPayments(cid: number, sp: Record<string, string | undefined>, direction?: "in" | "out") {
  const params: any[] = [cid];
  let where = `p.company_id=?`;
  if (direction) { where += ` AND p.direction=?`; params.push(direction); }
  if (sp.q) { where += ` AND (p.reference LIKE ? OR p.number LIKE ? OR COALESCE(c.name, s.name) LIKE ?)`; const like = `%${sp.q}%`; params.push(like, like, like); }
  if (sp.from) { where += ` AND p.date>=?`; params.push(sp.from); }
  if (sp.to) { where += ` AND p.date<=?`; params.push(sp.to); }
  if (sp.method) { where += ` AND p.method=?`; params.push(sp.method); }
  const page = Math.max(1, Number(sp.page ?? 1)); const per = 25;
  const rows = all<any>(
    `SELECT p.*, COALESCE(c.name, s.name) AS party_name FROM payments p
     LEFT JOIN customers c ON c.id=p.party_id AND p.direction='in'
     LEFT JOIN suppliers s ON s.id=p.party_id AND p.direction='out'
     WHERE ${where} ORDER BY p.date DESC, p.id DESC LIMIT ? OFFSET ?`, ...params, per, (page - 1) * per);
  const count = get<any>(`SELECT COUNT(*) n FROM payments p LEFT JOIN customers c ON c.id=p.party_id LEFT JOIN suppliers s ON s.id=p.party_id WHERE ${where}`, ...params)?.n ?? 0;
  return { rows, count, pages: Math.ceil(count / per), page };
}

export function listExpenses(cid: number, sp: Record<string, string | undefined>) {
  const params: any[] = [cid];
  let where = `e.company_id=?`;
  if (sp.status) { where += ` AND e.status=?`; params.push(sp.status); }
  if (sp.category) { where += ` AND a.code=?`; params.push(sp.category); }
  if (sp.q) { where += ` AND (e.description LIKE ? OR sup.name LIKE ?)`; const like = `%${sp.q}%`; params.push(like, like); }
  if (sp.from) { where += ` AND e.date>=?`; params.push(sp.from); }
  if (sp.to) { where += ` AND e.date<=?`; params.push(sp.to); }
  const page = Math.max(1, Number(sp.page ?? 1)); const per = 25;
  const rows = all<any>(
    `SELECT e.*, sup.name AS supplier_name, a.code AS cat_code, a.name AS cat_name, ba.name AS account_name,
       (e.amount + e.tax) AS total
     FROM expenses e
     LEFT JOIN suppliers sup ON sup.id=e.supplier_id
     LEFT JOIN accounts a ON a.id=e.category_account_id
     LEFT JOIN bank_accounts ba ON ba.id=e.account_id
     WHERE ${where} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`, ...params, per, (page - 1) * per);
  const count = get<any>(`SELECT COUNT(*) n FROM expenses e LEFT JOIN suppliers sup ON sup.id=e.supplier_id LEFT JOIN accounts a ON a.id=e.category_account_id WHERE ${where}`, ...params)?.n ?? 0;
  const sum = get<any>(`SELECT COALESCE(SUM(e.amount+e.tax),0) v FROM expenses e LEFT JOIN accounts a ON a.id=e.category_account_id WHERE ${where} AND e.status IN ('posted','pending_approval','approved')`, ...params)?.v ?? 0;
  const pending = get<any>(`SELECT COUNT(*) n FROM expenses e WHERE e.company_id=? AND e.status='pending_approval'`, cid)?.n ?? 0;
  return { rows, count, pages: Math.ceil(count / per), page, totalPosted: sum, pendingCount: pending };
}
