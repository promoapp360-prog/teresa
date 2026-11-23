import { Router } from "express";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { z } from "zod";
import { one, pool } from "../db";
import { h, HttpError } from "../util";
import { hashPassword, verifyPassword, passwordProblem, publicUser, revokeSessions, requireStaff, type User } from "../auth";
import { generateSecret, verifyTotp, otpauthUrl } from "../totp";
import { audit } from "../audit";

const r = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Troppi tentativi, riprova tra qualche minuto" } });

function startSession(req: any, u: User) {
  return new Promise<void>((resolve, reject) => req.session.regenerate((err: any) => {
    if (err) return reject(err);
    req.session.userId = u.id; req.session.sv = u.sessionVersion;
    req.session.save((e: any) => (e ? reject(e) : resolve()));
  }));
}

r.post("/login", loginLimiter, h(async (req, res) => {
  const { username, password } = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) }).parse(req.body);
  const u = await one<User>("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
  const fail = async () => {
    await audit(req, "login_fallito", { username, detail: { motivo: "credenziali" } });
    throw new HttpError(401, "Credenziali non valide");
  };
  if (!u || !u.active) return fail();
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) throw new HttpError(429, "Account temporaneamente bloccato per troppi tentativi. Riprova tra 15 minuti.");
  if (!(await verifyPassword(password, u.passwordHash))) {
    await pool.query(`UPDATE users SET failed_logins = failed_logins + 1, locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END WHERE id = $1`, [u.id]);
    return fail();
  }
  await pool.query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [u.id]);
  if (u.totpEnabled) {
    req.session.pending2fa = u.id; req.session.pendingAt = Date.now();
    return res.json({ need2fa: true });
  }
  await startSession(req, u);
  await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [u.id]);
  await audit(req, "login", { userId: u.id, username: u.username });
  res.json({ user: publicUser(u) });
}));

r.post("/login/2fa", loginLimiter, h(async (req, res) => {
  const { code } = z.object({ code: z.string().max(10) }).parse(req.body);
  const uid = req.session.pending2fa;
  if (!uid || Date.now() - (req.session.pendingAt || 0) > 5 * 60_000) throw new HttpError(401, "Sessione di accesso scaduta, reinserisci la password");
  const u = await one<User>("SELECT * FROM users WHERE id = $1", [uid]);
  if (!u || !u.active || !u.totpSecret || !verifyTotp(u.totpSecret, code)) {
    await audit(req, "login_fallito", { userId: uid, detail: { motivo: "codice 2FA" } });
    throw new HttpError(401, "Codice non valido");
  }
  await startSession(req, u);
  await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [u.id]);
  await audit(req, "login", { userId: u.id, username: u.username, detail: { twoFactor: true } });
  res.json({ user: publicUser(u) });
}));

r.post("/logout", h(async (req, res) => {
  if (req.user) await audit(req, "logout");
  req.session.destroy(() => res.json({ ok: true }));
}));

r.get("/me", (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

r.post("/change-password", requireStaff, h(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().max(200), newPassword: z.string().max(200) }).parse(req.body);
  const u = req.user!;
  if (!(await verifyPassword(currentPassword, u.passwordHash))) throw new HttpError(400, "La password attuale non è corretta");
  const problem = passwordProblem(newPassword);
  if (problem) throw new HttpError(400, problem);
  if (newPassword === currentPassword) throw new HttpError(400, "La nuova password deve essere diversa da quella attuale");
  await pool.query("UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1", [u.id, await hashPassword(newPassword)]);
  await revokeSessions(u.id, req.sessionID);
  const fresh = (await one<User>("SELECT * FROM users WHERE id = $1", [u.id]))!;
  req.session.sv = fresh.sessionVersion;
  await audit(req, "password_cambiata");
  res.json({ user: publicUser(fresh) });
}));

// ---------- autenticazione a due fattori (app Authenticator) ----------
r.post("/2fa/setup", requireStaff, h(async (req, res) => {
  const u = req.user!;
  if (u.totpEnabled) throw new HttpError(400, "L'autenticazione a due fattori è già attiva");
  const secret = generateSecret();
  await pool.query("UPDATE users SET totp_secret = $2 WHERE id = $1", [u.id, secret]);
  const url = otpauthUrl(secret, u.username, "Studio della Volpe");
  res.json({ secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
}));

r.post("/2fa/enable", requireStaff, h(async (req, res) => {
  const { code } = z.object({ code: z.string().max(10) }).parse(req.body);
  const u = req.user!;
  if (!u.totpSecret || !verifyTotp(u.totpSecret, code)) throw new HttpError(400, "Codice non valido: controlla l'ora del telefono e riprova");
  await pool.query("UPDATE users SET totp_enabled = true WHERE id = $1", [u.id]);
  await audit(req, "2fa_attivata");
  res.json({ ok: true });
}));

r.post("/2fa/disable", requireStaff, h(async (req, res) => {
  const { password, code } = z.object({ password: z.string().max(200), code: z.string().max(10) }).parse(req.body);
  const u = req.user!;
  if (!(await verifyPassword(password, u.passwordHash))) throw new HttpError(400, "Password non corretta");
  if (!u.totpSecret || !verifyTotp(u.totpSecret, code)) throw new HttpError(400, "Codice non valido");
  await pool.query("UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1", [u.id]);
  await audit(req, "2fa_disattivata");
  res.json({ ok: true });
}));

r.post("/logout-all", requireStaff, h(async (req, res) => {
  await revokeSessions(req.user!.id);
  await audit(req, "logout_tutti_dispositivi");
  req.session.destroy(() => res.json({ ok: true }));
}));

export default r;
