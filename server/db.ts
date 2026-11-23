import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL mancante: aggiungi il database PostgreSQL di Replit (strumento Database) e riavvia.");
}

// date (1082) come stringa "YYYY-MM-DD", numeric e bigint come numeri
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v == null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v == null ? null : Number(v)));

const url = process.env.DATABASE_URL;
const needsSsl = /sslmode=require|neon\.tech/.test(url) && !/localhost|127\.0\.0\.1|helium/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
pool.on("error", (err) => console.error("[db] errore pool:", err.message));

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function mapRow(r: Record<string, any>) {
  const o: Record<string, any> = {};
  for (const k of Object.keys(r)) o[camel(k)] = r[k];
  return o;
}

type Queryable = { query: (text: string, params?: any[]) => Promise<pg.QueryResult<any>> };

/** Esegue una query e restituisce le righe con chiavi camelCase. */
export async function q<T = any>(text: string, params: any[] = [], c: Queryable = pool): Promise<T[]> {
  const r = await c.query(text, params);
  return r.rows.map(mapRow) as T[];
}
export async function one<T = any>(text: string, params: any[] = [], c: Queryable = pool): Promise<T | undefined> {
  return (await q<T>(text, params, c))[0];
}

/** Transazione con client dedicato. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** INSERT da oggetto con colonne in whitelist. */
export async function insert<T = any>(table: string, data: Record<string, any>, allowed: string[], c: Queryable = pool): Promise<T> {
  const keys = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined);
  const cols = keys.map(snake);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`;
  return (await one<T>(sql, keys.map((k) => data[k]), c))!;
}

/** UPDATE da oggetto con colonne in whitelist; `where` usa i parametri successivi. */
export async function update<T = any>(table: string, data: Record<string, any>, allowed: string[], where: string, whereParams: any[], c: Queryable = pool): Promise<T | undefined> {
  const keys = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined);
  if (!keys.length) return one<T>(`SELECT * FROM ${table} WHERE ${where.replace(/\$(\d+)/g, (_, n) => `$${n}`)}`, whereParams, c);
  const set = keys.map((k, i) => `${snake(k)} = $${i + 1}`).join(", ");
  const shifted = where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + keys.length}`);
  return one<T>(`UPDATE ${table} SET ${set} WHERE ${shifted} RETURNING *`, [...keys.map((k) => data[k]), ...whereParams], c);
}
