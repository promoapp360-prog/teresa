import nodemailer from "nodemailer";
import { one, q, pool } from "./db";
import { getSettings, type Settings } from "./settings";
import { esc } from "./util";
import { dateToRome } from "./time";

export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  if (!smtpConfigured()) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

function htmlFromText(text: string, s: Settings) {
  const body = esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#24524C">$1</a>').replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#F8F4EE;font-family:Arial,Helvetica,sans-serif;color:#16302D">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font-family:Georgia,serif;font-size:22px;color:#24524C;margin-bottom:18px">${esc(s.studio.name)}</div>
<div style="background:#fff;border-radius:14px;padding:24px;line-height:1.6;font-size:15px">${body}</div>
<div style="font-size:12px;color:#6b7c78;margin-top:16px">${esc(s.studio.address)}${s.studio.phone ? " · Tel. " + esc(s.studio.phone) : ""}<br>Messaggio automatico: per informazioni contatti direttamente lo studio.</div>
</div></body></html>`;
}

export async function enqueueEmail(to: string, subject: string, text: string, kind: string, appointmentId?: number | null, c: { query: any } = pool) {
  const s = await getSettings();
  await c.query(
    `INSERT INTO email_outbox (to_email, subject, html, text_body, kind, appointment_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [to, subject, htmlFromText(text, s), text, kind, appointmentId ?? null],
  );
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

export type ApptEmailKind = "requestReceived" | "confirmed" | "reminder" | "cancelled";

/** Accoda l'email al paziente per un appuntamento usando i modelli modificabili dal pannello. */
export async function appointmentEmail(kind: ApptEmailKind, appointmentId: number, c: { query: any } = pool) {
  const s = await getSettings();
  const a = await one<any>(
    `SELECT a.*, p.first_name, p.last_name, p.email FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = $1`, [appointmentId], c);
  if (!a?.email) return false;
  const when = dateToRome(new Date(a.startsAt));
  const [y, m, d] = when.day.split("-");
  const base = process.env.PUBLIC_URL || "";
  const vars = {
    nome: `${a.firstName} ${a.lastName}`, prestazione: a.serviceName, data: `${d}/${m}/${y}`, ora: when.time,
    studio: s.studio.name, indirizzo: [s.studio.address, s.studio.postalCode, s.studio.city].filter(Boolean).join(" "),
    link: a.manageToken ? `${base}/prenotazione/${a.manageToken}` : base || "",
  };
  const tpl = s.emails[kind];
  await enqueueEmail(a.email, fill(tpl.subject, vars), fill(tpl.body, vars), kind, appointmentId, c);
  return true;
}

/** Invia le email in coda (senza SMTP le segna come "simulate"). */
export async function processOutbox() {
  const rows = await q<any>(`SELECT * FROM email_outbox WHERE status = 'pending' AND send_after <= now() AND attempts < 5 ORDER BY id LIMIT 20`);
  const t = getTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "noreply@localhost";
  for (const m of rows) {
    if (!t) { await pool.query(`UPDATE email_outbox SET status = 'simulated', sent_at = now() WHERE id = $1`, [m.id]); continue; }
    try {
      await t.sendMail({ from, to: m.toEmail, subject: m.subject, html: m.html, text: m.textBody || undefined });
      await pool.query(`UPDATE email_outbox SET status = 'sent', sent_at = now(), attempts = attempts + 1 WHERE id = $1`, [m.id]);
    } catch (e) {
      const attempts = m.attempts + 1;
      await pool.query(
        `UPDATE email_outbox SET attempts = $2, last_error = $3, status = CASE WHEN $2 >= 5 THEN 'failed' ELSE 'pending' END, send_after = now() + ($2 * interval '5 minutes') WHERE id = $1`,
        [m.id, attempts, (e as Error).message.slice(0, 500)]);
    }
  }
}
