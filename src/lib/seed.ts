/**
 * Deterministic demo data. Generated through the same posting engine as live data,
 * so the trial balance reconciles by construction. Seeded PRNG => identical dataset
 * on every fresh install. Amounts are realistic for a ~40-person trading company.
 */
import { get, insert, run, all } from "./db";
import { hashPassword } from "./auth";
import { ensureCoa, computeDocTotals, postInvoiceJE, postBillJE, postPaymentJE, postExpenseJE, postEntry, postOpeningBalance, accountIdByCode, accountBySubtype } from "./postings";
import { addDays, iso, monthStart, today } from "./dates";
import { pushAlertsAsNotifications } from "./reports";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260918);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const ri = (lo: number, hi: number) => Math.floor(lo + rnd() * (hi - lo + 1));
/** round to nice 100s of UZS (in minor units): e.g. niceMinor(25_400_000) -> 2_540_000_000 */
const niceMinor = (uzsMajor: number) => Math.round(uzsMajor / 1000) * 1000 * 100;

const CUSTOMERS = [
  ["Samarqand Build LLC", "310 200 45 55", "accounts@samarqandbuild.uz", "Samarqand, Registon ko'chasi 14"],
  ["Turon Textile", "+998 90 771 22 08", "finance@turontex.uz", "Farg'ona, Nayman 3"],
  ["Almalyk Metals Trading", "+998 71 200 14 40", "ap@amt.uz", "Toshkent, Amir Temur 108"],
  ["Digital Uz", "+998 93 500 77 12", "billing@digitaluz.uz", "Toshkent, Progress 3C"],
  ["Chorsu Supply", "+998 71 245 66 90", null, "Toshkent, Chorsu bozori"],
  ["Silk Road Logistics", "+998 90 122 34 56", "pay@silkroadlog.uz", "Toshkent viloyati, Olmaliq"],
  ["Namangan Agro", "+998 97 700 88 21", null, "Namangan, G'alaba 5"],
  ["Buxoro Ceramics", "+998 65 222 33 44", "info@buxarocer.uz", "Buxoro, Modarlar 12"],
  ["Urgench Trade House", "+998 62 345 11 08", null, "Urganch, Markaziy 1"],
  ["Parkent Engineering", "+998 90 909 00 11", "eng@parkent.uz", "Toshkent, Parkent 22"],
  ["Qarshi Chemicals", "+998 75 111 22 33", null, "Qarshi, Sanoat 7"],
  ["Yashnobh Interiors", "+998 91 555 66 77", "sales@yashnobh.uz", "Toshkent, Buyuk Ipak Yuli 25"],
];
const SUPPLIERS = [
  ["PromPolimer", "materials supplier", "+998 71 233 12 45", "supplies@prompolimer.uz"],
  ["SteelEx", "raw materials", "+998 71 289 04 04", "billing@steelex.uz"],
  ["Office Mart", "office supplies", "+998 90 011 22 33", null],
  ["EnergySoft", "software subscriptions", "+998 71 205 05 05", "pay@energysoft.uz"],
  ["Toshkent Logistics", "freight", "+998 97 777 01 01", null],
  ["Print House", "printing & marketing", "+998 90 123 45 67", "hello@printhouse.uz"],
  ["Volt Electric", "utilities parts", "+998 71 244 78 90", null],
  ["HR Services UZ", "contract staffing", "+998 71 200 90 80", "invoices@hrserv.uz"],
];
const PRODUCTS: [string, number, number][] = [
  ["Polymer panels — grade A (m²)", 45_000, 10_500],
  ["Custom extrusion batch", 3_200_000, 2_100_000],
  ["Insulation kits (set of 12)", 780_000, 520_000],
  ["Installation service — day rate", 1_900_000, 1_200_000],
  ["Design & prototyping", 6_500_000, 4_000_000],
  ["Bulk order — mixed SKUs", 22_000_000, 15_400_000],
  ["Warehouse rental & handling", 4_300_000, 2_800_000],
  ["Emergency repair works", 2_400_000, 1_500_000],
];

export function ensureSeed() {
  const existing = get(`SELECT id FROM companies LIMIT 1`);
  if (existing) return;
  run("BEGIN IMMEDIATE");
  try {
    buildDemo();
    run("COMMIT");
  } catch (e) {
    run("ROLLBACK");
    throw e;
  }
}

