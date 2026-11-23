import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db";

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

/** Applica in ordine i file migrations/NNNN_*.sql non ancora eseguiti, ciascuno in una transazione. */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (name varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    await client.query("SELECT pg_advisory_lock(771100)");
    const done = new Set((await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] applico ${file}`);
      try {
        await client.query("BEGIN");
        await client.query(sqlText);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        // Il database di produzione Replit può ricevere lo schema già sincronizzato dalla pubblicazione:
        // se gli oggetti esistono già, la migrazione viene registrata come applicata.
        const code = (e as any).code;
        if (["42P07", "42701", "42710", "42P06"].includes(code)) {
          console.log(`[migrate] ${file}: schema già presente, registrata come applicata`);
          await client.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
          continue;
        }
        throw new Error(`Migrazione ${file} fallita: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(771100)").catch(() => {});
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations().then(() => { console.log("[migrate] completato"); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
