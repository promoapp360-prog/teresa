import { Router } from "express";
import { z } from "zod";
import { one, q, pool, insert, update } from "../db";
import { h, HttpError, id, zDay, zTime, zStr, zText, zOptDay, zOptInt, slugify, toCsv } from "../util";
import { requireStaff, hashPassword, publicUser, revokeSessions, type User } from "../auth";
import { getSettings, saveSettings } from "../settings";
import { freeIntervals, isFree } from "../availability";
import { romeToDate, dateToRome, todayRome, addDays, toMin, fromMin } from "../time";
import { appointmentEmail } from "../mail";
import { smtpConfigured } from "../mail";
import { encryptionReady, randomToken } from "../crypto";
import { audit } from "../audit";
import { CLOSURE_KINDS } from "../../shared/constants";

const r = Router();
r.use(requireStaff);

const doctorOnly = (req: any) => { if (req.user.role !== "doctor") throw new HttpError(403, "Operazione riservata al medico"); };

// ---------- cruscotto ----------
r.get("/dashboard", h(async (req, res) => {
  const today = todayRome();
  const start = romeToDate(today, "00:00"), end = romeToDate(addDays(today, 1), "00:00");
  const todayAppts = await q(`SELECT a.id, a.starts_at, a.ends_at, a.status, a.service_name, a.patient_id, p.first_name, p.last_name, p.phone
    FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.starts_at >= $1 AND a.starts_at < $2 AND a.status <> 'cancelled' ORDER BY a.starts_at`, [start, end]);
  const requests = await q(`SELECT a.id, a.starts_at, a.service_name, a.patient_id, a.patient_notes, a.created_at, p.first_name, p.last_name, p.phone, p.email
    FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.status = 'requested' AND a.starts_at > now() ORDER BY a.starts_at LIMIT 30`);
  const closures = await q(`SELECT * FROM closures WHERE end_day >= $1 AND start_day <= $2 ORDER BY start_day`, [today, addDays(today, 30)]);
  const week = await one<{ n: number }>(`SELECT count(*)::int AS n FROM appointments WHERE status IN ('requested','confirmed') AND starts_at >= now() AND starts_at < now() + interval '7 days'`);
  let checks: any[] = [];
  if (req.user!.role === "doctor") {
    checks = await q(`SELECT 'ciclo' AS kind, c.id, c.patient_id, c.name AS title, c.next_check_date AS due, p.first_name, p.last_name FROM treatment_cycles c JOIN patients p ON p.id = c.patient_id
        WHERE c.status = 'attivo' AND c.next_check_date IS NOT NULL AND c.next_check_date <= $1
      UNION ALL
      SELECT 'visita', v.id, v.patient_id, coalesce(v.area, 'Controllo'), v.next_check_date, p.first_name, p.last_name FROM visits v JOIN patients p ON p.id = v.patient_id
        WHERE v.next_check_date IS NOT NULL AND v.next_check_date BETWEEN $2 AND $1
          AND NOT EXISTS (SELECT 1 FROM visits v2 WHERE v2.patient_id = v.patient_id AND v2.visit_date > v.visit_date)
      ORDER BY due LIMIT 30`, [addDays(today, 14), addDays(today, -30)]);
  }
  const failed = await one<{ n: number }>(`SELECT count(*)::int AS n FROM email_outbox WHERE status = 'failed'`);
  const s = await getSettings();
  const warnings: string[] = [];
  if (!smtpConfigured()) warnings.push("Invio email non configurato: conferme e promemoria vengono solo registrati (vedi Impostazioni › Sistema).");
  if (!encryptionReady()) warnings.push("FILES_ENCRYPTION_KEY non impostata: il caricamento di referti è bloccato.");
  if (!req.user!.totpEnabled) warnings.push("Attiva l'autenticazione a due fattori dal tuo profilo per proteggere l'accesso.");
  if (!s.studio.phone || !s.studio.email || /da inserire/.test(s.studio.address)) warnings.push("Completa i dati dello studio (indirizzo, telefono, email) in Impostazioni.");
  if (failed?.n) warnings.push(`${failed.n} email non inviate: controlla la configurazione SMTP.`);
  res.json({ today, todayAppts, requests, closures, checks, weekCount: week?.n || 0, warnings });
}));

