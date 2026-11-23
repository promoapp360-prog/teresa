import PDFDocument from "pdfkit";
import { one, q } from "./db";
import { getSettings } from "./settings";
import { regionLabel } from "../shared/constants";
import { dateToRome } from "./time";

const itDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const day = typeof d === "string" ? d.slice(0, 10) : dateToRome(d).day;
  const [y, m, dd] = day.split("-");
  return `${dd}/${m}/${y}`;
};

/** Resoconto della visita in PDF (stampabile). */
export async function visitPdf(visitId: number): Promise<Buffer> {
  const s = await getSettings();
  const v = await one<any>("SELECT * FROM visits WHERE id = $1", [visitId]);
  if (!v) throw Object.assign(new Error("Visita non trovata"), { status: 404 });
  const p = await one<any>("SELECT * FROM patients WHERE id = $1", [v.patientId]);
  const pains = await q<any>("SELECT * FROM pain_areas WHERE visit_id = $1 ORDER BY intensity DESC NULLS LAST, id", [visitId]);
  const meds = await q<any>("SELECT * FROM medications WHERE visit_id = $1 ORDER BY id", [visitId]);
  const procs = await q<any>("SELECT * FROM procedures WHERE visit_id = $1 ORDER BY id", [visitId]);

  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Resoconto visita ${p.lastName} ${p.firstName}`, Author: s.studio.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const green = "#24524C", grey = "#5b6b68";
  doc.fillColor(green).font("Times-Bold").fontSize(18).text(s.studio.name);
  doc.font("Helvetica").fontSize(9).fillColor(grey)
    .text([s.studio.doctorName, s.studio.doctorTitle].filter(Boolean).join(" – "))
    .text([s.studio.address, s.studio.postalCode, s.studio.city].filter(Boolean).join(" "))
    .text([s.studio.phone && `Tel. ${s.studio.phone}`, s.studio.email].filter(Boolean).join(" · "));
  if (s.studio.registrationInfo) doc.text(s.studio.registrationInfo);
  doc.moveDown(0.6).strokeColor("#cfdcd8").moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.8);

  doc.fillColor("#16302D").font("Helvetica-Bold").fontSize(14).text("Resoconto della visita");
  doc.font("Helvetica").fontSize(10).moveDown(0.3)
    .text(`Paziente: ${p.lastName} ${p.firstName}${p.birthDate ? `   ·   Nato/a il ${itDate(p.birthDate)}` : ""}${p.taxCode ? `   ·   C.F. ${p.taxCode}` : ""}`)
    .text(`Data visita: ${itDate(v.visitDate)} ore ${dateToRome(new Date(v.visitDate)).time}${v.area ? `   ·   Ambito: ${v.area}` : ""}`);
  doc.moveDown(0.6);

  const section = (title: string, body?: string | null) => {
    if (!body) return;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(green).text(title.toUpperCase());
    doc.font("Helvetica").fontSize(10).fillColor("#16302D").text(body, { align: "left" }).moveDown(0.6);
  };

  section("Motivo dell'accesso", v.reason);
  section("Esame obiettivo", v.objectiveExam);
  if (v.vas != null) section("Dolore (scala VAS 0–10)", `${v.vas}/10`);
  if (pains.length) {
    section("Aree dolorose", pains.map((a) => {
      const bits = [a.intensity != null && `intensità ${a.intensity}/10`, a.painType, a.frequency, a.duration && `durata ${a.duration}`, a.radiation && `irradiazione: ${a.radiation}`,
        a.worsening && `peggiora con: ${a.worsening}`, a.relieving && `migliora con: ${a.relieving}`].filter(Boolean).join("; ");
      return `• ${regionLabel(a.region)}${bits ? ` – ${bits}` : ""}`;
    }).join("\n"));
  }
  section("Valutazione", v.assessment);
  if (procs.length) section("Procedure eseguite", procs.map((x) => `• ${x.name}${x.site ? ` – sede: ${x.site}` : ""}${x.materials ? ` – materiali/prodotti: ${x.materials}` : ""}${x.notes ? ` – ${x.notes}` : ""}`).join("\n"));
  if (meds.length) section("Farmaci", meds.map((m) => `• [${m.kind}] ${m.drug}${[m.dose, m.route, m.frequency, m.duration].filter(Boolean).length ? ` – ${[m.dose, m.route, m.frequency, m.duration].filter(Boolean).join(", ")}` : ""}${m.notes ? ` (${m.notes})` : ""}`).join("\n"));
  section("Risposta al trattamento", v.treatmentResponse);
  section("Indicazioni", v.indications);
  if (v.nextCheckDate) section("Prossimo controllo", itDate(v.nextCheckDate));

  doc.moveDown(2).font("Helvetica").fontSize(10).fillColor("#16302D").text(`Data ${itDate(new Date())}`, 50, doc.y, { continued: false });
  doc.text("Firma del medico", 360, doc.y - 12).moveDown(2.2);
  doc.strokeColor("#16302D").moveTo(360, doc.y).lineTo(545, doc.y).stroke();
  doc.fontSize(9).text(s.studio.doctorName, 360, doc.y + 4);

  doc.end();
  return done;
}

/** Modulo di consenso informato precompilato, da stampare e far firmare. */
export async function consentPdf(templateId: number, patientId?: number | null): Promise<Buffer> {
  const s = await getSettings();
  const t = await one<any>("SELECT * FROM consent_templates WHERE id = $1", [templateId]);
  if (!t) throw Object.assign(new Error("Modello non trovato"), { status: 404 });
  const p = patientId ? await one<any>("SELECT * FROM patients WHERE id = $1", [patientId]) : null;
  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: t.name, Author: s.studio.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  doc.fillColor("#24524C").font("Times-Bold").fontSize(16).text(s.studio.name);
  doc.font("Helvetica").fontSize(9).fillColor("#5b6b68").text([s.studio.address, s.studio.postalCode, s.studio.city].filter(Boolean).join(" ")).moveDown(1.2);
  doc.fillColor("#16302D").font("Helvetica-Bold").fontSize(13).text(t.name).font("Helvetica").fontSize(9).fillColor("#5b6b68").text(`Versione ${t.version}`).moveDown(0.8);
  doc.fillColor("#16302D").fontSize(10.5).text(`Paziente: ${p ? `${p.lastName} ${p.firstName}` : "______________________________"}    Nato/a il: ${p?.birthDate ? itDate(p.birthDate) : "____________"}`).moveDown(0.8);
  doc.fontSize(10.5).text(t.body, { align: "justify", lineGap: 2 }).moveDown(2);
  doc.text("Data ____________________").moveDown(2);
  doc.text("Firma del paziente ______________________________").moveDown(2);
  doc.text(`Firma del medico (${s.studio.doctorName}) ______________________________`);
  doc.end();
  return done;
}
