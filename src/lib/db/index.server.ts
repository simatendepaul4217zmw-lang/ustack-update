import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = getPool();
  const result = await client.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  const client = getPool();
  await client.query(sql, params);
}

// ─── Transaction helper ───────────────────────────────────────────────────────
// Wraps a block of DB work in BEGIN/COMMIT. On error rolls back and re-throws.
// The callback receives scoped query/queryOne/execute helpers that reuse the
// same pg.PoolClient, ensuring all statements run in the same transaction.

interface TxHelpers {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

export async function withTransaction<T>(fn: (db: TxHelpers) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn({
      query: async <R>(sql: string, params?: unknown[]) => {
        const r = await client.query(sql, params);
        return r.rows as R[];
      },
      queryOne: async <R>(sql: string, params?: unknown[]) => {
        const r = await client.query(sql, params);
        return (r.rows[0] ?? null) as R | null;
      },
      execute: async (sql: string, params?: unknown[]) => {
        await client.query(sql, params);
      },
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