// ---------- appuntamenti ----------
r.get("/appointments", h(async (req, res) => {
  const from = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.from);
  const to = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.to);
  const rows = await q(`SELECT a.*, p.first_name, p.last_name, p.phone, p.email FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.starts_at >= $1 AND a.starts_at < $2 ${req.query.all ? "" : "AND a.status <> 'cancelled'"} ORDER BY a.starts_at`, [romeToDate(from, "00:00"), romeToDate(addDays(to, 1), "00:00")]);
  res.json(rows.map(({ manageToken, ...x }) => x));
}));

r.get("/slots", h(async (req, res) => {
  const day = zDay.parse(req.query.day);
  const duration = Math.max(5, Number(req.query.duration) || 30);
  const exclude = req.query.exclude ? id(req.query.exclude) : undefined;
  const step = (await getSettings()).booking.slotStepMin || 15;
  const out: string[] = [];
  for (const [st, en] of await freeIntervals(day, { excludeAppointmentId: exclude })) {
    for (let t = Math.ceil(st / step) * step; t + duration <= en; t += step) out.push(fromMin(t));
  }
  res.json({ slots: out });
}));

const apptCreate = z.object({
  patientId: z.coerce.number().int().positive(), serviceId: z.coerce.number().int().positive().nullable().optional(),
  serviceName: zStr(160).optional(), day: zDay, time: zTime, durationMin: z.coerce.number().int().min(5).max(480).optional(),
  status: z.enum(["requested", "confirmed"]).default("confirmed"), internalNotes: zText().optional(), sendEmail: z.boolean().default(true), force: z.boolean().default(false),
});

r.post("/appointments", h(async (req, res) => {
  const b = apptCreate.parse(req.body);
  const svc = b.serviceId ? await one<any>("SELECT * FROM services WHERE id = $1", [b.serviceId]) : null;
  const duration = b.durationMin || svc?.durationMin || 30;
  const name = svc?.name || b.serviceName;
  if (!name) throw new HttpError(400, "Indica la prestazione");
  if (!b.force && !(await isFree(b.day, b.time, duration))) {
    return res.status(409).json({ error: "L'orario si sovrappone a un altro appuntamento o è fuori dalle disponibilità", code: "CONFLICT" });
  }
  const starts = romeToDate(b.day, b.time);
  const a = await insert("appointments", {
    patientId: b.patientId, serviceId: svc?.id ?? null, serviceName: name, startsAt: starts, endsAt: new Date(starts.getTime() + duration * 60_000),
    status: b.status, source: "studio", internalNotes: b.internalNotes ?? null, priceCents: svc?.priceCents ?? null, manageToken: randomToken(24),
    confirmedAt: b.status === "confirmed" ? new Date() : null,
  }, ["patientId", "serviceId", "serviceName", "startsAt", "endsAt", "status", "source", "internalNotes", "priceCents", "manageToken", "confirmedAt"]);
  if (b.sendEmail && b.status === "confirmed") await appointmentEmail("confirmed", a.id);
  await audit(req, "appuntamento_creato", { entity: "appointment", entityId: a.id, patientId: b.patientId });
  res.json(a);
}));

