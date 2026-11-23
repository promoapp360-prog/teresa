import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { one, q, pool } from "../db";
import { h, HttpError, zDay, zTime, zStr, id } from "../util";
import { getSettings, publicSettings } from "../settings";
import { slotsForDay } from "../availability";
import { romeToDate, todayRome, addDays, dateToRome } from "../time";
import { appointmentEmail, enqueueEmail } from "../mail";
import { randomToken } from "../crypto";
import { audit } from "../audit";

const r = Router();
const bookingLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Troppe richieste, riprova più tardi o contatta lo studio" } });

r.get("/site", h(async (_req, res) => {
  const s = await getSettings();
  const categories = await q("SELECT id, slug, name, subtitle, intro, body, icon FROM categories WHERE active ORDER BY sort, id");
  const services = await q(`SELECT id, category_id, slug, name, short_description, description, info_notes, duration_min,
      CASE WHEN show_price THEN price_cents END AS price_cents, bookable FROM services WHERE active ORDER BY sort, id`);
  res.set("Cache-Control", "no-cache").json({ settings: publicSettings(s), categories, services });
}));

/** Giorni con disponibilità e relativi orari, per la prestazione scelta. */
r.get("/availability", h(async (req, res) => {
  const s = await getSettings();
  if (!s.booking.enabled) return res.json({ days: [] });
  const svc = await one<any>("SELECT id, duration_min FROM services WHERE id = $1 AND active AND bookable", [id(req.query.serviceId)]);
  if (!svc) throw new HttpError(404, "Prestazione non prenotabile online");
  const from = typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : todayRome();
  const n = Math.min(31, Math.max(1, Number(req.query.days) || 14));
  const days: { day: string; slots: string[] }[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(from, i);
    days.push({ day, slots: await slotsForDay(day, svc.durationMin) });
  }
  res.json({ days, maxDay: addDays(todayRome(), s.booking.maxDaysAhead) });
}));

const bookingSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  day: zDay, time: zTime,
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160), phone: z.string().trim().min(6).max(40),
  birthDate: z.preprocess((v) => (v === "" ? null : v), zDay.nullable().optional()),
  notes: zStr(1000).optional(),
  privacy: z.literal(true, { errorMap: () => ({ message: "è necessario accettare l'informativa privacy" }) }),
  website: z.string().max(0).optional(), // campo trappola anti-spam
});

