import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __clinicDb?: DatabaseSync; __clinicDbVersion?: number };

function dataDir() {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'SAR',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  gender TEXT DEFAULT 'male',
  birth_date TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  portal_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 20,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  appointment_id TEXT,
  doctor_id TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  complaint TEXT DEFAULT '',
  vitals TEXT DEFAULT '',
  exam TEXT DEFAULT '',
  diagnosis TEXT DEFAULT '',
  treatment TEXT DEFAULT '',
  recommendations TEXT DEFAULT '',
  follow_up TEXT DEFAULT '',
  fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  shared INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  visit_id TEXT,
  doctor_id TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  instructions TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  visit_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT '',
  rate REAL NOT NULL DEFAULT 1,
  method TEXT DEFAULT 'cash',
  note TEXT DEFAULT '',
  paid_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT '',
  rate REAL NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'general',
  spent_at TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clinic_currencies (
  clinic_id TEXT NOT NULL,
  code TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (clinic_id, code)
);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  visit_id TEXT,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  share_with_portal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  user_id TEXT,
  patient_id TEXT,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  kind TEXT DEFAULT 'info',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  user_id TEXT,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_clinic ON audit_logs(clinic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appts_clinic ON appointments(clinic_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_visits_clinic ON visits(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_clinic ON payments(clinic_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

const SCHEMA_VERSION = 3;

export function getStore(): DatabaseSync {
  const cached = globalForDb.__clinicDb;
  if (cached && globalForDb.__clinicDbVersion === SCHEMA_VERSION) return cached;
  const db = cached ?? new DatabaseSync(path.join(dataDir(), "clinic.db"));
  // Rollback journal, not WAL: WAL commits live in sidecar files that some hosts prune,
  // which silently drops committed writes. This is a single-writer app, so WAL buys nothing.
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec("PRAGMA synchronous = FULL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  globalForDb.__clinicDb = db;
  globalForDb.__clinicDbVersion = SCHEMA_VERSION;
  return db;
}

/** Additive migrations for databases created before a column existed. */
function migrate(db: DatabaseSync) {
  const columns = [
    ["payments", "currency", "currency TEXT NOT NULL DEFAULT ''"],
    ["payments", "rate", "rate REAL NOT NULL DEFAULT 1"],
    ["expenses", "currency", "currency TEXT NOT NULL DEFAULT ''"],
    ["expenses", "rate", "rate REAL NOT NULL DEFAULT 1"],
    ["attachments", "share_with_portal", "share_with_portal INTEGER NOT NULL DEFAULT 0"],
    ["users", "denied_perms", "denied_perms TEXT NOT NULL DEFAULT ''"],
  ] as const;
  for (const [table, column, ddl] of columns) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!existing.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
  // Rows written before multi-currency support were in the clinic's base currency, not in an unknown one.
  for (const table of ["payments", "expenses"]) {
    db.exec(
      `UPDATE ${table} SET currency = COALESCE((SELECT currency FROM clinics WHERE clinics.id = ${table}.clinic_id), 'SAR') WHERE currency = ''`,
    );
  }
}

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const rows = getStore().prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
  return rows.map((row) => ({ ...row })) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const row = getStore().prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
  return row ? ({ ...row } as T) : undefined;
}

export function run(sql: string, params: unknown[] = []) {
  return getStore().prepare(sql).run(...(params as never[]));
}

export function tx<T>(fn: () => T): T {
  const db = getStore();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const uploadsDir = () => {
  const dir = path.join(dataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