function buildDemo() {
  // users
  const owner = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, "demo@mizom.uz", "Dilnoza Yusupova", hashPassword("Demo1234!"));
  const acct = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, "botir@mizom.uz", "Botir Karimov", hashPassword("Demo1234!"));
  const aud = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, "auditor@mizom.uz", "Sardor Aliyev", hashPassword("Demo1234!"));
  const emp = insert(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, "madina@mizom.uz", "Madina Rustamova", hashPassword("Demo1234!"));

  const cid = insert(
    `INSERT INTO companies (name, legal_name, tax_id, address, phone, email, website, base_currency, is_demo, onboarded,
       invoice_notes, invoice_terms, tax_authority, tax_registration, bank_name, bank_account_no, accent_color, payment_terms_days, approval_expense_threshold, lock_date)
     VALUES (?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?,?,14,?,NULL)`,
    "Mizom Trading (demo)", "Mizom Trading LLC", "305 712 418", "Toshkent, Amir Temur 108, 42-ofis", "+998 71 200 70 70", "finance@mizomtrading.uz", "mizomtrading.uz", "UZS",
    "Thank you for your business. Payment due per terms on this invoice.", "Late payments accrue a 0.1% daily administrative charge where contractually agreed.",
    "Toshkent sh. Soliq boshqarmasi", "QQS 401 220 887", "Ipak Yuli Bank", "2020 8040 6012 3456 7890", "#1a9e83", 1_000_000_000);
  for (const [uid, role] of [[owner, "owner"], [acct, "chief_accountant"], [aud, "auditor"], [emp, "employee"]] as const)
    insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid, uid, role);

  const cid2 = insert(
    `INSERT INTO companies (name, legal_name, tax_id, address, phone, email, base_currency, is_demo, onboarded, payment_terms_days, approval_expense_threshold)
     VALUES (?,?,?,?,?,?,'UZS',1,1,21,2000000000)`,
    "Mizom Services (demo)", "Mizom Services LLC", "305 998 112", "Toshkent, Navoiy 28", "+998 71 200 70 71", "hello@mizomservices.uz");
  insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid2, owner, "owner");
  insert(`INSERT INTO memberships (company_id, user_id, role) VALUES (?,?,?)`, cid2, acct, "accountant");

  seedCompany(cid, true, owner);
  seedCompany(cid2, false, owner);

  pushAlertsAsNotifications(cid);
  insert(`INSERT INTO notifications (company_id, user_id, kind, severity, title, body, link) VALUES (?,?,?,?,?,?,?)`,
    cid, owner, "welcome", "success", "Demo workspace ready", "All figures below come from this generated dataset — explore, edit, post entries. The books reconcile to the journal.", "/app");
}