r.post("/bookings", bookingLimiter, h(async (req, res) => {
  const b = bookingSchema.parse(req.body);
  const s = await getSettings();
  if (!s.booking.enabled) throw new HttpError(400, "Le prenotazioni online sono momentaneamente sospese");
  const svc = await one<any>("SELECT * FROM services WHERE id = $1 AND active AND bookable", [b.serviceId]);
  if (!svc) throw new HttpError(404, "Prestazione non prenotabile online");

  const client = await pool.connect();
  let apptId = 0, token = "";
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(771102)"); // una prenotazione alla volta: niente doppie assegnazioni
    const slots = await slotsForDay(b.day, svc.durationMin);
    if (!slots.includes(b.time)) throw new HttpError(409, "L'orario scelto non è più disponibile, scegline un altro");

    // paziente esistente (stessa email e stesso telefono o nome) oppure nuovo
    const digits = b.phone.replace(/\D/g, "");
    let patient = (await client.query(
      `SELECT id FROM patients WHERE lower(email) = $1 AND (regexp_replace(coalesce(phone,''), '\\D', '', 'g') = $2 OR (lower(first_name) = lower($3) AND lower(last_name) = lower($4))) ORDER BY id LIMIT 1`,
      [b.email, digits, b.firstName, b.lastName])).rows[0];
    if (!patient) {
      patient = (await client.query(
        `INSERT INTO patients (first_name, last_name, email, phone, birth_date, privacy_accepted_at, source) VALUES ($1,$2,$3,$4,$5, now(), 'online') RETURNING id`,
        [b.firstName, b.lastName, b.email, b.phone, b.birthDate ?? null])).rows[0];
    } else {
      await client.query(`UPDATE patients SET privacy_accepted_at = now(), birth_date = coalesce(birth_date, $2), updated_at = now() WHERE id = $1`, [patient.id, b.birthDate ?? null]);
    }
    const starts = romeToDate(b.day, b.time);
    const ends = new Date(starts.getTime() + svc.durationMin * 60_000);
    token = randomToken(24);
    const status = s.booking.autoConfirm ? "confirmed" : "requested";
    apptId = (await client.query(
      `INSERT INTO appointments (patient_id, service_id, service_name, starts_at, ends_at, status, source, patient_notes, price_cents, manage_token, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,'online',$7,$8,$9, CASE WHEN $6 = 'confirmed' THEN now() END) RETURNING id`,
      [patient.id, svc.id, svc.name, starts, ends, status, b.notes ?? null, svc.priceCents, token])).rows[0].id;
    await appointmentEmail(status === "confirmed" ? "confirmed" : "requestReceived", apptId, client);
    const notify = s.booking.notifyEmail || s.studio.email;
    if (notify) {
      const [y, m, d] = b.day.split("-");
      await enqueueEmail(notify, `Nuova richiesta online: ${b.lastName} ${b.firstName} – ${d}/${m} ore ${b.time}`,
        `Nuova prenotazione online${status === "requested" ? " da confermare" : " (confermata automaticamente)"}.\n\nPaziente: ${b.firstName} ${b.lastName}\nPrestazione: ${svc.name}\nData: ${d}/${m}/${y} ore ${b.time}\nTelefono: ${b.phone}\nEmail: ${b.email}\n${b.notes ? `Note: ${b.notes}\n` : ""}\nGestisci dal pannello: ${process.env.PUBLIC_URL || ""}/admin/agenda`,
        "studioNotification", apptId, client);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await audit(req, "prenotazione_online", { entity: "appointment", entityId: apptId });
  res.json({ ok: true, token, status: s.booking.autoConfirm ? "confirmed" : "requested" });
}));

async function byToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError(404, "Prenotazione non trovata");
  const a = await one<any>(`SELECT a.id, a.service_name, a.starts_at, a.ends_at, a.status, p.first_name FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.manage_token = $1`, [token]);
  if (!a) throw new HttpError(404, "Prenotazione non trovata");
  return a;
}

r.get("/bookings/:token", h(async (req, res) => {
  const a = await byToken(req.params.token);
  const s = await getSettings();
  const canCancel = ["requested", "confirmed"].includes(a.status) && new Date(a.startsAt).getTime() - Date.now() > s.booking.cancelMinHours * 3600_000;
  const when = dateToRome(new Date(a.startsAt));
  res.json({ serviceName: a.serviceName, day: when.day, time: when.time, status: a.status, firstName: a.firstName, canCancel, cancelMinHours: s.booking.cancelMinHours });
}));

r.post("/bookings/:token/cancel", bookingLimiter, h(async (req, res) => {
  const a = await byToken(req.params.token);
  const s = await getSettings();
  if (!["requested", "confirmed"].includes(a.status)) throw new HttpError(400, "La prenotazione non è più attiva");
  if (new Date(a.startsAt).getTime() - Date.now() <= s.booking.cancelMinHours * 3600_000) {
    throw new HttpError(400, `L'annullamento online è possibile fino a ${s.booking.cancelMinHours} ore prima: contatta lo studio`);
  }
  await pool.query(`UPDATE appointments SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Annullato dal paziente online', updated_at = now() WHERE id = $1`, [a.id]);
  await appointmentEmail("cancelled", a.id);
  const notify = s.booking.notifyEmail || s.studio.email;
  if (notify) await enqueueEmail(notify, `Annullamento online: ${a.serviceName}`, `Un paziente ha annullato online l'appuntamento "${a.serviceName}" del ${dateToRome(new Date(a.startsAt)).day} ore ${dateToRome(new Date(a.startsAt)).time}.`, "studioNotification", a.id);
  await audit(req, "annullamento_online", { entity: "appointment", entityId: a.id });
  res.json({ ok: true });
}));

export default r;