const apptPatch = z.object({
  status: z.enum(["requested", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  day: zDay.optional(), time: zTime.optional(), durationMin: z.coerce.number().int().min(5).max(480).optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  internalNotes: zText().optional(), amountCents: zOptInt().optional(), cancelReason: zStr(255).optional(),
  notify: z.boolean().default(true), force: z.boolean().default(false),
});

r.patch("/appointments/:id", h(async (req, res) => {
  const apptId = id(req.params.id);
  const b = apptPatch.parse(req.body);
  const cur = await one<any>("SELECT * FROM appointments WHERE id = $1", [apptId]);
  if (!cur) throw new HttpError(404, "Appuntamento non trovato");
  const set: Record<string, any> = { updatedAt: new Date() };
  let moved = false;

  if (b.serviceId && b.serviceId !== cur.serviceId) {
    const svc = await one<any>("SELECT * FROM services WHERE id = $1", [b.serviceId]);
    if (!svc) throw new HttpError(404, "Prestazione non trovata");
    set.serviceId = svc.id; set.serviceName = svc.name; set.priceCents = svc.priceCents;
    if (!b.durationMin) b.durationMin = svc.durationMin;
  }
  if (b.day || b.time || b.durationMin) {
    const curRome = dateToRome(new Date(cur.startsAt));
    const day = b.day || curRome.day, time = b.time || curRome.time;
    const duration = b.durationMin || Math.round((new Date(cur.endsAt).getTime() - new Date(cur.startsAt).getTime()) / 60_000);
    if (!b.force && !(await isFree(day, time, duration, apptId))) {
      return res.status(409).json({ error: "Il nuovo orario si sovrappone a un altro appuntamento o è fuori dalle disponibilità", code: "CONFLICT" });
    }
    const starts = romeToDate(day, time);
    set.startsAt = starts; set.endsAt = new Date(starts.getTime() + duration * 60_000);
    moved = starts.getTime() !== new Date(cur.startsAt).getTime();
    if (moved) set.reminderSentAt = null;
  }
  if (b.internalNotes !== undefined) set.internalNotes = b.internalNotes;
  if (b.amountCents !== undefined) set.amountCents = b.amountCents;
  if (b.status && b.status !== cur.status) {
    set.status = b.status;
    if (b.status === "confirmed") set.confirmedAt = new Date();
    if (b.status === "cancelled") { set.cancelledAt = new Date(); set.cancelReason = b.cancelReason ?? "Annullato dallo studio"; }
  }
  const a = await update("appointments", set, ["updatedAt", "serviceId", "serviceName", "priceCents", "startsAt", "endsAt", "reminderSentAt", "internalNotes", "amountCents", "status", "confirmedAt", "cancelledAt", "cancelReason"], "id = $1", [apptId]);
  if (b.notify) {
    if (set.status === "cancelled") await appointmentEmail("cancelled", apptId);
    else if (set.status === "confirmed" || (moved && (a.status === "confirmed"))) await appointmentEmail("confirmed", apptId);
  }
  await audit(req, "appuntamento_modificato", { entity: "appointment", entityId: apptId, patientId: cur.patientId, detail: { status: set.status, spostato: moved || undefined } });
  res.json(a);
}));

// ---------- pazienti (anagrafica) ----------
const patientSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  birthDate: zOptDay.optional(), birthPlace: zStr(120).optional(), sex: z.preprocess((v) => (v === "" ? null : v), z.enum(["F", "M", "X"]).nullable()).optional(),
  taxCode: z.preprocess((v) => (v === "" || v == null ? null : String(v).toUpperCase().trim()), z.string().max(16).nullable()).optional(),
  phone: zStr(40).optional(), email: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim().toLowerCase()), z.string().email().max(160).nullable()).optional(),
  address: zStr(255).optional(), city: zStr(120).optional(), profession: zStr(120).optional(), notes: zText().optional(), archived: z.boolean().optional(),
});
const PATIENT_COLS = ["firstName", "lastName", "birthDate", "birthPlace", "sex", "taxCode", "phone", "email", "address", "city", "profession", "notes", "archived", "updatedAt", "privacyAcceptedAt"];

