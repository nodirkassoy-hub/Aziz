/**
 * Mizom — data layer.
 * SQLite via node:sqlite (no native build required). All monetary values are
 * stored as INTEGER minor units (1/100) of the row currency; journal lines are
 * additionally stored in the company base currency so that every report derives
 * deterministically from the double-entry ledger.
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "mizom.db");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec("PRAGMA busy_timeout = 5000");
  migrate(_db);
  return _db;
}

export function runInTransaction<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    try { d.exec("ROLLBACK"); } catch { /* already rolled back */ }
    throw e;
  }
}

/* ---------- helpers ---------- */
export function all<T = Record<string, any>>(sql: string, ...params: any[]): T[] {
  // node:sqlite rows have null prototypes — not serializable to client components. Rebox them.
  return (db().prepare(sql).all(...params.map(norm)) as T[]).map((r) => Object.assign({}, r));
}
export function get<T = Record<string, any>>(sql: string, ...params: any[]): T | undefined {
  const r = db().prepare(sql).get(...params.map(norm)) as T | undefined;
  return r ? Object.assign({}, r) : undefined;
}
export function run(sql: string, ...params: any[]) {
  return db().prepare(sql).run(...params.map(norm));
}
export function insert(sql: string, ...params: any[]): number {
  const r = db().prepare(sql).run(...params.map(norm));
  return Number(r.lastInsertRowid);
}
function norm(v: any): any {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && !(v instanceof Buffer)) return JSON.stringify(v);
  return v;
}

