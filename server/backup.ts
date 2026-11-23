import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Copia di sicurezza completa del database con pg_dump (compressa). Uso: npm run db:backup
const dir = path.resolve("backups");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`);
const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", process.env.DATABASE_URL!], { stdio: ["ignore", "pipe", "inherit"] });
dump.stdout.pipe(zlib.createGzip()).pipe(fs.createWriteStream(file));
dump.on("close", (code) => {
  if (code !== 0) { console.error("Backup non riuscito"); process.exit(1); }
  console.log(`Backup creato: ${file}\nScaricalo e conservalo in un luogo protetto: contiene dati sanitari.`);
});
