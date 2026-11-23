import React, { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Save, Printer, Trash2, X } from "lucide-react";
import { get, post, put, del } from "@/lib/api";
import { fmtDate, fmtDateTime, toLocalInput, fromLocalInput, fullName, todayRome } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, Field, PageTitle, useAction, useToast } from "@/components/ui";
import { CrudList } from "@/components/CrudList";
import { BodyMap, IntensityLegend } from "@/components/BodyMap";
import { BODY_REGIONS, PAIN_FREQUENCIES, PAIN_TYPES, TREATMENT_AREAS, regionLabel, intensityColor } from "@shared/constants";

type Pain = { region: string; view: "front" | "back"; side: string | null; intensity: number | null; painType: string; frequency: string; duration: string; radiation: string; worsening: string; relieving: string; notes: string };

const EMPTY_VISIT = { visitDate: new Date().toISOString(), area: "", reason: "", objectiveExam: "", assessment: "", clinicalNotes: "", indications: "", treatmentResponse: "", vas: null as number | null, nextCheckDate: "", appointmentId: null as number | null };

export default function VisitEditor({ patientId, visitId }: { patientId: number; visitId: number | null }) {
  const [, nav] = useLocation();
  const search = new URLSearchParams(useSearch());
  const toast = useToast();
  const patient = useLoad<any>(`admin/patients/${patientId}`);
  const existing = useLoad<any>(visitId ? `clinical/visits/${visitId}` : null, [visitId]);
  const [v, setV] = useState({ ...EMPTY_VISIT });
  const [pains, setPains] = useState<Pain[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { busy, run } = useAction();

  // nuova visita da appuntamento: data e ambito presi dall'appuntamento
  useEffect(() => {
    if (visitId || !patient.data) return;
    const apptId = Number(search.get("appuntamento")) || null;
    const a = apptId ? patient.data.appointments.find((x: any) => x.id === apptId) : null;
    if (a) {
      get<any>("admin/catalog").then((cat) => {
        const svc = cat.services.find((s: any) => s.name === a.serviceName);
        const area = cat.categories.find((c: any) => c.id === svc?.categoryId)?.name || "";
        setV((x) => ({ ...x, appointmentId: a.id, visitDate: a.startsAt, area, reason: x.reason || a.serviceName }));
      }).catch(() => setV((x) => ({ ...x, appointmentId: a.id, visitDate: a.startsAt })));
    }
  }, [patient.data, visitId]); // eslint-disable-line

  useEffect(() => {
    if (!existing.data) return;
    const e = existing.data.visit;
    setV({ visitDate: e.visitDate, area: e.area || "", reason: e.reason || "", objectiveExam: e.objectiveExam || "", assessment: e.assessment || "", clinicalNotes: e.clinicalNotes || "",
      indications: e.indications || "", treatmentResponse: e.treatmentResponse || "", vas: e.vas, nextCheckDate: e.nextCheckDate || "", appointmentId: e.appointmentId });
    setPains(existing.data.painAreas.map((p: any) => ({ ...p, painType: p.painType || "", frequency: p.frequency || "", duration: p.duration || "", radiation: p.radiation || "", worsening: p.worsening || "", relieving: p.relieving || "", notes: p.notes || "" })));
    setDirty(false);
  }, [existing.data]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (patient.loading || (visitId && existing.loading && !existing.data)) return <Spinner />;
  if (patient.error || existing.error) return <ErrorBox text={(patient.error || existing.error)!} />;
  const p = patient.data.patient;
  const set = (k: keyof typeof v, val: any) => { setV((x) => ({ ...x, [k]: val })); setDirty(true); };

  const toggleRegion = (id: string) => {
    setDirty(true);
    if (pains.some((x) => x.region === id)) { setSel(id); return; }
    const r = BODY_REGIONS.find((x) => x.id === id)!;
    setPains([...pains, { region: id, view: r.view, side: r.side, intensity: v.vas ?? 5, painType: "", frequency: "", duration: "", radiation: "", worsening: "", relieving: "", notes: "" }]);
    setSel(id);
  };
  const updPain = (id: string, k: keyof Pain, val: any) => { setPains(pains.map((x) => (x.region === id ? { ...x, [k]: val } : x))); setDirty(true); };
  const current = pains.find((x) => x.region === sel);

  const save = async (andPrint = false) => {
    const body = { ...v, visitDate: v.visitDate, nextCheckDate: v.nextCheckDate || null, painAreas: pains };
    const r = await run(() => (visitId ? put(`clinical/visits/${visitId}`, body) : post(`clinical/patients/${patientId}/visits`, body)), "Visita salvata");
    if (!r) return;
    setDirty(false);
    if (andPrint) window.open(`/api/clinical/visits/${(r as any).id}/pdf`, "_blank");
    if (!visitId) nav(`/pazienti/${patientId}/visite/${(r as any).id}`, { replace: true });
    else existing.reload();
  };

  const prev = existing.data?.previous;

  return (
    <>
      <div className="no-print mb-2 text-sm"><Link href={`/pazienti/${patientId}`} className="text-brand-deep hover:underline">← {fullName(p)}</Link></div>
      <PageTitle title={visitId ? "Visita" : "Nuova visita"} subtitle={`${fullName(p)}${visitId ? ` · ${fmtDateTime(v.visitDate)}` : ""}`}
        actions={<>
          {visitId && <a className="btn-outline" href={`/api/clinical/visits/${visitId}/pdf`} target="_blank" rel="noreferrer"><Printer size={16} /> Resoconto PDF</a>}
          {visitId && <button className="btn-ghost text-red-600" onClick={() => { if (confirm("Eliminare definitivamente la visita e i dati collegati (aree dolorose, farmaci e procedure della visita)?")) run(() => del(`clinical/visits/${visitId}`), "Visita eliminata").then((r) => r && nav(`/pazienti/${patientId}`)); }}><Trash2 size={16} /></button>}
          <button className="btn-primary" disabled={busy} onClick={() => save(false)}><Save size={16} /> Salva</button>
        </>} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data e ora"><input type="datetime-local" className="input" value={toLocalInput(v.visitDate)} onChange={(e) => e.target.value && set("visitDate", fromLocalInput(e.target.value))} /></Field>
            <Field label="Ambito"><select className="input" value={v.area} onChange={(e) => set("area", e.target.value)}><option value="">–</option>{TREATMENT_AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Prossimo controllo"><input type="date" className="input" value={v.nextCheckDate} min={todayRome()} onChange={(e) => set("nextCheckDate", e.target.value)} /></Field>
          </div>
          <Field label="Motivo dell'accesso"><textarea className="input" rows={2} value={v.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
          <Field label="Esame obiettivo"><textarea className="input" rows={3} value={v.objectiveExam} onChange={(e) => set("objectiveExam", e.target.value)} /></Field>
          <div>
            <span className="label">Dolore – scala VAS {v.vas != null ? <b className="ml-1 text-base" style={{ color: intensityColor(v.vas) }}>{v.vas}/10</b> : "(non rilevato)"}</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button key={i} type="button" onClick={() => set("vas", v.vas === i ? null : i)} className={`h-9 w-9 rounded-full text-sm font-bold transition ${v.vas === i ? "text-white ring-2 ring-brand-ink ring-offset-2" : "text-white/90 opacity-60 hover:opacity-100"}`} style={{ background: intensityColor(i) }}>{i}</button>
              ))}
            </div>
            {prev?.vas != null && <p className="mt-1 text-xs text-slate-500">Visita precedente ({fmtDate(prev.visitDate)}): VAS {prev.vas}/10</p>}
          </div>
          <Field label="Valutazione"><textarea className="input" rows={3} value={v.assessment} onChange={(e) => set("assessment", e.target.value)} /></Field>
          <Field label="Risposta ai trattamenti precedenti"><textarea className="input" rows={2} value={v.treatmentResponse} onChange={(e) => set("treatmentResponse", e.target.value)} /></Field>
          <Field label="Note cliniche"><textarea className="input" rows={2} value={v.clinicalNotes} onChange={(e) => set("clinicalNotes", e.target.value)} /></Field>
          <Field label="Indicazioni successive"><textarea className="input" rows={3} value={v.indications} onChange={(e) => set("indications", e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => save(false)}><Save size={16} /> Salva visita</button>
            <button className="btn-outline" disabled={busy} onClick={() => save(true)}><Printer size={16} /> Salva e stampa resoconto</button>
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl">Mappa del dolore</h2>
          <p className="text-xs text-slate-500">Tocca un'area per aggiungerla e descriverla. Lato destro/sinistro riferiti al paziente.</p>
          <div className="mt-3"><BodyMap marks={pains.map((x) => ({ region: x.region, intensity: x.intensity }))} onToggle={toggleRegion} selected={sel} /></div>
          <div className="mt-2 flex justify-center"><IntensityLegend /></div>
          <div className="mt-4 flex flex-wrap gap-1">
            {pains.map((x) => (
              <button key={x.region} onClick={() => setSel(x.region)} className={`badge gap-1 border ${sel === x.region ? "border-brand-ink" : "border-transparent"}`} style={{ background: intensityColor(x.intensity), color: "#fff" }}>
                {regionLabel(x.region)} {x.intensity ?? ""}
              </button>
            ))}
          </div>
          {current && (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between"><b>{regionLabel(current.region)}</b>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => { setPains(pains.filter((x) => x.region !== current.region)); setSel(null); setDirty(true); }}><X size={14} /> Rimuovi</button></div>
              <Field label={`Intensità: ${current.intensity ?? "–"}/10`}><input type="range" min={0} max={10} className="w-full accent-[#24524C]" value={current.intensity ?? 0} onChange={(e) => updPain(current.region, "intensity", Number(e.target.value))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo di dolore"><input className="input" list="pain-types" value={current.painType} onChange={(e) => updPain(current.region, "painType", e.target.value)} /></Field>
                <Field label="Frequenza"><input className="input" list="pain-freq" value={current.frequency} onChange={(e) => updPain(current.region, "frequency", e.target.value)} /></Field>
                <Field label="Durata (da quanto tempo)"><input className="input" value={current.duration} onChange={(e) => updPain(current.region, "duration", e.target.value)} /></Field>
                <Field label="Irradiazione"><input className="input" value={current.radiation} onChange={(e) => updPain(current.region, "radiation", e.target.value)} /></Field>
                <Field label="Fattori che peggiorano"><input className="input" value={current.worsening} onChange={(e) => updPain(current.region, "worsening", e.target.value)} /></Field>
                <Field label="Fattori che alleviano"><input className="input" value={current.relieving} onChange={(e) => updPain(current.region, "relieving", e.target.value)} /></Field>
              </div>
              <Field label="Note"><textarea className="input" rows={2} value={current.notes} onChange={(e) => updPain(current.region, "notes", e.target.value)} /></Field>
              {(() => { const old = prev?.painAreas.find((x: any) => x.region === current.region); return old ? <p className="text-xs text-slate-500">Visita precedente: intensità {old.intensity ?? "–"}/10{old.painType && `, ${old.painType}`}</p> : null; })()}
            </div>
          )}
          <datalist id="pain-types">{PAIN_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="pain-freq">{PAIN_FREQUENCIES.map((x) => <option key={x} value={x} />)}</datalist>
        </section>
      </div>

      {visitId && existing.data ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <CrudList title="Procedure della visita" rows={existing.data.procedures} createPath={`clinical/patients/${patientId}/procedures`} itemPath={(x) => `clinical/procedures/${x}`} onChange={existing.reload}
              addLabel="Procedura" defaults={{ visitId, procDate: (v.visitDate || "").slice(0, 10) }}
              fields={[{ key: "name", label: "Procedura", required: true }, { key: "site", label: "Sede anatomica" }, { key: "procDate", label: "Data", type: "date" },
                { key: "materials", label: "Materiali / prodotti (lotto, quantità)", type: "textarea" }, { key: "notes", label: "Osservazioni", type: "textarea" }]}
              columns={[{ key: "name", label: "Procedura", render: (r) => <b>{r.name}</b> }, { key: "site", label: "Sede" }, { key: "materials", label: "Materiali" }]} />
            <p className="mt-2 text-xs text-slate-500">Per collegare la procedura a un ciclo di trattamento usa la scheda “Cicli e procedure” del paziente.</p>
          </section>
          <section className="card">
            <CrudList title="Farmaci della visita" rows={existing.data.medications} createPath={`clinical/patients/${patientId}/medications`} itemPath={(x) => `clinical/medications/${x}`} onChange={existing.reload}
              addLabel="Farmaco" defaults={{ visitId, kind: "somministrato", medDate: (v.visitDate || "").slice(0, 10) }}
              fields={[{ key: "kind", label: "Tipo", type: "select", options: ["prescritto", "somministrato"], required: true }, { key: "drug", label: "Farmaco", required: true },
                { key: "dose", label: "Dose" }, { key: "route", label: "Via", list: ["orale", "endovenosa", "intramuscolare", "sottocutanea", "intrarticolare", "topica", "intradermica"] },
                { key: "frequency", label: "Frequenza" }, { key: "duration", label: "Durata" }, { key: "notes", label: "Note", type: "textarea" }]}
              columns={[{ key: "kind", label: "Tipo" }, { key: "drug", label: "Farmaco", render: (r) => <b>{r.drug}</b> }, { key: "dose", label: "Posologia", render: (r) => [r.dose, r.route, r.frequency].filter(Boolean).join(" · ") }]} />
          </section>
        </div>
      ) : <p className="mt-6 text-center text-sm text-slate-500">Dopo il primo salvataggio potrai aggiungere procedure e farmaci della visita.</p>}
      {dirty && <div className="no-print fixed bottom-4 right-4 z-40"><button className="btn-bronze shadow-lg" disabled={busy} onClick={() => save(false)}><Save size={16} /> Modifiche non salvate – Salva</button></div>}
    </>
  );
}