function seedCompany(cid: number, rich: boolean, ownerId: number) {
  ensureCoa(cid);
  const vatId = insert(`INSERT INTO tax_rates (company_id, name, rate_pct, kind, applies, is_default, jurisdiction) VALUES (?,?,?,?,?,1,?)`,
    cid, "VAT 12%", 12, "output_input", "both", "UZ");
  run(`INSERT INTO tax_rates (company_id, name, rate_pct, kind, applies, is_default, jurisdiction) VALUES (?,?,?,?,?,0,?)`, cid, "Withholding 10%", 10, "withholding", "purchases", "UZ");
  run(`UPDATE companies SET default_tax_rate_id=? WHERE id=?`, vatId, cid);

  // FX rates monthly (UZS per USD)
  const t = today();
  const months = rich ? 18 : 6;
  let fx = 12_450;
  for (let i = months; i >= 0; i--) {
    const d = monthStart(addDays(monthStart(t), -i * 30));
    fx = Math.round(fx * (1 + (rnd() - 0.45) * 0.02));
    insert(`INSERT OR IGNORE INTO exchange_rates (company_id, date, from_currency, to_currency, rate, source) VALUES (?,?,?,?,?,'demo')`, cid, d, "USD", "UZS", fx);
  }

  // parties
  const customerIds: number[] = [];
  const custNames = rich ? CUSTOMERS : CUSTOMERS.slice(0, 5);
  for (const [name, phone, email, addr] of custNames) {
    customerIds.push(insert(`INSERT INTO customers (company_id, name, contact_person, phone, email, tax_id, address, credit_limit, currency)
      VALUES (?,?,?,?,?,?,?,?,?)`, cid, name, pick(["A. Rahimov", "N. Tursunova", "J. Qodirov", "M. Ismoilova", "R. Sobirov"]), phone, email, String(ri(300000000, 399999999)), addr,
      niceMinor(ri(40, 300) * 1_000_000), rnd() < 0.15 ? "USD" : "UZS"));
  }
  const supplierIds: number[] = [];
  const supNames = rich ? SUPPLIERS : SUPPLIERS.slice(0, 4);
  for (const [name, desc, phone, email] of supNames) {
    supplierIds.push(insert(`INSERT INTO suppliers (company_id, name, contact_person, phone, email, tax_id, notes, payment_terms_days, currency)
      VALUES (?,?,?,?,?,?,?,?,?)`, cid, name, pick(["I. Yusupov", "D. Safarova", "K. Nurmatov"]), phone, email, String(ri(300000000, 399999999)), desc, ri(7, 30), "UZS"));
  }

  // bank accounts (linked to ledger accounts) + opening balances
  const acc1010 = accountIdByCode(cid, "1010")!, acc1020 = accountIdByCode(cid, "1020")!, acc1000 = accountIdByCode(cid, "1000")!;
  const openDate = addDays(monthStart(addDays(monthStart(t), -(months - 1) * 30)), 0);
  const bankUzs = insert(`INSERT INTO bank_accounts (company_id, name, bank, number, currency, is_cash, opening_balance, opening_date, account_id) VALUES (?,?,?,?,?,0,?,?,?)`,
    cid, "Primary — UZS", "Ipak Yuli Bank", "2020 8040 6012 3456 7890", "UZS", niceMinor(rich ? 68_000_000 : 34_000_000), openDate, acc1010);
  const bankUsd = insert(`INSERT INTO bank_accounts (company_id, name, bank, number, currency, is_cash, opening_balance, opening_date, account_id) VALUES (?,?,?,?,?,0,?,?,?)`,
    cid, "Foreign currency — USD", "Ipak Yuli Bank", "2020 8040 6012 9911 0002", "USD", 25_000_00, openDate, acc1020);
  const cash = insert(`INSERT INTO bank_accounts (company_id, name, bank, number, currency, is_cash, opening_balance, opening_date, account_id) VALUES (?,?,?,?,?,1,?,?,?)`,
    cid, "Office cash drawer", null, null, "UZS", niceMinor(4_500_000), openDate, acc1000);
  postOpeningBalance(cid, acc1010, niceMinor(rich ? 68_000_000 : 34_000_000), openDate, ownerId);
  postOpeningBalance(cid, acc1020, 25_000_00, openDate, ownerId);
  postOpeningBalance(cid, acc1000, niceMinor(4_500_000), openDate, ownerId);

  const rev = accountBySubtype(cid, "sales").id;
  const cogs = accountIdByCode(cid, "5000")!;
  const taxAcc = accountIdByCode(cid, "2100")!;
  const expenseAccounts = all<any>(`SELECT id, code, name FROM accounts WHERE company_id=? AND type='expense' AND subtype='category'`, cid);

  const paymentsMade: { date: string; amount: number; accountId: number; desc: string }[] = [];
  const billsOpen: any[] = [];

  const makeDoc = (kind: "invoice" | "bill" | "quote" | "sales_order" | "purchase_order", opts: {
    party_id: number; date: string; due: string; items: { desc: string; qty: number; price: number; tax_pct: number; account_id?: number }[]; currency?: string; fx?: number; status?: string; notes?: string;
  }) => {
    const items = opts.items.map((it, idx) => {
      const amount = Math.round(it.qty * it.price);
      const tax_amount = Math.round(amount * it.tax_pct / 100);
      return { ...it, amount, tax_amount, sort: idx };
    });
    const tot = computeDocTotals(items.map(i => ({ qty: i.qty, unit_price: i.price, discount_pct: 0, tax_pct: i.tax_pct })));
    const number = nextNo(cid, kind);
    const fxr = opts.fx ?? 1;
    const base = { subtotal: Math.round(tot.subtotal * fxr), tax: Math.round(tot.tax * fxr), total: Math.round(tot.total * fxr) };
    const docId = insert(
      `INSERT INTO trade_docs (company_id, kind, number, status, party_id, party_type, date, due_date, currency, fx_rate, subtotal, discount, tax, total, subtotal_base, discount_base, tax_base, total_base, paid, notes, terms, created_by, customer_id, supplier_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,0,?,?,0,?,?,?,?,?)`,
      cid, kind, number, opts.status ?? "sent", opts.party_id, kind === "invoice" || kind === "quote" || kind === "sales_order" ? "customer" : "supplier",
      opts.date, opts.due, opts.currency ?? "UZS", fxr, tot.subtotal, tot.tax, tot.total,
      base.subtotal, base.tax, base.total, opts.notes ?? null,
      "Net 14", ownerId, kind === "invoice" || kind === "quote" || kind === "sales_order" ? opts.party_id : null, kind === "bill" || kind === "purchase_order" ? opts.party_id : null);
    for (const it of items) {
      insert(`INSERT INTO trade_doc_items (doc_id, description, qty, unit_price, discount_pct, tax_rate_id, tax_pct, amount, tax_amount, account_id, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        docId, it.desc, it.qty, it.price, 0, opts.currency === "UZS" ? vatId : null, it.tax_pct, it.amount, it.tax_amount, it.account_id ?? null, it.sort);
    }
    if (!opts.status || opts.status === "sent") {
      if (kind === "invoice") { const je = postInvoiceJE(docId, ownerId, "owner"); run(`UPDATE trade_docs SET je_id=? WHERE id=?`, je, docId); }
      if (kind === "bill") { const je = postBillJE(docId, ownerId, "owner"); run(`UPDATE trade_docs SET je_id=? WHERE id=?`, je, docId); }
    }
    return { id: docId, number, total: base.total };
  };

  const makePayment = (opts: { direction: "in" | "out"; party_id?: number; date: string; amount: number; accountId: number; docIds?: { id: number; amount: number }[]; expenseIds?: { id: number; amount: number }[]; method?: string; ref?: string; currency?: string; fx?: number }) => {
    const number = nextNo(cid, "payment");
    const foreign = opts.currency && opts.currency !== "UZS" ? Math.round(opts.amount / (opts.fx || 1)) : opts.amount;
    const pid = insert(`INSERT INTO payments (company_id, number, direction, date, party_id, party_type, customer_id, supplier_id, account_id, method, reference, currency, fx_rate, amount, amount_foreign, status, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'recorded', ?)`,
      cid, number, opts.direction, opts.date, opts.party_id ?? null, opts.party_id ? (opts.direction === "in" ? "customer" : "supplier") : null,
      opts.direction === "in" ? opts.party_id ?? null : null, opts.direction === "out" ? opts.party_id ?? null : null,
      opts.accountId, opts.method ?? "bank", opts.ref ?? null, opts.currency ?? "UZS", opts.fx ?? 1, opts.amount, foreign, ownerId);
    for (const d of opts.docIds ?? []) {
      insert(`INSERT INTO payment_allocations (payment_id, doc_id, amount) VALUES (?,?,?)`, pid, d.id, d.amount);
      run(`UPDATE trade_docs SET paid = paid + ? WHERE id=?`, d.amount, d.id);
    }
    for (const e2 of opts.expenseIds ?? []) insert(`INSERT INTO payment_allocations (payment_id, expense_id, amount) VALUES (?,?,?)`, pid, e2.id, e2.amount);
    const je = postPaymentJE(pid, ownerId, "owner");
    run(`UPDATE payments SET je_id=? WHERE id=?`, je, pid);
    for (const d of opts.docIds ?? []) { const dd = get<any>(`SELECT * FROM trade_docs WHERE id=?`, d.id); if (dd) recalc(dd); }
    if (opts.direction === "in") paymentsMade.push({ date: opts.date, amount: opts.amount, accountId: opts.accountId, desc: `Payment ${number}` });
    return pid;
  };

  const recalc = (d: any) => {
    let status = d.status;
    const out = (d.total_base || d.total) - d.paid;
    if (out <= 0) status = "paid";
    else if (d.due_date < t) status = "overdue";
    else if (d.paid > 0) status = "partial";
    run(`UPDATE trade_docs SET status=? WHERE id=?`, status, d.id);
  };

  // ---- history loop ----
  const startMonth = monthStart(addDays(monthStart(t), -(months - 1) * 30));
  let monthIdx = 0;
  const seasonality = [0.85, 0.9, 1, 1.1, 1.15, 1.25, 1.05, 0.95, 1.1, 1.2, 1.3, 1.4];
  for (let m = startMonth; m <= t; m = monthStart(addDays(m, 31)), monthIdx++) {
    const lastDay = m.slice(0, 7) === t.slice(0, 7) ? Number(t.slice(8, 10)) : monthLastDay(m);
    const monthIdxInYear = Number(m.slice(5, 7)) - 1;
    const seas = seasonality[monthIdxInYear];
    // revenue invoices
    const nInv = ri(rich ? 3 : 2, rich ? 6 : 3);
    const monthDocs: { id: number; number: string; total: number; customer: number; date: string; due: string }[] = [];
    for (let i = 0; i < nInv; i++) {
      const cust = customerIds[Math.floor(rnd() * customerIds.length)];
      const custCur = get<any>(`SELECT currency FROM customers WHERE id=?`, cust)?.currency;
      const inUsd = custCur === "USD" && rnd() < 0.8;
      const dDate = addDays(m, ri(0, Math.max(0, lastDay - 4)));
      const nItems = ri(1, 3);
      const items = Array.from({ length: nItems }, () => {
        const [desc, price, cost] = pick(PRODUCTS);
        const qty = ri(2, 18);
        return { desc, qty: inUsd ? Math.max(1, Math.round(qty / 12)) : qty, price: inUsd ? Math.round(price / 12_000) * 100 : niceMinor(Math.round(price * (0.85 + rnd() * 0.3))), cost, tax_pct: inUsd ? 0 : 12 };
      });
      const fx = inUsd ? Math.round((12_000 + ri(-400, 900)) * 1000) / 1000 : 1;
      const doc = makeDoc("invoice", { party_id: cust, date: dDate, due: addDays(dDate, 14), items, currency: inUsd ? "USD" : "UZS", fx });
      if (inUsd) {
        // revenue already posted in base (total converted) — ensure fx conversion: total in foreign; base stored.
      }
      monthDocs.push({ ...doc, customer: cust, date: dDate, due: addDays(dDate, 14) });
    }
    // payments against this + previous months' docs
    const open = all<any>(`SELECT id, number, date, total_base, total, paid, party_id, due_date FROM trade_docs WHERE company_id=? AND kind='invoice' AND status IN ('sent','partial','overdue')`, cid);
    for (const doc of open) {
      if (doc.paid >= doc.total_base) continue;
      const ageDays = ri(3, 22);
      const pDate = addDays(doc.date, ageDays);
      if (pDate > t) continue;
      const r = rnd();
      const cover = r < 0.62 ? doc.total_base - doc.paid : Math.round((doc.total_base - doc.paid) * (0.3 + rnd() * 0.4));
      if (cover <= 0) continue;
      const acc = getAnyCur(cid, doc.id) === "USD" ? bankUsd : bankUzs;
      const docFx = get<any>(`SELECT fx_rate f FROM trade_docs WHERE id=?`, doc.id)?.f ?? 1;
      makePayment({ direction: "in", party_id: doc.party_id, date: pDate, amount: cover, accountId: acc, docIds: [{ id: doc.id, amount: cover }], currency: getAnyCur(cid, doc.id), fx: docFx > 1 ? docFx : 1 });
    }
    // COGS bills (60% paid, rest open with staggered due)
    const nBills = ri(2, rich ? 4 : 2);
    for (let i = 0; i < nBills; i++) {
      const sup = supplierIds[Math.floor(rnd() * supplierIds.length)];
      const dDate = addDays(m, ri(0, Math.max(0, lastDay - 6)));
      const due = addDays(dDate, ri(10, 25));
      const doc = makeDoc("bill", { party_id: sup, date: dDate, due, items: [{ desc: pick(["Raw materials batch", "Polymer feedstock", "Metal profiles", "Packaging & consumables", "Freight & handling", "Subcontract works"]), qty: ri(1, 2), price: niceMinor(ri(2, 12) * 1_000_000), tax_pct: 12, account_id: cogs }].concat(rnd() < 0.3 ? [{ desc: "Quality testing", qty: 1, price: niceMinor(ri(1, 2) * 1_000_000), tax_pct: 12, account_id: cogs }] : []) });
      const payProb = due < addDays(t, -10) ? 0.85 : due < t ? 0.4 : 0.1;
      if (rnd() < payProb && due <= t) {
        makePayment({ direction: "out", party_id: sup, date: addDays(dDate, ri(8, Math.max(9, daysBetween(dDate, due)))), amount: doc.total, accountId: bankUzs, docIds: [{ id: doc.id, amount: doc.total }] });
      } else {
        billsOpen.push({ ...doc, due });
      }
    }
    // payroll + rent + utilities + software + marketing + fees
    const postedAt = (day: number) => Math.min(day, lastDay);
    if (postedAt(5) <= lastDay) makeExpense(m, 5, "Monthly payroll", expenseAccounts.find(e => e.code === "6100")!.id, niceMinor(Math.round((rich ? 96_000_000 : 41_000_000) * (0.9 + monthIdx * 0.012))), bankUzs, null, { recur: "monthly", dom: 5 });
    if (postedAt(3) <= lastDay) makeExpense(m, 3, "Warehouse & office rent", expenseAccounts.find(e => e.code === "6200")!.id, niceMinor(rich ? 28_500_000 : 9_800_000), bankUzs, null, { recur: "monthly", dom: 3, tax: 0 });
    if (postedAt(12) <= lastDay) makeExpense(m, 12, pick(["Electricity & gas", "Water & heating"]), expenseAccounts.find(e => e.code === "6250")!.id, niceMinor(ri(4, 9) * 1_000_000), bankUzs, null, {});
    if (postedAt(8) <= lastDay) makeExpense(m, 8, "Software subscriptions (1C, Figma, Mizom)", expenseAccounts.find(e => e.code === "6500")!.id, niceMinor(ri(5, 8) * 1_000_000), bankUzs, supplierIds[3], { recur: "monthly", dom: 8 });
    if (rnd() < 0.75) makeExpense(m, ri(10, 25), pick(["Digital campaign — Q3", "Billboards Chorsu", "Trade show booth", "Google & Yandex ads", "Brand refresh"]), expenseAccounts.find(e => e.code === "6300")!.id, niceMinor(ri(12, 38) * 1_000_000), bankUzs, supplierIds[5], {});
    if (rnd() < 0.6) makeExpense(m, ri(2, 27), pick(["Fuel cards", "Client travel", "Courier service"]), expenseAccounts.find(e => e.code === "6400")!.id, niceMinor(ri(4, 11) * 1_000_000), bankUzs, null, {});
    if (rnd() < 0.5) makeExpense(m, ri(5, 25), pick(["Office supplies restock", "Breakroom & cleaning", "Printing"]), expenseAccounts.find(e => e.code === "6600")!.id, niceMinor(ri(1, 4) * 1_000_000), cash, supplierIds[2], {});
    makeExpense(m, 28, "Bank account maintenance", expenseAccounts.find(e => e.code === "6700")!.id, niceMinor(ri(180, 400) * 1_000), bankUzs, null, {});
    // VAT settlement (quarterly-ish): pay ~80% of net tax when collected > paid
    if (monthIdxInYear % 3 === 1 || !rich) {
      const netTax = get<any>(`SELECT COALESCE(SUM(l.credit - l.debit),0) v FROM journal_lines l JOIN accounts a ON a.id=l.account_id JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.company_id=? AND a.subtype='tax' AND e.date>=? AND e.date<=?`, cid, m, addDays(m, lastDay - 1))?.v ?? 0;
      if (netTax > 5_000_000_000) {
        const amt = Math.round(Math.max(0, netTax) * 0.92);
        postEntry({ companyId: cid, date: addDays(m, Math.min(20, lastDay)), description: "VAT payment to budget", ref: "TAX-" + m.slice(0, 7), sourceKind: "manual", lines: [{ accountId: taxAcc, debit: amt, credit: 0 }, { accountId: acc1010, debit: 0, credit: amt, memo: "Treasury payment" }], userId: ownerId });
      }
    }
  }

  function getAnyCur(cid: number, docId: number) { return get<any>(`SELECT currency FROM trade_docs WHERE id=?`, docId)?.currency ?? "UZS"; }

  function makeExpense(m: string, day: number, description: string, catAcc: number, amount: number, bankId: number, supplier: number | null, opts: { recur?: string; dom?: number; tax?: number }) {
    const tax = opts.tax ?? Math.round(amount * 0.12);
    const id = insert(`INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, tax_pct, account_id, status, created_by, recur_freq, recur_dom)
      VALUES (?,?,?,?,?,?,?,?,?,'posted',?,?,?)`,
      cid, addDays(m, day - 1), supplier, catAcc, description, amount, opts.tax === 0 ? 0 : tax, opts.tax === 0 ? 0 : 12, bankId, ownerId, opts.recur ?? null, opts.dom ?? null);
    postExpenseJE(id, ownerId, "owner");
    run(`UPDATE expenses SET je_id=(SELECT id FROM journal_entries WHERE source_kind='expense' AND source_id=? ORDER BY id DESC LIMIT 1) WHERE id=?`, id, id);
    return id;
  }

  // pending approvals (recent, over threshold)
  const pend1 = insert(`INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, tax_pct, account_id, status, created_by)
    VALUES (?,?,?,?,?,?,?,?,?, 'pending_approval', ?)`, cid, addDays(t, -2), supplierIds[4], expenseAccounts.find(e => e.code === "6400")!.id, "Forklift lease + service (Q4)", niceMinor(14_800_000), Math.round(niceMinor(14_800_000) * 0.12), 12, null, ownerId);
  const pend2 = insert(`INSERT INTO expenses (company_id, date, supplier_id, category_account_id, description, amount, tax, tax_pct, account_id, status, created_by)
    VALUES (?,?,?,?,?,?,?,?,?, 'pending_approval', ?)`, cid, addDays(t, -1), null, expenseAccounts.find(e => e.code === "6300")!.id, "Sponsorship — B2B summit", niceMinor(6_400_000), Math.round(niceMinor(6_400_000) * 0.12), 12, null, ownerId);
  insert(`INSERT INTO approval_requests (company_id, entity_kind, entity_id, step, status, actor_role) VALUES (?,?,?,?, 'pending', 'finance_manager')`, cid, "expense", pend1, 1);
  insert(`INSERT INTO approval_requests (company_id, entity_kind, entity_id, step, status, actor_role) VALUES (?,?,?,?, 'pending', 'finance_manager')`, cid, "expense", pend2, 1);

  if (rich) {
    // pipeline docs: quote → order → invoice
    const q = makeDoc("quote", { party_id: customerIds[3], date: addDays(t, -9), due: addDays(t, 5), status: "sent", items: [{ desc: "Design & prototyping", qty: 2, price: niceMinor(6_500_000), tax_pct: 12 }, { desc: "Custom extrusion batch", qty: 3, price: niceMinor(3_200_000), tax_pct: 12 }] });
    run(`UPDATE trade_docs SET status='accepted' WHERE id=?`, q.id);
    const so = makeDoc("sales_order", { party_id: customerIds[3], date: addDays(t, -6), due: addDays(t, 12), status: "open", items: [{ desc: "Design & prototyping", qty: 2, price: niceMinor(6_500_000), tax_pct: 12 }, { desc: "Custom extrusion batch", qty: 3, price: niceMinor(3_200_000), tax_pct: 12 }] });
    run(`UPDATE trade_docs SET origin_doc_id=? WHERE id=?`, q.id, so.id);
    const invDraft = makeDoc("invoice", { party_id: customerIds[6], date: addDays(t, -1), due: addDays(t, 13), status: "draft", items: [{ desc: "Insulation kits (set of 12)", qty: 40, price: niceMinor(780_000), tax_pct: 12 }] });
    run(`UPDATE trade_docs SET origin_doc_id=? WHERE id=?`, so.id, invDraft.id);
    const po = makeDoc("purchase_order", { party_id: supplierIds[1], date: addDays(t, -4), due: addDays(t, 18), status: "sent", items: [{ desc: "Steel profiles — Q4 stock", qty: 12, price: niceMinor(4_900_000), tax_pct: 12 }] });
    void po;
    // credit note
    const paidDoc = get<any>(`SELECT d.*, c.name FROM trade_docs d JOIN customers c ON c.id=d.party_id WHERE d.company_id=? AND d.kind='invoice' AND d.status IN ('sent','partial') AND d.total_base > 4_000_000_000 AND d.total_base > 2 * ? ORDER BY d.date DESC LIMIT 1`, cid, niceMinor(9_408_000));
    if (paidDoc) {
      const cn = makeDoc("invoice", { party_id: paidDoc.party_id, date: addDays(t, -3), due: addDays(t, -3), status: "draft", items: [{ desc: "Credit note — returned batch", qty: -1, price: niceMinor(2_100_000) * 4, tax_pct: 12 }] });
      const cnRev = niceMinor(2_100_000) * 4, cnTax = Math.round(cnRev * 0.12);
      run(`UPDATE trade_docs SET kind='credit_note', status='sent', credit_note_of=?, total=-total, subtotal=-subtotal, tax=-tax, total_base=-total_base, subtotal_base=-subtotal_base, tax_base=-tax_base, notes='Adjustment for returned goods' WHERE id=?`, paidDoc.id, cn.id);
      run(`UPDATE trade_docs SET total_base=MAX(0, total_base-?), total=MAX(0, total-?), subtotal_base=MAX(0, subtotal_base-?), subtotal=MAX(0, subtotal-?) WHERE id=?`, cnRev + cnTax, cnRev + cnTax, cnRev, cnRev, paidDoc.id);
      run(`UPDATE trade_doc_items SET amount=-amount, tax_amount=-tax_amount, unit_price=-unit_price WHERE doc_id=?`, cn.id);
      postEntry({ companyId: cid, date: addDays(t, -3), description: `Credit note ${cn.number}`, ref: cn.number, sourceKind: "credit_note", sourceId: cn.id, userId: ownerId,
        lines: [
          { accountId: accountBySubtype(cid, "sales").id, debit: cnRev, credit: 0, memo: "Returned batch" },
          { accountId: taxAcc, debit: cnTax, credit: 0, memo: "Tax reversal" },
          { accountId: accountBySubtype(cid, "ar").id, debit: 0, credit: cnRev + cnTax, memo: cn.number },
        ] });
    }
    // late payment pattern for insight demo: marketing spike last month
    const lastM = monthStart(addDays(monthStart(t), -30));
    makeExpense(lastM, 14, "Aggressive campaign push (marketing)", expenseAccounts.find(e => e.code === "6300")!.id, niceMinor(58_000_000), bankUzs, supplierIds[5], {});
  }

  // a couple of open bills due soon (committed payments for forecast demo)
  for (let i = 0; i < (rich ? 3 : 1); i++) {
    const sup = supplierIds[i % supplierIds.length];
    const doc = makeDoc("bill", { party_id: sup, date: addDays(t, -(4 + i * 3)), due: addDays(t, 3 + i * 6), items: [{ desc: pick(["Maintenance contract", "Restock order", "Equipment service"]), qty: ri(1, 4), price: niceMinor(ri(3, 12) * 1_000_000), tax_pct: 12, account_id: accountIdByCode(cid, "6900")! }] });
    void doc;
  }
  // overdue invoices demo: force 3 old sent docs into overdue with no payment
  const candidates = all<any>(`SELECT id FROM trade_docs WHERE company_id=? AND kind='invoice' AND paid=0 AND status='sent' ORDER BY random() LIMIT 3`, cid);
  for (const c of candidates) run(`UPDATE trade_docs SET status='overdue', due_date=date('now','-25 days') WHERE id=?`, c.id);

  // transfers demo
  postTransferDemo(cid, bankUzs, bankUsd, 12_000_00, addDays(t, -12), ownerId);

  // bank feed (for reconciliation): generate lines; ~80% matched to payments/expenses, rest noise
  const cashMoves = all<any>(
    `SELECT e.date, l.account_id, l.debit, l.credit, e.description, a.subtype, e.source_kind, e.source_id, e.id AS entry_id
     FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id JOIN accounts a ON a.id=l.account_id
     WHERE l.company_id=? AND a.subtype IN ('cash','bank') AND e.status='posted' AND e.date >= date('now','-35 days') ORDER BY e.date`, cid);
  const bankLedger1010 = acc1010;
  for (const mv of cashMoves) {
    if (mv.account_id !== bankLedger1010) continue;
    const matched = rnd() < 0.78;
    const amount = mv.debit > 0 ? mv.debit : -mv.credit;
    insert(`INSERT INTO bank_lines (company_id, account_id, date, description, amount, status, matched_payment_id, import_batch) VALUES (?,?,?,?,?,?,?, 'demo-statement-v1')`,
      cid, bankUzs, mv.date, mv.description, amount, matched ? "matched" : rnd() < 0.5 ? "unmatched" : "review",
      mv.source_kind === "payment" ? mv.source_id : null);
  }
  // some feed lines with no book entry yet (need creation)
  insert(`INSERT INTO bank_lines (company_id, account_id, date, description, amount, status, import_batch) VALUES
    (?,?,date('now','-6 days'),'POS purchase — office equipment', -?, 'unmatched','demo-statement-v1'),
    (?,?,date('now','-4 days'),'Client transfer — prepayment', ?, 'unmatched','demo-statement-v1'),
    (?,?,date('now','-2 days'),'ATM — petty cash withdrawal', -?, 'review','demo-statement-v1')`,
    cid, bankUzs, niceMinor(3_450_000), cid, bankUzs, niceMinor(9_900_000), cid, bankUzs, niceMinor(500_000));

  run(`UPDATE companies SET onboarded=1 WHERE id=?`, cid);
}

function postTransferDemo(cid: number, fromBank: number, toBank: number, amountForeignMinor: number, date: string, userId: number) {
  const fxRow = get<any>(`SELECT rate FROM exchange_rates WHERE company_id=? AND from_currency='USD' AND date<=? ORDER BY date DESC LIMIT 1`, cid, date);
  const rate = fxRow?.rate ?? 12_500;
  const base = Math.round(amountForeignMinor * rate);
  const toAcc = get<any>(`SELECT a.id FROM bank_accounts ba JOIN accounts a ON a.id=ba.account_id WHERE ba.id=?`, toBank)?.id;
  const fromAcc = get<any>(`SELECT a.id FROM bank_accounts ba JOIN accounts a ON a.id=ba.account_id WHERE ba.id=?`, fromBank)?.id;
  postEntry({ companyId: cid, date, description: "Transfer — purchase of USD 12,000", ref: "TRF", sourceKind: "transfer", sourceId: null, userId,
    lines: [{ accountId: toAcc, debit: base, credit: 0, memo: "USD 12,000.00", currency: "USD", fxRate: rate, amountForeign: amountForeignMinor },
      { accountId: fromAcc, debit: 0, credit: base, memo: "USD 12,000.00" }] });
  void fromBank;
}

const NO_TABLE: Record<string, [string, string]> = {
  invoice: ["next_invoice_no", "invoice_prefix"], quote: ["next_quote_no", "quote_prefix"], bill: ["next_bill_no", "bill_prefix"],
  sales_order: ["next_order_no", "invoice_prefix"], purchase_order: ["next_po_no", "bill_prefix"], payment: ["next_payment_no", "invoice_prefix"], je: ["next_je_no", "invoice_prefix"],
};
function nextNo(cid: number, kind: keyof typeof NO_TABLE): string {
  const [seqField, preField] = NO_TABLE[kind as string] ?? NO_TABLE.invoice;
  const c = get<any>(`SELECT ${seqField} seq, ${preField} pre FROM companies WHERE id=?`, cid);
  const year = today().slice(0, 4);
  run(`UPDATE companies SET ${seqField}=? WHERE id=?`, (c?.seq ?? 1) + 1, cid);
  const label = { invoice: "INV", quote: "QUO", bill: "BILL", sales_order: "SO", purchase_order: "PO", payment: "PAY", je: "JE" }[kind as string] ?? "DOC";
  return `${label}-${year}-${String(c?.seq ?? 1).padStart(4, "0")}`;
}
function monthLastDay(m: string) {
  const d = new Date(m.slice(0, 4) + "-" + m.slice(5, 7) + "-28T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  return d.getUTCDate();
}
function daysBetween(a: string, b: string) { return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000); }

// second company: lighter, USD-based services firm to showcase multi-currency books
function seedCompanyUsdPlaceholder() { /* intentionally unused */ }
void seedCompanyUsdPlaceholder;
