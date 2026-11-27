import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __clinicSql?: postgres.Sql };

function databaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    // Local development default (matches the sandbox's on-demand Postgres).
    // On Vercel, DATABASE_URL must be set in the project settings -> Supabase.
    (process.env.VERCEL ? undefined : "postgres://ubuntu:ubuntu@127.0.0.1:5432/app");
  if (!url) throw new Error("DATABASE_URL غير مضبوط — اربط التطبيق بقاعدة Postgres أولاً");
  return url;
}

function client(): postgres.Sql {
  if (globalForDb.__clinicSql) return globalForDb.__clinicSql;
  const sql = postgres(databaseUrl(), {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: 10,
    idle_timeout: 30,
    connect_timeout: 15,
    ssl: databaseUrl().includes("localhost") || databaseUrl().includes("127.0.0.1") ? false : "prefer",
  });
  globalForDb.__clinicSql = sql;
  return sql;
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
  denied_perms TEXT NOT NULL DEFAULT '',
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
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS content BYTEA;
ALTER TABLE attachments ALTER COLUMN stored_name SET DEFAULT '';
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

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = client();
      await sql.unsafe(SCHEMA);
      // Rows written before multi-currency support were in the clinic's base currency.
      for (const table of ["payments", "expenses"]) {
        await sql.unsafe(
          `UPDATE ${table} SET currency = COALESCE((SELECT currency FROM clinics WHERE clinics.id = ${table}.clinic_id), 'SAR') WHERE currency = ''`,
        );
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/** Translate SQLite-style `?` placeholders to Postgres `$1..$n`. */
function toPg(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  if (index !== params.length) throw new Error(`معاملات الاستعلام لا تطابق العناصر (${index} عنصرًا مقابل ${params.length})`);
  return { text, values: params };
}

export async function all<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const { text, values } = toPg(query, params);
  const rows = await client().unsafe(text, values as never[]);
  return rows.map((row) => ({ ...(row as Record<string, unknown>) })) as T[];
}

export async function get<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(query, params);
  return rows[0];
}

export async function run(query: string, params: unknown[] = []) {
  await ensureSchema();
  const { text, values } = toPg(query, params);
  await client().unsafe(text, values as never[]);
}

/** Run writes atomically; the callback receives the awaited helpers. */
export async function tx<T>(fn: (helpers: { get: typeof get; all: typeof all; run: typeof run }) => Promise<T>): Promise<T> {
  await ensureSchema();
  const sql = client();
  return sql.begin(async (scoped) => {
    const helpers = {
      async get<X = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<X | undefined> {
        const { text, values } = toPg(query, params);
        const rows = await scoped.unsafe(text, values as never[]);
        return rows[0] as X | undefined;
      },
      async all<X = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<X[]> {
        const { text, values } = toPg(query, params);
        const rows = await scoped.unsafe(text, values as never[]);
        return rows.map((row) => ({ ...(row as Record<string, unknown>) })) as X[];
      },
      async run(query: string, params: unknown[] = []) {
        const { text, values } = toPg(query, params);
        await scoped.unsafe(text, values as never[]);
      },
    };
    return fn(helpers);
  }) as Promise<T>;
}

export const uploadsDir = () => {
  const dir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
