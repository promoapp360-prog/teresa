import crypto from "node:crypto";

const isProd = process.env.NODE_ENV === "production";

function key(): Buffer | null {
  const raw = process.env.FILES_ENCRYPTION_KEY;
  if (raw) return crypto.createHash("sha256").update(raw).digest();
  if (!isProd) return crypto.createHash("sha256").update("chiave-di-sviluppo-non-usare-con-dati-reali").digest();
  return null;
}

export const encryptionReady = () => key() !== null;

export function encrypt(data: Buffer) {
  const k = key();
  if (!k) throw Object.assign(new Error("FILES_ENCRYPTION_KEY mancante nei Secrets: il caricamento di documenti clinici è bloccato finché non viene impostata."), { status: 503 });
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return { iv, tag: c.getAuthTag(), data: enc };
}

export function decrypt(data: Buffer, iv: Buffer, tag: Buffer) {
  const k = key();
  if (!k) throw Object.assign(new Error("FILES_ENCRYPTION_KEY mancante: impossibile leggere i documenti cifrati."), { status: 503 });
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]);
}

export const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