/* ---------- schema ---------- */
function migrate(d: DatabaseSync) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, avatar TEXT, twofa_secret TEXT, twofa_enabled INTEGER DEFAULT 0,
    locale TEXT DEFAULT 'uz', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, device TEXT, ip TEXT,
    created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, legal_name TEXT, tax_id TEXT, address TEXT,
    phone TEXT, email TEXT, website TEXT, logo_doc_id INTEGER,
    base_currency TEXT DEFAULT 'UZS', fiscal_year_start_month INTEGER DEFAULT 1,
    invoice_prefix TEXT DEFAULT 'INV', quote_prefix TEXT DEFAULT 'QUO', bill_prefix TEXT DEFAULT 'BILL',
    next_invoice_no INTEGER DEFAULT 1, next_quote_no INTEGER DEFAULT 1, next_bill_no INTEGER DEFAULT 1,
    next_order_no INTEGER DEFAULT 1, next_po_no INTEGER DEFAULT 1, next_je_no INTEGER DEFAULT 1,
    next_payment_no INTEGER DEFAULT 1,
    payment_terms_days INTEGER DEFAULT 14,
    default_tax_rate_id INTEGER,
    invoice_notes TEXT, invoice_terms TEXT,
    accent_color TEXT DEFAULT '#1a9e83',
    invoice_layout TEXT DEFAULT 'classic',
    lock_date TEXT,
    approval_expense_threshold INTEGER DEFAULT 1000000000,
    approval_auto_post_ocr INTEGER DEFAULT 0,
    tax_authority TEXT, tax_registration TEXT, bank_name TEXT, bank_account_no TEXT, bank_currency TEXT,
    onboarded INTEGER DEFAULT 0, is_demo INTEGER DEFAULT 0,
    settings_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS memberships (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'accountant',
    prefs_json TEXT DEFAULT '{}',
    UNIQUE(company_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
    subtype TEXT, description TEXT, is_system INTEGER DEFAULT 0, archived INTEGER DEFAULT 0,
    parent_code TEXT, UNIQUE(company_id, code)
  );
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, date TEXT NOT NULL,
    from_currency TEXT NOT NULL, to_currency TEXT NOT NULL, rate REAL NOT NULL,
    source TEXT DEFAULT 'manual', UNIQUE(company_id, date, from_currency, to_currency)
  );
  CREATE TABLE IF NOT EXISTS tax_rates (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, name TEXT NOT NULL, rate_pct REAL NOT NULL,
    kind TEXT DEFAULT 'output_input' CHECK(kind IN ('output_input','withholding','none')),
    applies TEXT DEFAULT 'both' CHECK(applies IN ('sales','purchases','both')),
    tax_account_id INTEGER, input_tax_account_id INTEGER, is_default INTEGER DEFAULT 0, archived INTEGER DEFAULT 0,
    jurisdiction TEXT
  );
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, name TEXT NOT NULL, contact_person TEXT,
    phone TEXT, email TEXT, tax_id TEXT, address TEXT, credit_limit INTEGER DEFAULT 0,
    currency TEXT, notes TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, name TEXT NOT NULL, contact_person TEXT,
    phone TEXT, email TEXT, tax_id TEXT, address TEXT, currency TEXT, payment_terms_days INTEGER,
    notes TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  );
  /* Generic trade documents: quotes, sales orders, invoices, purchase orders, bills */
  CREATE TABLE IF NOT EXISTS trade_docs (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('quote','sales_order','invoice','bill','purchase_order','credit_note')),
    number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    party_id INTEGER NOT NULL, party_type TEXT,
    date TEXT NOT NULL, due_date TEXT, service_date TEXT,
    currency TEXT DEFAULT 'UZS', fx_rate REAL DEFAULT 1,
    subtotal INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, tax INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
    subtotal_base INTEGER DEFAULT 0, discount_base INTEGER DEFAULT 0, tax_base INTEGER DEFAULT 0, total_base INTEGER DEFAULT 0,
    paid INTEGER DEFAULT 0, -- payments applied, in base currency
    customer_id INTEGER, supplier_id INTEGER,
    notes TEXT, terms TEXT, origin_doc_id INTEGER, je_id INTEGER,
    void_reason TEXT, credit_note_of INTEGER,
    template TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(company_id, kind, number)
  );
  CREATE TABLE IF NOT EXISTS trade_doc_items (
    id INTEGER PRIMARY KEY, doc_id INTEGER NOT NULL, description TEXT NOT NULL,
    qty REAL DEFAULT 1, unit_price INTEGER DEFAULT 0, discount_pct REAL DEFAULT 0,
    tax_rate_id INTEGER, tax_pct REAL DEFAULT 0, amount INTEGER DEFAULT 0, tax_amount INTEGER DEFAULT 0,
    account_id INTEGER, sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, number TEXT,
    direction TEXT NOT NULL CHECK(direction IN ('in','out')),
    date TEXT NOT NULL, party_id INTEGER, party_type TEXT,
    customer_id INTEGER, supplier_id INTEGER,
    account_id INTEGER NOT NULL, method TEXT DEFAULT 'bank', reference TEXT, note TEXT,
    currency TEXT DEFAULT 'UZS', fx_rate REAL DEFAULT 1,
    amount_foreign INTEGER DEFAULT 0, amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'recorded', je_id INTEGER, created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payment_allocations (
    id INTEGER PRIMARY KEY, payment_id INTEGER NOT NULL, doc_id INTEGER, expense_id INTEGER, amount INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, date TEXT NOT NULL,
    supplier_id INTEGER, category_account_id INTEGER, description TEXT,
    amount INTEGER NOT NULL, tax INTEGER DEFAULT 0, tax_pct REAL DEFAULT 0, tax_rate_id INTEGER,
    account_id INTEGER, receipt_doc_id INTEGER,
    status TEXT NOT NULL DEFAULT 'posted', -- draft | pending_approval | approved | rejected | posted
    created_by INTEGER, approved_by INTEGER, approved_at TEXT, reject_reason TEXT,
    je_id INTEGER,
    recur_freq TEXT, recur_dom INTEGER, recur_ends TEXT, recur_group TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, name TEXT NOT NULL, bank TEXT,
    number TEXT, currency TEXT DEFAULT 'UZS', is_cash INTEGER DEFAULT 0, archived INTEGER DEFAULT 0,
    opening_balance INTEGER DEFAULT 0, opening_date TEXT, account_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bank_lines (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, account_id INTEGER NOT NULL,
    date TEXT NOT NULL, description TEXT, amount INTEGER NOT NULL,
    status TEXT DEFAULT 'unmatched', -- unmatched | matched | review | ignored | created
    matched_payment_id INTEGER, matched_expense_id INTEGER, created_doc_kind TEXT, created_doc_id INTEGER,
    recon_id INTEGER, category TEXT, currency TEXT DEFAULT 'UZS', fx_rate REAL DEFAULT 1,
    import_batch TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS reconciliations (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, account_id INTEGER NOT NULL,
    opening_balance INTEGER NOT NULL, ending_balance INTEGER NOT NULL,
    start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    status TEXT DEFAULT 'open', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, entry_no TEXT, date TEXT NOT NULL,
    description TEXT, ref TEXT,
    source_kind TEXT NOT NULL DEFAULT 'manual', -- manual|invoice|bill|payment|expense|transfer|opening|credit_note|reconcile
    source_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | posted
    period TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), posted_at TEXT,
    reversed_by INTEGER
  );
  CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL, company_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL, debit INTEGER DEFAULT 0, credit INTEGER DEFAULT 0,
    memo TEXT, currency TEXT DEFAULT 'UZS', fx_rate REAL DEFAULT 1, amount_foreign INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS period_locks (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, period TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open | closed | locked
    closed_by INTEGER, closed_at TEXT, note TEXT,
    UNIQUE(company_id, period)
  );
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, name TEXT NOT NULL,
    mime TEXT, size INTEGER, storage_name TEXT NOT NULL,
    entity_kind TEXT, entity_id INTEGER, kind TEXT DEFAULT 'file', -- file | receipt | contract | logo
    uploaded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ocr_jobs (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, file_id INTEGER,
    status TEXT DEFAULT 'pending', -- pending|needs_review|extracted|posted|failed
    extracted_json TEXT, confidence REAL, created_expense_id INTEGER,
    created_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY, company_id INTEGER, user_id INTEGER,
    kind TEXT, severity TEXT DEFAULT 'info', -- info | warn | danger | success
    title TEXT, body TEXT, link TEXT,
    read_at TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY, company_id INTEGER, user_id INTEGER, user_name TEXT,
    action TEXT, entity_kind TEXT, entity_id INTEGER, summary TEXT,
    old_json TEXT, new_json TEXT, ip TEXT, device TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, entity_kind TEXT NOT NULL, entity_id INTEGER NOT NULL,
    step INTEGER DEFAULT 1, status TEXT DEFAULT 'pending', -- pending|approved|rejected|skipped
    actor_role TEXT, decided_by INTEGER, decided_at TEXT, comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY, company_id INTEGER, doc_id INTEGER, to_addr TEXT, subject TEXT,
    body TEXT, status TEXT DEFAULT 'logged', -- provider not connected; logged only
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(entry_id);
  CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(company_id, account_id);
  CREATE INDEX IF NOT EXISTS idx_je_company_date ON journal_entries(company_id, date);
  CREATE INDEX IF NOT EXISTS idx_docs_party ON trade_docs(company_id, kind, status);
  CREATE INDEX IF NOT EXISTS idx_bank_lines ON bank_lines(company_id, account_id, date);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
  CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log(company_id, created_at);
  `);
  // Postgres-style compatibility guard: node:sqlite returns integers as numbers; ensure pragma
  d.exec("PRAGMA recursive_triggers = ON");
}

export function getSettings(company: any): any {
  try { return company?.settings_json ? JSON.parse(company.settings_json) : {}; } catch { return {}; }
}
