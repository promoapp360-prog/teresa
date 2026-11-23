import type { Request, Response, NextFunction, Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { one, pool } from "./db";
import { getSettings } from "./settings";

export type User = {
  id: number; username: string; fullName: string | null; email: string | null; role: "doctor" | "staff";
  passwordHash: string; mustChangePassword: boolean; totpSecret: string | null; totpEnabled: boolean;
  failedLogins: number; lockedUntil: Date | null; sessionVersion: number; active: boolean; lastLoginAt: Date | null; createdAt: Date;
};

declare module "express-session" {
  interface SessionData { userId?: number; sv?: number; pending2fa?: number; pendingAt?: number }
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: User } }
}

export const SESSION_IDLE_MS = 1000 * 60 * 60 * 2; // 2 ore di inattività

export function setupSession(app: Express) {
  const PgStore = connectPg(session);
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET mancante: impostalo nei Secrets di Replit.");
  }
  app.set("trust proxy", 1);
  app.use(session({
    store: new PgStore({ pool, tableName: "session", createTableIfMissing: false, pruneSessionInterval: 60 * 60 }),
    name: "sdv.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-non-usare-in-produzione",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_IDLE_MS },
  }));

  app.use(async (req, _res, next) => {
    if (!req.session.userId || !req.path.startsWith("/api")) return next();
    try {
      const u = await one<User>("SELECT * FROM users WHERE id = $1", [req.session.userId]);
      if (u && u.active && (req.session.sv ?? 1) === u.sessionVersion) req.user = u;
      else { req.session.userId = undefined; req.session.sv = undefined; }
    } catch (e) { return next(e); }
    next();
  });

  // cambio password obbligatorio: finché non avviene sono consentite solo le API di autenticazione
  app.use("/api", (req, res, next) => {
    if (req.user?.mustChangePassword && !req.path.startsWith("/auth/") && !req.path.startsWith("/public/")) {
      return res.status(403).json({ error: "Cambia la password iniziale prima di continuare", code: "MUST_CHANGE_PASSWORD" });
    }
    next();
  });
}

export const hashPassword = (pw: string) => argonHash(pw, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export async function verifyPassword(pw: string, stored: string) {
  try { return await argonVerify(stored, pw); } catch { return false; }
}

export function passwordProblem(pw: string) {
  if (pw.length < 10) return "La password deve avere almeno 10 caratteri";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "La password deve contenere lettere maiuscole, minuscole e numeri";
  return null;
}

export function publicUser(u: User) {
  const { passwordHash, totpSecret, failedLogins, lockedUntil, sessionVersion, ...rest } = u;
  return rest;
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Accesso richiesto" });
  next();
}

/** Dati clinici: solo il medico; se richiesto dalle impostazioni, con 2FA attiva. */
export function requireDoctor(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Accesso richiesto" });
  if (req.user.role !== "doctor") return res.status(403).json({ error: "Dati clinici riservati al medico" });
  getSettings().then((s) => {
    if (s.security.require2faForClinical && !req.user!.totpEnabled) {
      return res.status(403).json({ error: "Attiva l'autenticazione a due fattori per accedere alla cartella clinica", code: "NEED_2FA" });
    }
    next();
  }).catch(next);
}

export async function revokeSessions(userId: number, keepSid?: string) {
  await pool.query("UPDATE users SET session_version = session_version + 1 WHERE id = $1", [userId]);
  await pool.query(`DELETE FROM "session" WHERE (sess->>'userId')::int = $1 AND sid <> $2`, [userId, keepSid || ""]);
}

/** Protezione CSRF: per le richieste che modificano dati l'origine deve essere il sito stesso. */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.originalUrl.startsWith("/api/cron")) return next();
  const origin = req.get("origin") || req.get("referer");
  if (!origin) return req.get("x-requested-with") === "fetch" ? next() : res.status(403).json({ error: "Richiesta non valida (origine mancante)" });
  try {
    const o = new URL(origin);
    const allowed = new Set([req.get("host"), process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : null].filter(Boolean));
    if (allowed.has(o.host)) return next();
  } catch { /* origine non valida */ }
  return res.status(403).json({ error: "Richiesta non valida (origine non consentita)" });
}