r.get("/patients", h(async (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const archived = req.query.archived === "true";
  const params: any[] = [archived];
  let where = "archived = $1";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (lower(first_name || ' ' || last_name) LIKE $2 OR lower(last_name || ' ' || first_name) LIKE $2 OR lower(coalesce(email,'')) LIKE $2 OR coalesce(phone,'') LIKE $2 OR lower(coalesce(tax_code,'')) LIKE $2)`;
  }
  const rows = await q(`SELECT p.id, p.first_name, p.last_name, p.birth_date, p.phone, p.email, p.city, p.source, p.created_at,
      (SELECT max(starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.status IN ('completed','confirmed') AND a.starts_at <= now()) AS last_visit,
      (SELECT min(starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.status IN ('requested','confirmed') AND a.starts_at > now()) AS next_appointment
    FROM patients p WHERE ${where} ORDER BY lower(last_name), lower(first_name) LIMIT 300`, params);
  res.json(rows);
}));

r.post("/patients", h(async (req, res) => {
  const b = patientSchema.parse(req.body);
  const p = await insert("patients", { ...b, source: "studio" }, [...PATIENT_COLS, "source"]);
  await audit(req, "paziente_creato", { entity: "patient", entityId: p.id, patientId: p.id });
  res.json(p);
}));

r.get("/patients/:id", h(async (req, res) => {
  const pid = id(req.params.id);
  const p = await one("SELECT * FROM patients WHERE id = $1", [pid]);
  if (!p) throw new HttpError(404, "Paziente non trovato");
  const appointments = await q("SELECT id, service_name, starts_at, ends_at, status, source, patient_notes, internal_notes, amount_cents FROM appointments WHERE patient_id = $1 ORDER BY starts_at DESC", [pid]);
  await audit(req, "anagrafica_consultata", { entity: "patient", entityId: pid, patientId: pid });
  res.json({ patient: p, appointments });
}));

r.patch("/patients/:id", h(async (req, res) => {
  const pid = id(req.params.id);
  const b = patientSchema.partial().parse(req.body);
  const p = await update("patients", { ...b, updatedAt: new Date() }, PATIENT_COLS, "id = $1", [pid]);
  if (!p) throw new HttpError(404, "Paziente non trovato");
  await audit(req, "anagrafica_modificata", { entity: "patient", entityId: pid, patientId: pid });
  res.json(p);
}));

r.get("/patients-export.csv", h(async (req, res) => {
  doctorOnly(req);
  const rows = await q(`SELECT id, last_name, first_name, birth_date, sex, tax_code, phone, email, address, city, created_at FROM patients ORDER BY last_name, first_name`);
  await audit(req, "export_anagrafiche", { detail: { righe: rows.length } });
  res.type("text/csv").attachment("pazienti.csv").send(toCsv(rows));
}));

// ---------- prestazioni e specializzazioni ----------
r.get("/catalog", h(async (_req, res) => {
  res.json({
    categories: await q("SELECT * FROM categories ORDER BY sort, id"),
    services: await q("SELECT s.*, (SELECT count(*)::int FROM appointments a WHERE a.service_id = s.id) AS uses FROM services s ORDER BY category_id, sort, id"),
  });
}));

const serviceSchema = z.object({
  categoryId: z.coerce.number().int().positive(), name: z.string().trim().min(2).max(160),
  shortDescription: zStr(300).optional(), description: zText().optional(), infoNotes: zText().optional(),
  durationMin: z.coerce.number().int().min(5).max(480), priceCents: zOptInt().optional(), showPrice: z.boolean().optional(),
  bookable: z.boolean().optional(), active: z.boolean().optional(), sort: z.coerce.number().int().optional(),
});
const SERVICE_COLS = ["categoryId", "name", "slug", "shortDescription", "description", "infoNotes", "durationMin", "priceCents", "showPrice", "bookable", "active", "sort", "updatedAt"];

r.post("/services", h(async (req, res) => {
  const b = serviceSchema.parse(req.body);
  let slug = slugify(b.name);
  if (await one("SELECT 1 FROM services WHERE slug = $1", [slug])) slug = `${slug}-${Date.now().toString(36)}`;
  res.json(await insert("services", { ...b, slug }, SERVICE_COLS));
}));
r.patch("/services/:id", h(async (req, res) => {
  const b = serviceSchema.partial().parse(req.body);
  const s = await update("services", { ...b, updatedAt: new Date() }, SERVICE_COLS.filter((c) => c !== "slug"), "id = $1", [id(req.params.id)]);
  if (!s) throw new HttpError(404, "Prestazione non trovata");
  res.json(s);
}));
r.delete("/services/:id", h(async (req, res) => {
  const sid = id(req.params.id);
  const used = await one<{ n: number }>("SELECT count(*)::int AS n FROM appointments WHERE service_id = $1", [sid]);
  if (used?.n) { await pool.query("UPDATE services SET active = false WHERE id = $1", [sid]); return res.json({ ok: true, deactivated: true }); }
  await pool.query("DELETE FROM services WHERE id = $1", [sid]);
  res.json({ ok: true });
}));

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120), subtitle: zStr(255).optional(), intro: zText().optional(), body: zText().optional(),
  icon: zStr(40).optional(), sort: z.coerce.number().int().optional(), active: z.boolean().optional(),
});
const CATEGORY_COLS = ["name", "slug", "subtitle", "intro", "body", "icon", "sort", "active"];
r.post("/categories", h(async (req, res) => {
  const b = categorySchema.parse(req.body);
  res.json(await insert("categories", { ...b, slug: slugify(b.name) }, CATEGORY_COLS));
}));
r.patch("/categories/:id", h(async (req, res) => {
  const b = categorySchema.partial().parse(req.body);
  const c = await update("categories", b, CATEGORY_COLS.filter((x) => x !== "slug"), "id = $1", [id(req.params.id)]);
  if (!c) throw new HttpError(404, "Specializzazione non trovata");
  res.json(c);
}));

// ---------- orari e chiusure ----------
r.get("/hours", h(async (_req, res) => {
  res.json({
    hours: await q("SELECT id, weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time FROM weekly_hours ORDER BY weekday, start_time"),
    closures: await q("SELECT id, kind, start_day, end_day, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time, note FROM closures WHERE end_day >= $1 ORDER BY start_day", [addDays(todayRome(), -60)]),
  });
}));

r.put("/hours", h(async (req, res) => {
  const list = z.array(z.object({ weekday: z.coerce.number().int().min(0).max(6), startTime: zTime, endTime: zTime })).max(50).parse(req.body.hours);
  for (const x of list) if (toMin(x.endTime) <= toMin(x.startTime)) throw new HttpError(400, "In ogni fascia l'ora di fine deve seguire quella di inizio");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM weekly_hours");
    for (const x of list) await c.query("INSERT INTO weekly_hours (weekday, start_time, end_time) VALUES ($1,$2,$3)", [x.weekday, x.startTime, x.endTime]);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  res.json({ ok: true });
}));

r.post("/closures", h(async (req, res) => {
  const b = z.object({
    kind: z.enum(CLOSURE_KINDS), startDay: zDay, endDay: zDay,
    startTime: z.preprocess((v) => (v === "" ? null : v), zTime.nullable()).optional(), endTime: z.preprocess((v) => (v === "" ? null : v), zTime.nullable()).optional(),
    note: zStr(255).optional(),
  }).parse(req.body);
  if (b.endDay < b.startDay) throw new HttpError(400, "La data di fine precede quella di inizio");
  if ((b.startTime && !b.endTime) || (!b.startTime && b.endTime) || (b.startTime && b.endTime && toMin(b.endTime) <= toMin(b.startTime))) throw new HttpError(400, "Indica entrambe le ore (o nessuna per l'intera giornata)");
  const c = await insert("closures", b, ["kind", "startDay", "endDay", "startTime", "endTime", "note"]);
  const affected = await q(`SELECT a.id, a.starts_at, p.first_name, p.last_name FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.status IN ('requested','confirmed') AND a.starts_at >= $1 AND a.starts_at < $2 ORDER BY a.starts_at`, [romeToDate(b.startDay, "00:00"), romeToDate(addDays(b.endDay, 1), "00:00")]);
  const clash = affected.filter((a: any) => {
    if (!b.startTime || !b.endTime) return true;
    const t = toMin(dateToRome(new Date(a.startsAt)).time);
    return t >= toMin(b.startTime) && t < toMin(b.endTime);
  });
  res.json({ closure: c, affected: clash });
}));
r.delete("/closures/:id", h(async (req, res) => {
  await pool.query("DELETE FROM closures WHERE id = $1", [id(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- impostazioni ----------
r.get("/settings", h(async (_req, res) => {
  res.json({ settings: await getSettings(), system: { smtp: smtpConfigured(), encryption: encryptionReady(), publicUrl: process.env.PUBLIC_URL || null, cron: !!process.env.CRON_SECRET } });
}));
r.put("/settings", h(async (req, res) => {
  const body = z.record(z.any()).parse(req.body);
  if (body.security && req.user!.role !== "doctor") delete body.security;
  const s = await saveSettings(body as any);
  await audit(req, "impostazioni_modificate", { detail: { sezioni: Object.keys(body) } });
  res.json({ settings: s });
}));

r.get("/emails", h(async (_req, res) => {
  res.json(await q("SELECT id, to_email, subject, kind, status, attempts, last_error, created_at, sent_at FROM email_outbox ORDER BY id DESC LIMIT 150"));
}));
r.post("/emails/:id/retry", h(async (req, res) => {
  await pool.query("UPDATE email_outbox SET status = 'pending', attempts = 0, send_after = now() WHERE id = $1 AND status IN ('failed','simulated')", [id(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- statistiche ----------
r.get("/stats", h(async (req, res) => {
  const from = zDay.parse(req.query.from), to = zDay.parse(req.query.to);
  const a = romeToDate(from, "00:00"), b = romeToDate(addDays(to, 1), "00:00");
  const byStatus = await q(`SELECT status, count(*)::int AS n FROM appointments WHERE starts_at >= $1 AND starts_at < $2 GROUP BY status`, [a, b]);
  const byService = await q(`SELECT service_name, count(*)::int AS n, coalesce(sum(amount_cents),0)::int AS amount FROM appointments
    WHERE starts_at >= $1 AND starts_at < $2 AND status IN ('confirmed','completed') GROUP BY service_name ORDER BY n DESC LIMIT 15`, [a, b]);
  const byCategory = await q(`SELECT coalesce(c.name, 'Altro') AS name, count(*)::int AS n FROM appointments ap LEFT JOIN services s ON s.id = ap.service_id LEFT JOIN categories c ON c.id = s.category_id
    WHERE ap.starts_at >= $1 AND ap.starts_at < $2 AND ap.status IN ('confirmed','completed') GROUP BY 1 ORDER BY n DESC`, [a, b]);
  const byMonth = await q(`SELECT to_char(starts_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM') AS month,
      count(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS done,
      count(*) FILTER (WHERE status IN ('cancelled','no_show'))::int AS lost,
      coalesce(sum(amount_cents) FILTER (WHERE status = 'completed'),0)::int AS amount
    FROM appointments WHERE starts_at >= $1 AND starts_at < $2 GROUP BY 1 ORDER BY 1`, [a, b]);
  const bySource = await q(`SELECT source, count(*)::int AS n FROM appointments WHERE starts_at >= $1 AND starts_at < $2 GROUP BY source`, [a, b]);
  const newPatients = await one<{ n: number }>(`SELECT count(*)::int AS n FROM patients WHERE created_at >= $1 AND created_at < $2`, [a, b]);
  const amount = await one<{ n: number }>(`SELECT coalesce(sum(amount_cents),0)::int AS n FROM appointments WHERE starts_at >= $1 AND starts_at < $2 AND status = 'completed'`, [a, b]);
  res.json({ byStatus, byService, byCategory, byMonth, bySource, newPatients: newPatients?.n || 0, amountCents: amount?.n || 0 });
}));

// ---------- utenti (solo medico) ----------
r.get("/users", h(async (req, res) => {
  doctorOnly(req);
  res.json((await q<User>("SELECT * FROM users ORDER BY id")).map(publicUser));
}));
r.post("/users", h(async (req, res) => {
  doctorOnly(req);
  const b = z.object({ username: z.string().trim().min(3).max(60).regex(/^[A-Za-z0-9._-]+$/, "solo lettere, numeri, punto e trattino"), fullName: zStr(120).optional(), email: zStr(160).optional(), role: z.enum(["doctor", "staff"]).default("staff") }).parse(req.body);
  const temp = randomToken(9);
  const u = await insert<User>("users", { ...b, passwordHash: await hashPassword(temp), mustChangePassword: true }, ["username", "fullName", "email", "role", "passwordHash", "mustChangePassword"]);
  await audit(req, "utente_creato", { entity: "user", entityId: u.id, detail: { username: u.username, role: u.role } });
  res.json({ user: publicUser(u), tempPassword: temp });
}));
r.patch("/users/:id", h(async (req, res) => {
  doctorOnly(req);
  const uid = id(req.params.id);
  const b = z.object({ fullName: zStr(120).optional(), email: zStr(160).optional(), role: z.enum(["doctor", "staff"]).optional(), active: z.boolean().optional(), resetPassword: z.boolean().optional(), reset2fa: z.boolean().optional() }).parse(req.body);
  if (uid === req.user!.id && (b.active === false || b.role === "staff")) throw new HttpError(400, "Non puoi disattivare o declassare il tuo stesso utente");
  const set: Record<string, any> = { fullName: b.fullName, email: b.email, role: b.role, active: b.active };
  let tempPassword: string | undefined;
  if (b.resetPassword) { const t = randomToken(9); tempPassword = t; set.passwordHash = await hashPassword(t); set.mustChangePassword = true; }
  if (b.reset2fa) { set.totpEnabled = false; set.totpSecret = null; }
  const u = await update<User>("users", set, ["fullName", "email", "role", "active", "passwordHash", "mustChangePassword", "totpEnabled", "totpSecret"], "id = $1", [uid]);
  if (!u) throw new HttpError(404, "Utente non trovato");
  if (b.active === false || b.resetPassword || b.reset2fa || b.role) await revokeSessions(uid);
  await audit(req, "utente_modificato", { entity: "user", entityId: uid, detail: { ...b } });
  res.json({ user: publicUser(u), tempPassword });
}));

// ---------- registro accessi (solo medico) ----------
r.get("/audit", h(async (req, res) => {
  doctorOnly(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const params: any[] = [];
  let where = "1=1";
  if (req.query.patientId) { params.push(id(req.query.patientId)); where += ` AND l.patient_id = $${params.length}`; }
  if (req.query.action) { params.push(String(req.query.action)); where += ` AND l.action = $${params.length}`; }
  params.push((page - 1) * 100);
  const rows = await q(`SELECT l.*, p.first_name, p.last_name FROM audit_log l LEFT JOIN patients p ON p.id = l.patient_id WHERE ${where} ORDER BY l.id DESC LIMIT 100 OFFSET $${params.length}`, params);
  res.json(rows);
}));

export default r;
