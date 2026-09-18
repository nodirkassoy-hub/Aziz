import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { resolvePeriod, today } from "@/lib/dates";
import { trialBalance, profitAndLoss, balanceSheet, cashFlowStatement, openDocs, partyStatement, taxSummary, expenseByCategory, revenueByCustomer, generalLedger, overdueDocs } from "@/lib/reports";
import { get, all } from "@/lib/db";

export const dynamic = "force-dynamic";
function csvCell(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(name: string, columns: string[], rows: any[][]): NextResponse {
  const body = [name, "", ...[]].slice(0, 0).concat([columns.map(csvCell).join(","), ...rows.map(r => r.map(csvCell).join(","))].join("\n"));
  return new NextResponse("\uFEFF" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` },
  });
}
const money = (v: number) => (v / 100).toFixed(2);

export async function GET(req: Request) {
  const user = currentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const cid = user.companyId;
  const kind = sp.get("kind") ?? "tb";
  const from = sp.get("from") || resolvePeriod(user.period).from;
  const to = sp.get("to") || resolvePeriod(user.period).to;
  const cur = user.company.base_currency;

  if (kind === "tb") {
    const tb = trialBalance(cid, { from, to });
    return toCsv(`trial-balance-${to}`, ["Account code", "Account", "Type", "Debit", "Credit", "Balance"],
      [...tb.rows.map(r => [r.code, r.name, r.type, money(r.display_debit), money(r.display_credit), money(r.balance)]),
       [], ["TOTAL", "", "", money(tb.totalDebit), money(tb.totalCredit), `Balanced: ${tb.balanced ? "YES" : "NO"}`]] as any);
  }
  if (kind === "pl") {
    const pl = profitAndLoss(cid, from, to);
    const rows: any[][] = [];
    rows.push(["Revenue"]); for (const r of pl.revenue) rows.push(["", r.name, money(r.net)]);
    rows.push(["", "Total revenue", money(pl.revenueTotal)]);
    rows.push(["COGS"]); for (const r of pl.cogs) rows.push(["", r.name, money(r.net)]);
    rows.push(["", "Gross profit", money(pl.grossProfit)]);
    rows.push(["Operating expenses"]); for (const r of pl.opex) rows.push(["", r.name, money(r.net)]);
    rows.push(["", "Operating profit", money(pl.operatingProfit)]);
    rows.push(["", "Net profit", money(pl.netProfit)]);
    return toCsv(`profit-loss-${from}-to-${to}`, ["", "Line", cur], rows as any);
  }
  if (kind === "bs") {
    const bs = balanceSheet(cid, to);
    const rows: any[][] = [];
    const sec = (t: string, arr: any[]) => { rows.push([t]); for (const a of arr) rows.push(["", `${a.code} ${a.name}`, money(a.value)]); };
    sec("ASSETS", bs.assets); rows.push(["", "Total assets", money(bs.totalAssets)]);
    sec("LIABILITIES", bs.liabilities); rows.push(["", "Total liabilities", money(bs.totalLiabilities)]);
    sec("EQUITY", bs.equity); rows.push(["", "Current-year earnings", money(bs.currentEarnings)]); rows.push(["", "Total equity", money(bs.totalEquity)]);
    rows.push([]); rows.push(["Balanced (A = L + E)", bs.balanced ? "YES" : "NO"]);
    return toCsv(`balance-sheet-${to}`, ["", "Line", cur], rows as any);
  }
  if (kind === "cf") {
    const cf = cashFlowStatement(cid, from, to);
    return toCsv(`cash-flow-${from}-to-${to}`, ["Section", cur], [["Opening cash", money(cf.opening)], ["Operating", money(cf.operating)], ["Investing", money(cf.investing)], ["Financing", money(cf.financing)], ["Net change", money(cf.netChange)], ["Closing cash", money(cf.closing)]] as any);
  }
  if (kind === "ar" || kind === "ap") {
    const docs = openDocs(cid, kind === "ar" ? "invoice" : "bill");
    return toCsv(`${kind}-aging-${today()}`, ["Document", "Party", "Date", "Due", "Total", "Paid", "Outstanding"],
      docs.map(d => [d.number, d.party_name, d.date, d.due_date, money(d.total_base), money(d.paid), money(d.total_base - d.paid)]) as any);
  }
  if (kind === "tax") {
    const ts = taxSummary(cid, from, to);
    return toCsv(`tax-report-${from}-to-${to}`, ["", cur], [["Collected (output tax)", money(ts.collected)], ["Paid (input tax)", money(ts.paid)], ["Net payable", money(ts.net)]] as any);
  }
  if (kind === "expenses") {
    const cats = expenseByCategory(cid, from, to);
    return toCsv(`expense-report-${from}-to-${to}`, ["Account", "Name", cur], cats.map((c: any) => [c.code, c.name, money(c.total)]) as any);
  }
  if (kind === "revenue") {
    const rows = revenueByCustomer(cid, from, to);
    return toCsv(`revenue-${from}-to-${to}`, ["Customer", "Invoiced", "Documents"], rows.map((r: any) => [r.name, money(r.total), r.docs]) as any);
  }
  if (kind === "gl") {
    const acc = sp.get("account");
    const rows = generalLedger(cid, { accountId: acc ? Number(acc) : null, from, to, limit: 5000 });
    return toCsv(`general-ledger-${from}-to-${to}`, ["Date", "Entry", "Account", "Description", "Memo", "Debit", "Credit"],
      rows.map((r: any) => [r.date, r.entry_no, `${r.code} ${r.account}`, r.description, r.memo ?? "", r.debit ? money(r.debit) : "", r.credit ? money(r.credit) : ""]) as any);
  }
  if (kind === "statement") {
    const id = Number(sp.get("party") ?? 0);
    const type = sp.get("party_type") === "supplier" ? "supplier" : "customer";
    const st = partyStatement(cid, type as any, id, "2000-01-01", to);
    const name = get<any>(`SELECT name FROM ${type === "customer" ? "customers" : "suppliers"} WHERE id=?`, id)?.name ?? "statement";
    return toCsv(`statement-${name}-${to}`, ["Date", "Document", "Amount", "Running balance"],
      st.rows.map((r: any) => [r.date, r.number ?? "", money(r.signed), money(r.balance)]) as any);
  }
  if (kind === "overdue") {
    const rows = overdueDocs(cid, "invoice");
    return toCsv(`overdue-invoices`, ["Invoice", "Customer", "Due", "Days overdue", "Outstanding"],
      rows.map((r: any) => [r.number, r.party_name, r.due_date, r.days_overdue, money(r.total_base - r.paid)]) as any);
  }
  return new NextResponse("Unknown report", { status: 400 });
}
