import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { one, q, pool, insert, update, tx } from "../db";
import { h, HttpError, id, zDay, zStr, zText, zOptDay, zOptInt, zOptNum } from "../util";
import { requireDoctor } from "../auth";
import { audit } from "../audit";
import { encrypt, decrypt, sha256 } from "../crypto";
import { visitPdf, consentPdf } from "../pdf";
import { BODY_REGIONS } from "../../shared/constants";

const r = Router();
r.use(requireDoctor);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const ALLOWED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/;

async function patientOr404(pid: number) {
  const p = await one("SELECT * FROM patients WHERE id = $1", [pid]);
  if (!p) throw new HttpError(404, "Paziente non trovato");
  return p;
}

async function storeFile(file: Express.Multer.File, userId: number, c: { query: any } = pool) {
  if (!ALLOWED_MIME.test(file.mimetype)) throw new HttpError(400, "Formato non ammesso (PDF, immagini, Word o testo)");
  const enc = encrypt(file.buffer);
  const { rows } = await c.query(
    `INSERT INTO files (original_name, mime, size, sha256, encrypted, iv, tag, data, created_by) VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8) RETURNING id`,
    [file.originalname.slice(0, 255), file.mimetype, file.size, sha256(file.buffer), enc.iv, enc.tag, enc.data, userId]);
  return rows[0].id as number;
}

