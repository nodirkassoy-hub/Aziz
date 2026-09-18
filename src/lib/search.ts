import { all } from "./db";
export function globalSearch(companyId: number, q: string) {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const groups: { label: string; items: { label: string; sub?: string; href: string }[] }[] = [];
  const push = (label: string, items: any[]) => { if (items.length) groups.push({ label, items }); };
  push("Invoices", all(`SELECT number AS label, (SELECT name FROM customers c WHERE c.id=d.party_id) AS sub, '/app/sales/invoices/'||d.id AS href FROM trade_docs d WHERE company_id=? AND kind='invoice' AND (number LIKE ? OR notes LIKE ?) LIMIT 6`, companyId, like, like));
  push("Quotes", all(`SELECT number AS label, '/app/sales/quotes' AS href FROM trade_docs WHERE company_id=? AND kind='quote' AND number LIKE ? LIMIT 4`, companyId, like));
  push("Bills", all(`SELECT number AS label, '/app/purchases/bills' AS href FROM trade_docs WHERE company_id=? AND kind='bill' AND number LIKE ? LIMIT 4`, companyId, like));
  push("Customers", all(`SELECT name AS label, COALESCE(phone, email) AS sub, '/app/sales/customers/'||id AS href FROM customers WHERE company_id=? AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR tax_id LIKE ?) LIMIT 6`, companyId, like, like, like, like));
  push("Suppliers", all(`SELECT name AS label, COALESCE(phone, email) AS sub, '/app/purchases/suppliers/'||id AS href FROM suppliers WHERE company_id=? AND (name LIKE ? OR tax_id LIKE ?) LIMIT 6`, companyId, like, like));
  push("Journal entries", all(`SELECT entry_no AS label, description AS sub, '/app/accounting/journal?ref='||entry_no AS href FROM journal_entries WHERE company_id=? AND (description LIKE ? OR ref LIKE ? OR entry_no LIKE ?) AND date >= date('now','-400 days') LIMIT 6`, companyId, like, like, like));
  push("Expenses", all(`SELECT ('Exp · '||COALESCE(description,'—')) AS label, date AS sub, '/app/purchases/expenses?q='||COALESCE(description,'') AS href FROM expenses WHERE company_id=? AND description LIKE ? LIMIT 5`, companyId, like));
  push("Payments", all(`SELECT COALESCE(number,'Payment') AS label, reference AS sub, '/app/sales/payments' AS href FROM payments WHERE company_id=? AND (reference LIKE ? OR number LIKE ?) LIMIT 5`, companyId, like, like));
  push("Accounts", all(`SELECT (code||' · ')||name AS label, type AS sub, '/app/accounting/ledger?account='||id AS href FROM accounts WHERE company_id=? AND (name LIKE ? OR code LIKE ?) LIMIT 5`, companyId, like, like));
  push("Documents", all(`SELECT name AS label, kind AS sub, '/app/documents' AS href FROM files WHERE company_id=? AND name LIKE ? LIMIT 5`, companyId, like));
  return groups;
}
