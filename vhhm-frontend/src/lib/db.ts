import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Lazy-initialized SQL function — only connects when first query is made
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSQL(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set. Please configure a Neon Postgres database.');
    }
    _sql = neon(databaseUrl);
  }
  return _sql;
}

// Tagged template helper that lazily initializes the connection
export async function query(strings: TemplateStringsArray, ...values: any[]) {
  const sql = getSQL();
  return sql(strings, ...values);
}

// Initialize database tables
export async function initDB() {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      name TEXT,
      age INTEGER,
      gender TEXT,
      is_verified INTEGER DEFAULT 1,
      verify_token TEXT,
      token_expiry TEXT,
      reset_token TEXT,
      reset_expiry TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS health_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      timestamp TEXT,
      hr INTEGER,
      bp TEXT,
      oxygen REAL,
      water INTEGER,
      sleep REAL,
      reason TEXT,
      diagnosis TEXT,
      prescription TEXT,
      remedies TEXT,
      exercises TEXT
    )
  `;
}