async function sendFile(res: any, fileId: number, inline = true) {
  const f = await one<any>("SELECT * FROM files WHERE id = $1", [fileId]);
  if (!f) throw new HttpError(404, "File non trovato");
  const data = f.encrypted ? decrypt(f.data, f.iv, f.tag) : f.data;
  res.set("Cache-Control", "no-store");
  res.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`);
  res.type(f.mime).send(data);
}

// ---------- cartella completa ----------
r.get("/patients/:pid", h(async (req, res) => {
  const pid = id(req.params.pid);
  const patient = await patientOr404(pid);
  const [anamnesis, visits, pains, cycles, medications, procedures, labs, documents, consents] = await Promise.all([
    one("SELECT * FROM anamnesis WHERE patient_id = $1", [pid]),
    q("SELECT * FROM visits WHERE patient_id = $1 ORDER BY visit_date DESC", [pid]),
    q("SELECT pa.*, v.visit_date FROM pain_areas pa JOIN visits v ON v.id = pa.visit_id WHERE v.patient_id = $1 ORDER BY v.visit_date", [pid]),
    q("SELECT c.*, (SELECT count(*)::int FROM procedures p WHERE p.cycle_id = c.id) AS sessions_done FROM treatment_cycles c WHERE patient_id = $1 ORDER BY status, start_date DESC NULLS LAST", [pid]),
    q("SELECT * FROM medications WHERE patient_id = $1 ORDER BY med_date DESC NULLS LAST, id DESC", [pid]),
    q("SELECT * FROM procedures WHERE patient_id = $1 ORDER BY proc_date DESC NULLS LAST, id DESC", [pid]),
    q("SELECT * FROM lab_results WHERE patient_id = $1 ORDER BY test_name, test_date", [pid]),
    q("SELECT d.*, f.original_name, f.mime, f.size FROM documents d JOIN files f ON f.id = d.file_id WHERE d.patient_id = $1 ORDER BY doc_date DESC NULLS LAST, d.id DESC", [pid]),
    q("SELECT pc.id, pc.template_id, pc.template_name, pc.version, pc.signed_date, pc.file_id, pc.status, pc.revoked_at, pc.notes, pc.created_at FROM patient_consents pc WHERE patient_id = $1 ORDER BY signed_date DESC", [pid]),
  ]);
  await audit(req, "cartella_consultata", { entity: "patient", entityId: pid, patientId: pid });
  res.json({ patient, anamnesis: anamnesis || null, visits, pains, cycles, medications, procedures, labs, documents, consents });
}));

// ---------- anamnesi ----------
const ANAM = ["personal", "family", "pathologies", "surgeries", "allergies", "currentTherapies", "previousTreatments", "lifestyle", "notes"] as const;
r.put("/patients/:pid/anamnesis", h(async (req, res) => {
  const pid = id(req.params.pid);
  await patientOr404(pid);
  const b = z.object(Object.fromEntries(ANAM.map((k) => [k, zText().optional()]))).parse(req.body) as Record<string, string | null>;
  const cols = ["patient_id", "personal", "family", "pathologies", "surgeries", "allergies", "current_therapies", "previous_treatments", "lifestyle", "notes", "updated_by"];
  const vals = [pid, ...ANAM.map((k) => b[k] ?? null), req.user!.id];
  const row = await one(`INSERT INTO anamnesis (${cols.join(",")}, updated_at) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}, now())
    ON CONFLICT (patient_id) DO UPDATE SET ${cols.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(", ")}, updated_at = now() RETURNING *`, vals);
  await audit(req, "anamnesi_modificata", { entity: "anamnesis", entityId: pid, patientId: pid });
  res.json(row);
}));

// ---------- visite con aree dolorose ----------
const regionIds = new Set(BODY_REGIONS.map((x) => x.id));
const painSchema = z.object({
  region: z.string().refine((v) => regionIds.has(v), "area non valida"), view: z.enum(["front", "back"]), side: zStr(12).optional(),
  intensity: zOptInt(0, 10).optional(), painType: zStr(80).optional(), frequency: zStr(80).optional(), duration: zStr(80).optional(),
  radiation: zStr(255).optional(), worsening: zStr(255).optional(), relieving: zStr(255).optional(), notes: zText().optional(),
});
const visitSchema = z.object({
  visitDate: z.coerce.date(), appointmentId: zOptInt(1).optional(), area: zStr(80).optional(), reason: zText().optional(), objectiveExam: zText().optional(),
  assessment: zText().optional(), clinicalNotes: zText().optional(), indications: zText().optional(), treatmentResponse: zText().optional(),
  vas: zOptInt(0, 10).optional(), nextCheckDate: zOptDay.optional(), painAreas: z.array(painSchema).max(60).default([]),
});
const VISIT_COLS = ["patientId", "visitDate", "appointmentId", "area", "reason", "objectiveExam", "assessment", "clinicalNotes", "indications", "treatmentResponse", "vas", "nextCheckDate", "createdBy", "updatedAt"];
const PAIN_COLS = ["visitId", "region", "view", "side", "intensity", "painType", "frequency", "duration", "radiation", "worsening", "relieving", "notes"];

async function savePains(c: any, visitId: number, list: z.infer<typeof painSchema>[]) {
  await c.query("DELETE FROM pain_areas WHERE visit_id = $1", [visitId]);
  for (const p of list) await insert("pain_areas", { ...p, visitId }, PAIN_COLS, c);
}

r.post("/patients/:pid/visits", h(async (req, res) => {
  const pid = id(req.params.pid);
  await patientOr404(pid);
  const { painAreas, ...b } = visitSchema.parse(req.body);
  const v = await tx(async (c) => {
    const v = await insert("visits", { ...b, patientId: pid, createdBy: req.user!.id }, VISIT_COLS, c);
    await savePains(c, v.id, painAreas);
    if (b.appointmentId) await c.query("UPDATE appointments SET status = 'completed', updated_at = now() WHERE id = $1 AND patient_id = $2 AND status IN ('confirmed','requested')", [b.appointmentId, pid]);
    return v;
  });
  await audit(req, "visita_creata", { entity: "visit", entityId: v.id, patientId: pid });
  res.json(v);
}));

r.get("/visits/:id", h(async (req, res) => {
  const vid = id(req.params.id);
  const v = await one<any>("SELECT * FROM visits WHERE id = $1", [vid]);
  if (!v) throw new HttpError(404, "Visita non trovata");
  const [painAreas, medications, procedures, documents, previous] = await Promise.all([
    q("SELECT * FROM pain_areas WHERE visit_id = $1 ORDER BY id", [vid]),
    q("SELECT * FROM medications WHERE visit_id = $1 ORDER BY id", [vid]),
    q("SELECT * FROM procedures WHERE visit_id = $1 ORDER BY id", [vid]),
    q("SELECT d.*, f.original_name, f.mime FROM documents d JOIN files f ON f.id = d.file_id WHERE d.visit_id = $1", [vid]),
    one<any>("SELECT id, visit_date, vas FROM visits WHERE patient_id = $1 AND visit_date < $2 ORDER BY visit_date DESC LIMIT 1", [v.patientId, v.visitDate]),
  ]);
  const previousPains = previous ? await q("SELECT * FROM pain_areas WHERE visit_id = $1", [previous.id]) : [];
  await audit(req, "visita_consultata", { entity: "visit", entityId: vid, patientId: v.patientId });
  res.json({ visit: v, painAreas, medications, procedures, documents, previous: previous ? { ...previous, painAreas: previousPains } : null });
}));

r.put("/visits/:id", h(async (req, res) => {
  const vid = id(req.params.id);
  const cur = await one<any>("SELECT * FROM visits WHERE id = $1", [vid]);
  if (!cur) throw new HttpError(404, "Visita non trovata");
  const { painAreas, ...b } = visitSchema.parse(req.body);
  const v = await tx(async (c) => {
    const v = await update("visits", { ...b, updatedAt: new Date() }, VISIT_COLS.filter((x) => x !== "patientId" && x !== "createdBy"), "id = $1", [vid], c);
    await savePains(c, vid, painAreas);
    return v;
  });
  await audit(req, "visita_modificata", { entity: "visit", entityId: vid, patientId: cur.patientId });
  res.json(v);
}));

r.delete("/visits/:id", h(async (req, res) => {
  const vid = id(req.params.id);
  const cur = await one<any>("SELECT * FROM visits WHERE id = $1", [vid]);
  if (!cur) throw new HttpError(404, "Visita non trovata");
  await pool.query("DELETE FROM visits WHERE id = $1", [vid]);
  await audit(req, "visita_eliminata", { entity: "visit", entityId: vid, patientId: cur.patientId, detail: { data: cur.visitDate } });
  res.json({ ok: true });
}));

r.get("/visits/:id/pdf", h(async (req, res) => {
  const vid = id(req.params.id);
  const v = await one<any>("SELECT patient_id FROM visits WHERE id = $1", [vid]);
  if (!v) throw new HttpError(404, "Visita non trovata");
  const pdf = await visitPdf(vid);
  await audit(req, "resoconto_pdf", { entity: "visit", entityId: vid, patientId: v.patientId });
  res.set("Cache-Control", "no-store").set("Content-Disposition", `inline; filename="resoconto-visita-${vid}.pdf"`).type("application/pdf").send(pdf);
}));

// ---------- tabelle collegate al paziente (farmaci, procedure, cicli, esami) ----------
type ChildDef = { table: string; label: string; schema: z.ZodObject<any>; cols: string[] };
const CHILDREN: Record<string, ChildDef> = {
  medications: {
    table: "medications", label: "farmaco",
    schema: z.object({ visitId: zOptInt(1).optional(), kind: z.enum(["prescritto", "somministrato"]), medDate: zOptDay.optional(), drug: z.string().trim().min(1).max(160),
      dose: zStr(80).optional(), route: zStr(80).optional(), frequency: zStr(80).optional(), duration: zStr(80).optional(), notes: zText().optional() }),
    cols: ["visitId", "kind", "medDate", "drug", "dose", "route", "frequency", "duration", "notes"],
  },
  procedures: {
    table: "procedures", label: "procedura",
    schema: z.object({ visitId: zOptInt(1).optional(), cycleId: zOptInt(1).optional(), procDate: zOptDay.optional(), name: z.string().trim().min(1).max(160),
      site: zStr(160).optional(), materials: zText().optional(), notes: zText().optional() }),
    cols: ["visitId", "cycleId", "procDate", "name", "site", "materials", "notes"],
  },
  cycles: {
    table: "treatment_cycles", label: "ciclo",
    schema: z.object({ area: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), startDate: zOptDay.optional(), endDate: zOptDay.optional(),
      plannedSessions: zOptInt(1, 500).optional(), status: z.enum(["attivo", "concluso", "sospeso"]).default("attivo"), nextCheckDate: zOptDay.optional(),
      response: zText().optional(), notes: zText().optional() }),
    cols: ["area", "name", "startDate", "endDate", "plannedSessions", "status", "nextCheckDate", "response", "notes"],
  },
  labs: {
    table: "lab_results", label: "esame",
    schema: z.object({ testDate: zDay, testName: z.string().trim().min(1).max(120), value: zOptNum.optional(), valueText: zStr(80).optional(), unit: zStr(40).optional(),
      refMin: zOptNum.optional(), refMax: zOptNum.optional(), refText: zStr(120).optional(), notes: zText().optional() }),
    cols: ["testDate", "testName", "value", "valueText", "unit", "refMin", "refMax", "refText", "notes"],
  },
};

for (const [key, def] of Object.entries(CHILDREN)) {
  r.post(`/patients/:pid/${key}`, h(async (req, res) => {
    const pid = id(req.params.pid);
    await patientOr404(pid);
    const raw = Array.isArray(req.body) ? req.body : [req.body];
    const rows = raw.map((x) => def.schema.parse(x));
    const out = await tx(async (c) => {
      const list: any[] = [];
      for (const b of rows) {
        if (b.visitId && !(await c.query("SELECT 1 FROM visits WHERE id = $1 AND patient_id = $2", [b.visitId, pid])).rowCount) throw new HttpError(400, "Visita non valida");
        if (b.cycleId && !(await c.query("SELECT 1 FROM treatment_cycles WHERE id = $1 AND patient_id = $2", [b.cycleId, pid])).rowCount) throw new HttpError(400, "Ciclo non valido");
        list.push(await insert(def.table, { ...b, patientId: pid }, ["patientId", ...def.cols], c));
      }
      return list;
    });
    await audit(req, `${def.label}_inserito`, { entity: def.table, entityId: out[0]?.id, patientId: pid, detail: { righe: out.length } });
    res.json(Array.isArray(req.body) ? out : out[0]);
  }));

  r.patch(`/${key}/:id`, h(async (req, res) => {
    const rid = id(req.params.id);
    const cur = await one<any>(`SELECT * FROM ${def.table} WHERE id = $1`, [rid]);
    if (!cur) throw new HttpError(404, "Voce non trovata");
    const b = def.schema.partial().parse(req.body);
    const extra = def.table === "treatment_cycles" ? { updatedAt: new Date() } : {};
    const row = await update(def.table, { ...b, ...extra }, [...def.cols, "updatedAt"].filter((c) => c !== "updatedAt" || def.table === "treatment_cycles"), "id = $1", [rid]);
    await audit(req, `${def.label}_modificato`, { entity: def.table, entityId: rid, patientId: cur.patientId });
    res.json(row);
  }));

  r.delete(`/${key}/:id`, h(async (req, res) => {
    const rid = id(req.params.id);
    const cur = await one<any>(`SELECT * FROM ${def.table} WHERE id = $1`, [rid]);
    if (!cur) throw new HttpError(404, "Voce non trovata");
    await pool.query(`DELETE FROM ${def.table} WHERE id = $1`, [rid]);
    await audit(req, `${def.label}_eliminato`, { entity: def.table, entityId: rid, patientId: cur.patientId });
    res.json({ ok: true });
  }));
}

// ---------- referti e documenti (cifrati) ----------
r.post("/patients/:pid/documents", upload.single("file"), h(async (req, res) => {
  const pid = id(req.params.pid);
  await patientOr404(pid);
  if (!req.file) throw new HttpError(400, "Seleziona un file");
  const b = z.object({ kind: z.enum(["referto", "immagine", "esame", "lettera", "altro"]).default("referto"), title: z.string().trim().min(1).max(200),
    docDate: zOptDay.optional(), notes: zText().optional(), visitId: zOptInt(1).optional() }).parse(req.body);
  const d = await tx(async (c) => {
    const fileId = await storeFile(req.file!, req.user!.id, c);
    return insert("documents", { ...b, patientId: pid, fileId }, ["patientId", "visitId", "kind", "title", "docDate", "fileId", "notes"], c);
  });
  await audit(req, "documento_caricato", { entity: "document", entityId: d.id, patientId: pid, detail: { titolo: b.title } });
  res.json(d);
}));

r.get("/documents/:id/file", h(async (req, res) => {
  const d = await one<any>("SELECT * FROM documents WHERE id = $1", [id(req.params.id)]);
  if (!d) throw new HttpError(404, "Documento non trovato");
  await audit(req, "documento_aperto", { entity: "document", entityId: d.id, patientId: d.patientId });
  await sendFile(res, d.fileId, req.query.download !== "1");
}));

r.delete("/documents/:id", h(async (req, res) => {
  const d = await one<any>("SELECT * FROM documents WHERE id = $1", [id(req.params.id)]);
  if (!d) throw new HttpError(404, "Documento non trovato");
  await tx(async (c) => {
    await c.query("DELETE FROM documents WHERE id = $1", [d.id]);
    await c.query("DELETE FROM files WHERE id = $1", [d.fileId]);
  });
  await audit(req, "documento_eliminato", { entity: "document", entityId: d.id, patientId: d.patientId, detail: { titolo: d.title } });
  res.json({ ok: true });
}));

// ---------- consensi informati ----------
r.get("/consent-templates", h(async (_req, res) => {
  res.json(await q("SELECT t.*, (SELECT count(*)::int FROM patient_consents pc WHERE pc.template_id = t.id) AS uses FROM consent_templates t ORDER BY active DESC, name, version"));
}));

const tplSchema = z.object({ name: z.string().trim().min(2).max(160), area: zStr(80).optional(), version: z.string().trim().min(1).max(20), body: z.string().min(10).max(50000), active: z.boolean().optional() });
r.post("/consent-templates", h(async (req, res) => {
  const t = await insert("consent_templates", tplSchema.parse(req.body), ["name", "area", "version", "body", "active"]);
  await audit(req, "modello_consenso_creato", { entity: "consent_template", entityId: t.id, detail: { nome: t.name, versione: t.version } });
  res.json(t);
}));
r.patch("/consent-templates/:id", h(async (req, res) => {
  const tid = id(req.params.id);
  const b = tplSchema.partial().parse(req.body);
  const used = await one<{ n: number }>("SELECT count(*)::int AS n FROM patient_consents WHERE template_id = $1", [tid]);
  // un modello già firmato non si modifica nel testo: si crea una nuova versione
  if (used?.n && (b.body !== undefined || b.version !== undefined || b.name !== undefined)) throw new HttpError(400, "Modello già utilizzato: crea una nuova versione invece di modificarne il testo");
  const t = await update("consent_templates", b, ["name", "area", "version", "body", "active"], "id = $1", [tid]);
  if (!t) throw new HttpError(404, "Modello non trovato");
  res.json(t);
}));
r.get("/consent-templates/:id/pdf", h(async (req, res) => {
  const pid = req.query.patientId ? id(req.query.patientId) : null;
  const pdf = await consentPdf(id(req.params.id), pid);
  if (pid) await audit(req, "consenso_stampato", { entity: "consent_template", entityId: Number(req.params.id), patientId: pid });
  res.set("Cache-Control", "no-store").set("Content-Disposition", `inline; filename="consenso.pdf"`).type("application/pdf").send(pdf);
}));

r.post("/patients/:pid/consents", upload.single("file"), h(async (req, res) => {
  const pid = id(req.params.pid);
  await patientOr404(pid);
  const b = z.object({ templateId: z.coerce.number().int().positive(), signedDate: zDay, notes: zText().optional() }).parse(req.body);
  const t = await one<any>("SELECT * FROM consent_templates WHERE id = $1", [b.templateId]);
  if (!t) throw new HttpError(404, "Modello non trovato");
  const pc = await tx(async (c) => {
    const fileId = req.file ? await storeFile(req.file, req.user!.id, c) : null;
    return insert("patient_consents", { patientId: pid, templateId: t.id, templateName: t.name, version: t.version, bodySnapshot: t.body, signedDate: b.signedDate, fileId, notes: b.notes ?? null },
      ["patientId", "templateId", "templateName", "version", "bodySnapshot", "signedDate", "fileId", "notes"], c);
  });
  await audit(req, "consenso_registrato", { entity: "patient_consent", entityId: pc.id, patientId: pid, detail: { modello: t.name, versione: t.version } });
  res.json(pc);
}));

r.post("/consents/:id/file", upload.single("file"), h(async (req, res) => {
  const pc = await one<any>("SELECT * FROM patient_consents WHERE id = $1", [id(req.params.id)]);
  if (!pc) throw new HttpError(404, "Consenso non trovato");
  if (!req.file) throw new HttpError(400, "Seleziona un file");
  const fileId = await tx(async (c) => {
    const fid = await storeFile(req.file!, req.user!.id, c);
    await c.query("UPDATE patient_consents SET file_id = $2 WHERE id = $1", [pc.id, fid]);
    if (pc.fileId) await c.query("DELETE FROM files WHERE id = $1", [pc.fileId]);
    return fid;
  });
  await audit(req, "consenso_allegato", { entity: "patient_consent", entityId: pc.id, patientId: pc.patientId });
  res.json({ ok: true, fileId });
}));

r.post("/consents/:id/revoke", h(async (req, res) => {
  const pc = await one<any>("SELECT * FROM patient_consents WHERE id = $1", [id(req.params.id)]);
  if (!pc) throw new HttpError(404, "Consenso non trovato");
  const { date, notes } = z.object({ date: zDay, notes: zText().optional() }).parse(req.body);
  await pool.query("UPDATE patient_consents SET status = 'revocato', revoked_at = $2, notes = coalesce($3, notes) WHERE id = $1", [pc.id, date, notes ?? null]);
  await audit(req, "consenso_revocato", { entity: "patient_consent", entityId: pc.id, patientId: pc.patientId });
  res.json({ ok: true });
}));

r.get("/consents/:id", h(async (req, res) => {
  const pc = await one<any>("SELECT * FROM patient_consents WHERE id = $1", [id(req.params.id)]);
  if (!pc) throw new HttpError(404, "Consenso non trovato");
  res.json(pc);
}));

r.get("/consents/:id/file", h(async (req, res) => {
  const pc = await one<any>("SELECT * FROM patient_consents WHERE id = $1", [id(req.params.id)]);
  if (!pc?.fileId) throw new HttpError(404, "Nessun documento firmato allegato");
  await audit(req, "consenso_aperto", { entity: "patient_consent", entityId: pc.id, patientId: pc.patientId });
  await sendFile(res, pc.fileId);
}));

export default r;
