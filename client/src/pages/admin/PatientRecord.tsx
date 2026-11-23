import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Pencil, Plus, FileText, Upload, Printer, AlertTriangle, CalendarPlus, Archive, Trash2, Download, Ban, Stethoscope } from "lucide-react";
import { put, upload, post, del, patch } from "@/lib/api";
import { fmtDate, fmtDateTime, fullName, age, todayRome } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLoad, Spinner, ErrorBox, Empty, StatusBadge, Tabs, Field, PageTitle, useAction, Modal, RichText } from "@/components/ui";
import { CrudList, type FieldDef } from "@/components/CrudList";
import { BodyMap, IntensityLegend } from "@/components/BodyMap";
import { LineChart } from "@/components/LineChart";
import { PatientForm } from "./Patients";
import { NewAppointmentModal } from "./Agenda";
import { DOC_KINDS, TREATMENT_AREAS, regionLabel, intensityColor } from "@shared/constants";

export default function PatientRecord({ id }: { id: number }) {
  const { me } = useAuth();
  const isDoctor = me?.role === "doctor";
  const base = useLoad<any>(`admin/patients/${id}`);
  const clin = useLoad<any>(isDoctor ? `clinical/patients/${id}` : null);
  const [tab, setTab] = useState(isDoctor ? "panoramica" : "anagrafica");
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const { run } = useAction();

  if (base.loading && !base.data) return <Spinner />;
  if (base.error) return <ErrorBox text={base.error} />;
  const p = base.data.patient;
  const c = clin.data;
  const reloadAll = () => { base.reload(); clin.reload(); };

  const tabs = [
    ...(isDoctor ? [{ id: "panoramica", label: "Panoramica" }] : []),
    { id: "anagrafica", label: "Anagrafica e appuntamenti", count: base.data.appointments.length },
    ...(isDoctor && c ? [
      { id: "anamnesi", label: "Anamnesi" },
      { id: "diario", label: "Diario clinico", count: c.visits.length },
      { id: "dolore", label: "Dolore" },
      { id: "terapie", label: "Farmaci", count: c.medications.length },
      { id: "cicli", label: "Cicli e procedure", count: c.cycles.length },
      { id: "esami", label: "Esami", count: new Set(c.labs.map((l: any) => l.testName)).size },
      { id: "documenti", label: "Referti e documenti", count: c.documents.length },
      { id: "consensi", label: "Consensi", count: c.consents.length },
      { id: "accessi", label: "Registro accessi" },
    ] : []),
  ];

  return (
    <>
      <div className="no-print mb-2 text-sm"><Link href="/pazienti" className="text-brand-deep hover:underline">← Pazienti</Link></div>
      <PageTitle title={fullName(p)}
        subtitle={[p.birthDate && `${age(p.birthDate)} anni (${fmtDate(p.birthDate)})`, p.taxCode, p.phone, p.email].filter(Boolean).join(" · ")}
        actions={<>
          <button className="btn-outline" onClick={() => setBooking(true)}><CalendarPlus size={16} /> Appuntamento</button>
          {isDoctor && <Link href={`/pazienti/${id}/visite/nuova`} className="btn-primary"><Stethoscope size={16} /> Nuova visita</Link>}
        </>} />
      {p.archived && <div className="mb-4 rounded-xl bg-slate-100 px-4 py-2 text-sm">Paziente archiviato.</div>}
      {isDoctor && c?.anamnesis?.allergies && !/nessun/i.test(c.anamnesis.allergies) && (
        <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> <b>Allergie:</b> {c.anamnesis.allergies}</div>
      )}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-5">
        {clin.error && isDoctor && <ErrorBox text={clin.error} />}
        {isDoctor && !c && tab !== "anagrafica" && !clin.error && <Spinner />}

        {tab === "anagrafica" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section className="card">
              <div className="flex items-center justify-between"><h2 className="text-2xl">Anagrafica</h2><button className="btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil size={14} /> Modifica</button></div>
              <dl className="mt-3 grid grid-cols-[130px_1fr] gap-y-1.5 text-sm">
                {[["Nato/a", [fmtDate(p.birthDate), p.birthPlace].filter(Boolean).join(" a ")], ["Sesso", p.sex], ["Codice fiscale", p.taxCode], ["Telefono", p.phone], ["Email", p.email],
                  ["Indirizzo", [p.address, p.city].filter(Boolean).join(", ")], ["Professione", p.profession], ["Privacy", p.privacyAcceptedAt ? `accettata il ${fmtDate(p.privacyAcceptedAt)}` : "–"], ["Origine", p.source === "online" ? "Prenotazione online" : "Inserito dallo studio"]]
                  .map(([k, v]) => <React.Fragment key={k}><dt className="text-slate-500">{k}</dt><dd>{v || "–"}</dd></React.Fragment>)}
              </dl>
              {p.notes && <p className="mt-3 rounded-xl bg-brand-cream p-3 text-sm">{p.notes}</p>}
              <button className="btn-ghost btn-sm mt-3" onClick={() => run(() => patch(`admin/patients/${id}`, { archived: !p.archived }), p.archived ? "Paziente ripristinato" : "Paziente archiviato").then(base.reload)}><Archive size={14} /> {p.archived ? "Ripristina" : "Archivia"}</button>
            </section>
            <section className="card">
              <h2 className="text-2xl">Storico prenotazioni</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {!base.data.appointments.length && <Empty>Nessuna prenotazione.</Empty>}
                {base.data.appointments.map((a: any) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <div className="w-32 font-semibold">{fmtDateTime(a.startsAt)}</div>
                    <div className="min-w-0 flex-1">{a.serviceName}{a.internalNotes && <div className="text-xs text-slate-500">{a.internalNotes}</div>}</div>
                    <StatusBadge status={a.status} />
                    {isDoctor && ["confirmed", "requested"].includes(a.status) && <Link href={`/pazienti/${id}/visite/nuova?appuntamento=${a.id}`} className="btn-ghost btn-sm">Registra visita</Link>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {isDoctor && c && tab === "panoramica" && <Overview c={c} go={setTab} />}
        {isDoctor && c && tab === "anamnesi" && <Anamnesis pid={id} data={c.anamnesis} onSaved={clin.reload} />}
        {isDoctor && c && tab === "diario" && <Diary pid={id} c={c} />}
        {isDoctor && c && tab === "dolore" && <PainTab c={c} />}
        {isDoctor && c && tab === "terapie" && (
          <CrudList rows={c.medications} createPath={`clinical/patients/${id}/medications`} itemPath={(x) => `clinical/medications/${x}`} onChange={clin.reload}
            addLabel="Registra farmaco" defaults={{ kind: "prescritto", medDate: todayRome() }} fields={MED_FIELDS(c.visits)} emptyText="Nessun farmaco registrato."
            columns={[
              { key: "medDate", label: "Data", render: (r) => fmtDate(r.medDate) },
              { key: "kind", label: "Tipo", render: (r) => <span className={`badge ${r.kind === "somministrato" ? "bg-sky-100 text-sky-800" : "bg-brand-mist text-brand-deep"}`}>{r.kind}</span> },
              { key: "drug", label: "Farmaco", render: (r) => <b>{r.drug}</b> },
              { key: "dose", label: "Posologia", render: (r) => [r.dose, r.route, r.frequency, r.duration].filter(Boolean).join(" · ") },
              { key: "notes", label: "Note" },
            ]} />
        )}
        {isDoctor && c && tab === "cicli" && <Cycles pid={id} c={c} reload={clin.reload} />}
        {isDoctor && c && tab === "esami" && <Labs pid={id} c={c} reload={clin.reload} />}
        {isDoctor && c && tab === "documenti" && <Documents pid={id} c={c} reload={clin.reload} />}
        {isDoctor && c && tab === "consensi" && <Consents pid={id} c={c} reload={clin.reload} />}
        {isDoctor && tab === "accessi" && <PatientAudit pid={id} />}
      </div>
      {editing && <PatientForm patient={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reloadAll(); }} />}
      {booking && <NewAppointmentModal patient={p} initial={{ day: todayRome() }} onClose={() => setBooking(false)} onCreated={() => { setBooking(false); base.reload(); }} />}
    </>
  );
}

const visitOptions = (visits: any[]) => visits.map((v) => ({ value: v.id, label: `Visita del ${fmtDate(v.visitDate)}` }));
const MED_FIELDS = (visits: any[]): FieldDef[] => [
  { key: "kind", label: "Tipo", type: "select", options: ["prescritto", "somministrato"], required: true },
  { key: "medDate", label: "Data", type: "date" },
  { key: "drug", label: "Farmaco / principio attivo", required: true, full: true },
  { key: "dose", label: "Dose" }, { key: "route", label: "Via di somministrazione", list: ["orale", "endovenosa", "intramuscolare", "sottocutanea", "intrarticolare", "topica", "intradermica"] },
  { key: "frequency", label: "Frequenza" }, { key: "duration", label: "Durata" },
  { key: "visitId", label: "Collegato alla visita", type: "select", options: visitOptions(visits) },
  { key: "notes", label: "Note", type: "textarea" },
];

function Overview({ c, go }: { c: any; go: (t: string) => void }) {
  const vas = [...c.visits].filter((v: any) => v.vas != null).reverse();
  const last = c.visits[0];
  const activeCycles = c.cycles.filter((x: any) => x.status === "attivo");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <h2 className="text-2xl">Andamento del dolore (VAS)</h2>
        {vas.length ? <LineChart points={vas.map((v: any) => ({ x: fmtDate(v.visitDate).slice(0, 5), y: v.vas, label: fmtDate(v.visitDate) }))} max={10} /> : <Empty>Nessuna misurazione VAS.</Empty>}
      </section>
      <section className="card">
        <h2 className="text-2xl">Ultima visita</h2>
        {!last ? <Empty>Nessuna visita registrata.</Empty> : (
          <div className="mt-2 space-y-2 text-sm">
            <div className="font-bold">{fmtDateTime(last.visitDate)}{last.area && ` · ${last.area}`}</div>
            {last.assessment && <p><span className="label">Valutazione</span>{last.assessment}</p>}
            {last.indications && <p><span className="label">Indicazioni</span>{last.indications}</p>}
            {last.nextCheckDate && <p className="font-semibold text-brand-bronze">Prossimo controllo: {fmtDate(last.nextCheckDate)}</p>}
            <button className="btn-outline btn-sm" onClick={() => go("diario")}>Diario clinico</button>
          </div>
        )}
      </section>
      <section className="card">
        <h2 className="text-2xl">Cicli attivi</h2>
        {!activeCycles.length ? <Empty>Nessun ciclo attivo.</Empty> : activeCycles.map((x: any) => (
          <div key={x.id} className="mt-2 rounded-xl bg-brand-cream p-3 text-sm">
            <div className="font-bold">{x.name}</div><div className="text-xs text-slate-500">{x.area} · sedute {x.sessionsDone}{x.plannedSessions ? `/${x.plannedSessions}` : ""}{x.nextCheckDate && ` · controllo ${fmtDate(x.nextCheckDate)}`}</div>
            {x.plannedSessions && <div className="mt-2 h-1.5 rounded-full bg-white"><div className="h-1.5 rounded-full bg-brand-sage" style={{ width: `${Math.min(100, (x.sessionsDone / x.plannedSessions) * 100)}%` }} /></div>}
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="text-2xl">Anamnesi in breve</h2>
        {!c.anamnesis ? <Empty>Anamnesi non ancora compilata. <button className="font-bold underline" onClick={() => go("anamnesi")}>Compila</button></Empty> : (
          <dl className="mt-2 space-y-2 text-sm">
            {[["Patologie", c.anamnesis.pathologies], ["Terapie in corso", c.anamnesis.currentTherapies], ["Allergie", c.anamnesis.allergies], ["Interventi", c.anamnesis.surgeries]]
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>)}
          </dl>
        )}
      </section>
    </div>
  );
}

const ANAM_FIELDS: [string, string][] = [
  ["personal", "Anamnesi personale (stile di vita, lavoro, abitudini)"], ["family", "Anamnesi familiare"], ["pathologies", "Patologie precedenti e in atto"],
  ["surgeries", "Interventi chirurgici"], ["allergies", "Allergie e intolleranze"], ["currentTherapies", "Terapie in corso"],
  ["previousTreatments", "Trattamenti precedenti"], ["lifestyle", "Attività fisica, sonno, alimentazione"], ["notes", "Altre note"],
];

function Anamnesis({ pid, data, onSaved }: { pid: number; data: any; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(ANAM_FIELDS.map(([k]) => [k, data?.[k] ?? ""])));
  const { busy, run } = useAction();
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Anamnesi</h2>
        {data?.updatedAt && <span className="text-xs text-slate-500">Ultimo aggiornamento {fmtDateTime(data.updatedAt)}</span>}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {ANAM_FIELDS.map(([k, label]) => <Field key={k} label={label}><textarea className={`input ${k === "allergies" ? "border-red-200" : ""}`} rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
      </div>
      <button className="btn-primary mt-4" disabled={busy} onClick={() => run(() => put(`clinical/patients/${pid}/anamnesis`, f), "Anamnesi salvata").then(onSaved)}>Salva anamnesi</button>
    </section>
  );
}

function Diary({ pid, c }: { pid: number; c: any }) {
  const [, nav] = useLocation();
  const painsByVisit = useMemo(() => { const m: Record<number, any[]> = {}; for (const x of c.pains) (m[x.visitId] ||= []).push(x); return m; }, [c.pains]);
  const procsByVisit = useMemo(() => { const m: Record<number, any[]> = {}; for (const x of c.procedures) if (x.visitId) (m[x.visitId] ||= []).push(x); return m; }, [c.procedures]);
  if (!c.visits.length) return <Empty>Nessuna visita registrata. <Link href={`/pazienti/${pid}/visite/nuova`} className="font-bold underline">Registra la prima visita</Link></Empty>;
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-sand pl-6">
      {c.visits.map((v: any) => (
        <li key={v.id} className="relative">
          <span className="absolute -left-[33px] top-5 h-4 w-4 rounded-full border-4 border-brand-cream bg-brand-sage" />
          <button className="card w-full text-left transition hover:border-brand-sage" onClick={() => nav(`/pazienti/${pid}/visite/${v.id}`)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-brand-deep">{fmtDateTime(v.visitDate)}{v.area && <span className="ml-2 badge bg-brand-mist text-brand-deep">{v.area}</span>}</div>
              {v.vas != null && <span className="badge text-white" style={{ background: intensityColor(v.vas) }}>VAS {v.vas}</span>}
            </div>
            {v.reason && <p className="mt-2 text-sm"><b>Motivo:</b> {v.reason}</p>}
            {v.assessment && <p className="mt-1 text-sm"><b>Valutazione:</b> {v.assessment}</p>}
            {v.treatmentResponse && <p className="mt-1 text-sm"><b>Risposta:</b> {v.treatmentResponse}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {(painsByVisit[v.id] || []).map((x) => <span key={x.id} className="badge bg-slate-100 text-slate-700">{regionLabel(x.region)}{x.intensity != null && ` ${x.intensity}`}</span>)}
              {(procsByVisit[v.id] || []).map((x) => <span key={x.id} className="badge bg-sky-50 text-sky-800">{x.name}</span>)}
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function PainTab({ c }: { c: any }) {
  const visits = [...c.visits].reverse(); // dalla più vecchia
  const [sel, setSel] = useState<number | null>(c.visits[0]?.id ?? null);
  const regions = Array.from(new Set(c.pains.map((p: any) => p.region))) as string[];
  const marks = c.pains.filter((p: any) => p.visitId === sel).map((p: any) => ({ region: p.region, intensity: p.intensity }));
  const vas = visits.filter((v: any) => v.vas != null);
  if (!c.visits.length) return <Empty>Le valutazioni del dolore compariranno qui dopo la prima visita.</Empty>;
  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-2xl">Scala VAS nel tempo</h2>
        {vas.length ? <LineChart points={vas.map((v: any) => ({ x: fmtDate(v.visitDate).slice(0, 5), y: v.vas, label: fmtDate(v.visitDate) }))} max={10} /> : <Empty>Nessuna VAS registrata.</Empty>}
      </section>
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl">Mappa del dolore</h2>
          <select className="input w-auto" value={sel ?? ""} onChange={(e) => setSel(Number(e.target.value))}>{c.visits.map((v: any) => <option key={v.id} value={v.id}>Visita del {fmtDate(v.visitDate)}</option>)}</select>
        </div>
        <div className="mt-4"><BodyMap marks={marks} /></div>
        <div className="mt-2 flex justify-center"><IntensityLegend /></div>
      </section>
      {regions.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="text-2xl">Confronto per area</h2>
          <p className="text-xs text-slate-500">Intensità (0–10) registrata per ciascuna area nelle diverse visite.</p>
          <table className="tbl mt-3">
            <thead><tr><th>Area</th>{visits.map((v: any) => <th key={v.id} className="text-center">{fmtDate(v.visitDate)}</th>)}</tr></thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r}>
                  <td className="font-semibold">{regionLabel(r)}</td>
                  {visits.map((v: any) => {
                    const x = c.pains.find((p: any) => p.visitId === v.id && p.region === r);
                    return <td key={v.id} className="text-center">{x ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: intensityColor(x.intensity) }}>{x.intensity ?? "?"}</span> : <span className="text-slate-300">–</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Cycles({ pid, c, reload }: { pid: number; c: any; reload: () => void }) {
  const cycleOpts = c.cycles.map((x: any) => ({ value: x.id, label: x.name }));
  return (
    <div className="space-y-8">
      <section className="card">
        <CrudList title="Cicli di trattamento" rows={c.cycles} createPath={`clinical/patients/${pid}/cycles`} itemPath={(x) => `clinical/cycles/${x}`} onChange={reload}
          addLabel="Nuovo ciclo" defaults={{ status: "attivo", startDate: todayRome(), area: TREATMENT_AREAS[0] }}
          fields={[
            { key: "area", label: "Ambito", type: "select", options: TREATMENT_AREAS, required: true }, { key: "name", label: "Nome del ciclo", required: true },
            { key: "startDate", label: "Inizio", type: "date" }, { key: "endDate", label: "Fine", type: "date" },
            { key: "plannedSessions", label: "Sedute previste", type: "number" }, { key: "status", label: "Stato", type: "select", options: ["attivo", "concluso", "sospeso"], required: true },
            { key: "nextCheckDate", label: "Prossimo controllo programmato", type: "date" },
            { key: "response", label: "Valutazione della risposta clinica", type: "textarea" }, { key: "notes", label: "Note / scheda specifica del trattamento", type: "textarea" },
          ]}
          columns={[
            { key: "name", label: "Ciclo", render: (r) => <><b>{r.name}</b><div className="text-xs text-slate-500">{r.area}</div></> },
            { key: "period", label: "Periodo", render: (r) => `${fmtDate(r.startDate)}${r.endDate ? ` → ${fmtDate(r.endDate)}` : ""}` },
            { key: "sessions", label: "Sedute", render: (r) => `${r.sessionsDone}${r.plannedSessions ? ` / ${r.plannedSessions}` : ""}` },
            { key: "status", label: "Stato", render: (r) => <span className={`badge ${r.status === "attivo" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{r.status}</span> },
            { key: "nextCheckDate", label: "Controllo", render: (r) => fmtDate(r.nextCheckDate) },
            { key: "response", label: "Risposta" },
          ]} />
      </section>
      <section className="card">
        <CrudList title="Procedure eseguite" rows={c.procedures} createPath={`clinical/patients/${pid}/procedures`} itemPath={(x) => `clinical/procedures/${x}`} onChange={reload}
          addLabel="Registra procedura" defaults={{ procDate: todayRome() }}
          fields={[
            { key: "procDate", label: "Data", type: "date" }, { key: "name", label: "Procedura", required: true },
            { key: "site", label: "Sede anatomica" }, { key: "cycleId", label: "Ciclo di trattamento", type: "select", options: cycleOpts },
            { key: "visitId", label: "Visita", type: "select", options: visitOptions(c.visits) },
            { key: "materials", label: "Materiali / prodotti utilizzati (lotto, quantità)", type: "textarea" }, { key: "notes", label: "Osservazioni cliniche", type: "textarea" },
          ]}
          columns={[
            { key: "procDate", label: "Data", render: (r) => fmtDate(r.procDate) }, { key: "name", label: "Procedura", render: (r) => <b>{r.name}</b> },
            { key: "site", label: "Sede" }, { key: "materials", label: "Materiali" },
            { key: "cycle", label: "Ciclo", render: (r) => c.cycles.find((x: any) => x.id === r.cycleId)?.name || "" },
          ]} />
      </section>
    </div>
  );
}

function Labs({ pid, c, reload }: { pid: number; c: any; reload: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const l of c.labs) { if (!m.has(l.testName)) m.set(l.testName, []); m.get(l.testName)!.push(l); }
    return [...m.entries()];
  }, [c.labs]);
  const names = groups.map(([n]) => n);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayRome());
  const [rows, setRows] = useState([{ testName: "", value: "", unit: "", refMin: "", refMax: "" }]);
  const { busy, run } = useAction();
  const last = (list: any[]) => list[list.length - 1];
  const prefill = (i: number, name: string) => {
    const g = groups.find(([n]) => n === name)?.[1];
    const l = g && last(g);
    setRows((r) => r.map((x, j) => (j === i ? { ...x, testName: name, unit: l?.unit ?? x.unit, refMin: l?.refMin ?? x.refMin, refMax: l?.refMax ?? x.refMax } : x)));
  };
  const save = () => run(() => post(`clinical/patients/${pid}/labs`, rows.filter((r) => r.testName).map((r) => ({ ...r, testDate: date }))), "Esami registrati").then((r) => { if (r) { setAdding(false); setRows([{ testName: "", value: "", unit: "", refMin: "", refMax: "" }]); reload(); } });
  const flag = (l: any) => l.value != null && ((l.refMin != null && l.value < l.refMin) || (l.refMax != null && l.value > l.refMax));
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Inserisci esami</button></div>
      {!groups.length && <Empty>Nessun esame registrato.</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([name, list]) => {
          const l = last(list);
          const numeric = list.filter((x) => x.value != null);
          return (
            <section key={name} className="card">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="text-xl">{name}</h3><div className="text-xs text-slate-500">Riferimento: {l.refText || [l.refMin, l.refMax].filter((x) => x != null).join(" – ") || "–"} {l.unit}</div></div>
                <div className={`text-right font-display text-3xl ${flag(l) ? "text-red-600" : "text-brand-deep"}`}>{l.value ?? l.valueText}<span className="ml-1 text-sm">{l.unit}</span><div className="text-[11px] font-sans text-slate-500">{fmtDate(l.testDate)}</div></div>
              </div>
              {numeric.length > 1 && <LineChart height={150} points={numeric.map((x) => ({ x: fmtDate(x.testDate).slice(0, 5), y: x.value, label: fmtDate(x.testDate) }))} refMin={l.refMin} refMax={l.refMax} unit={` ${l.unit || ""}`} />}
              <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs font-bold text-brand-deep">Storico ({list.length})</summary>
                <table className="tbl mt-2"><tbody>{[...list].reverse().map((x) => (
                  <tr key={x.id}><td>{fmtDate(x.testDate)}</td><td className={flag(x) ? "font-bold text-red-600" : ""}>{x.value ?? x.valueText} {x.unit}</td><td className="text-xs text-slate-500">{x.notes}</td>
                    <td className="text-right"><button className="btn-ghost btn-sm text-red-600" onClick={() => { if (confirm("Eliminare questo valore?")) run(() => del(`clinical/labs/${x.id}`), "Eliminato").then(reload); }}><Trash2 size={13} /></button></td></tr>
                ))}</tbody></table>
              </details>
            </section>
          );
        })}
      </div>
      {adding && (
        <Modal title="Inserisci esami del sangue" wide onClose={() => setAdding(false)} footer={<><button className="btn-ghost" onClick={() => setAdding(false)}>Annulla</button><button className="btn-primary" disabled={busy} onClick={save}>Salva</button></>}>
          <Field label="Data del prelievo" className="max-w-xs"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <datalist id="lab-names">{[...new Set([...names, "Emoglobina", "Globuli bianchi", "Piastrine", "Glicemia", "Creatinina", "Ferritina", "Vitamina D (25-OH)", "Vitamina B12", "PCR", "VES", "TSH", "Colesterolo totale", "Trigliceridi", "AST", "ALT"])].map((n) => <option key={n} value={n} />)}</datalist>
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <input className="input col-span-2 sm:col-span-1" list="lab-names" placeholder="Esame" value={r.testName} onChange={(e) => prefill(i, e.target.value)} />
                <input className="input" placeholder="Valore" inputMode="decimal" value={r.value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <input className="input" placeholder="Unità" value={r.unit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                <input className="input" placeholder="Rif. min" inputMode="decimal" value={r.refMin} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, refMin: e.target.value } : x)))} />
                <input className="input" placeholder="Rif. max" inputMode="decimal" value={r.refMax} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, refMax: e.target.value } : x)))} />
              </div>
            ))}
          </div>
          <button className="btn-ghost btn-sm mt-2" onClick={() => setRows([...rows, { testName: "", value: "", unit: "", refMin: "", refMax: "" }])}><Plus size={14} /> Altra riga</button>
        </Modal>
      )}
    </div>
  );
}

function Documents({ pid, c, reload }: { pid: number; c: any; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "referto", title: "", docDate: todayRome(), notes: "", visitId: "" });
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useAction();
  const send = () => {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v));
    if (file) fd.append("file", file);
    run(() => upload(`clinical/patients/${pid}/documents`, fd), "Documento caricato").then((r) => { if (r) { setOpen(false); setFile(null); setF({ ...f, title: "", notes: "" }); reload(); } });
  };
  return (
    <section className="card">
      <div className="flex items-center justify-between"><h2 className="text-2xl">Referti, immagini e documenti</h2><button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Upload size={14} /> Carica</button></div>
      <p className="text-xs text-slate-500">I file sono cifrati nel database e accessibili solo dal medico; ogni apertura viene registrata.</p>
      <div className="mt-3 divide-y divide-slate-100">
        {!c.documents.length && <Empty>Nessun documento caricato.</Empty>}
        {c.documents.map((d: any) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <FileText size={18} className="text-brand-sage" />
            <div className="min-w-0 flex-1"><a href={`/api/clinical/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="font-bold text-brand-deep hover:underline">{d.title}</a>
              <div className="text-xs text-slate-500">{DOC_KINDS[d.kind]} · {fmtDate(d.docDate)} · {d.originalName} ({Math.round(d.size / 1024)} KB){d.notes && ` · ${d.notes}`}</div></div>
            <a className="btn-ghost btn-sm" href={`/api/clinical/documents/${d.id}/file?download=1`}><Download size={14} /></a>
            <button className="btn-ghost btn-sm text-red-600" onClick={() => { if (confirm("Eliminare definitivamente il documento?")) run(() => del(`clinical/documents/${d.id}`), "Documento eliminato").then(reload); }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="Carica documento" onClose={() => setOpen(false)} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Annulla</button><button className="btn-primary" disabled={busy || !file || !f.title} onClick={send}>Carica</button></>}>
          <div className="space-y-3">
            <Field label="File (PDF, immagine, Word – max 15 MB)"><input type="file" className="input" accept=".pdf,image/*,.doc,.docx,.txt" onChange={(e) => { const x = e.target.files?.[0] || null; setFile(x); if (x && !f.title) setF({ ...f, title: x.name.replace(/\.[^.]+$/, "") }); }} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Data"><input type="date" className="input" value={f.docDate} onChange={(e) => setF({ ...f, docDate: e.target.value })} /></Field>
            </div>
            <Field label="Titolo"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Visita collegata"><select className="input" value={f.visitId} onChange={(e) => setF({ ...f, visitId: e.target.value })}><option value="">–</option>{c.visits.map((v: any) => <option key={v.id} value={v.id}>Visita del {fmtDate(v.visitDate)}</option>)}</select></Field>
            <Field label="Note"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Consents({ pid, c, reload }: { pid: number; c: any; reload: () => void }) {
  const tpl = useLoad<any[]>("clinical/consent-templates");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [f, setF] = useState({ templateId: "", signedDate: todayRome(), notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useAction();
  const active = (tpl.data || []).filter((t) => t.active);
  const send = () => {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v));
    if (file) fd.append("file", file);
    run(() => upload(`clinical/patients/${pid}/consents`, fd), "Consenso registrato").then((r) => { if (r) { setOpen(false); setFile(null); reload(); } });
  };
  const attach = (id: number, fl: File) => { const fd = new FormData(); fd.append("file", fl); run(() => upload(`clinical/consents/${id}/file`, fd), "Documento firmato allegato").then(reload); };
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Consensi informati</h2>
        <div className="flex gap-2">
          <select className="input w-auto py-1.5 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) window.open(`/api/clinical/consent-templates/${e.target.value}/pdf?patientId=${pid}`, "_blank"); e.target.value = ""; }}>
            <option value="">Stampa modulo precompilato…</option>{active.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
          </select>
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> Registra consenso firmato</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">I consensi clinici sono distinti dal consenso privacy. Ogni registrazione conserva il testo e la versione del modello firmato.</p>
      <div className="mt-3 divide-y divide-slate-100">
        {!c.consents.length && <Empty>Nessun consenso registrato.</Empty>}
        {c.consents.map((x: any) => (
          <div key={x.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <b>{x.templateName}</b> <span className="text-xs text-slate-500">v{x.version}</span>
              <div className="text-xs text-slate-500">Firmato il {fmtDate(x.signedDate)}{x.status === "revocato" && ` · revocato il ${fmtDate(x.revokedAt)}`}{x.notes && ` · ${x.notes}`}</div>
            </div>
            <span className={`badge ${x.status === "firmato" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{x.status}</span>
            <button className="btn-ghost btn-sm" onClick={() => setViewing(x)}>Testo</button>
            {x.fileId ? <a className="btn-ghost btn-sm" href={`/api/clinical/consents/${x.id}/file`} target="_blank" rel="noreferrer"><FileText size={14} /> Firmato</a>
              : <label className="btn-ghost btn-sm cursor-pointer"><Upload size={14} /> Allega firmato<input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && attach(x.id, e.target.files[0])} /></label>}
            {x.status === "firmato" && <button className="btn-ghost btn-sm text-red-600" disabled={busy} onClick={() => { const n = prompt("Revoca del consenso: note (facoltative)"); if (n !== null) run(() => post(`clinical/consents/${x.id}/revoke`, { date: todayRome(), notes: n || undefined }), "Consenso revocato").then(reload); }}><Ban size={14} /></button>}
          </div>
        ))}
      </div>
      {open && (
        <Modal title="Registra consenso firmato" onClose={() => setOpen(false)} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Annulla</button><button className="btn-primary" disabled={busy || !f.templateId} onClick={send}>Registra</button></>}>
          <div className="space-y-3">
            <Field label="Modello"><select className="input" value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}><option value="">Seleziona…</option>{active.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}</select></Field>
            <Field label="Data della firma"><input type="date" className="input" value={f.signedDate} onChange={(e) => setF({ ...f, signedDate: e.target.value })} /></Field>
            <Field label="Documento firmato (scansione o PDF)" hint="Facoltativo: puoi allegarlo anche dopo."><input type="file" className="input" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
            <Field label="Note"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {viewing && <ConsentText id={viewing.id} title={viewing.templateName} onClose={() => setViewing(null)} />}
    </section>
  );
}

function ConsentText({ id, title, onClose }: { id: number; title: string; onClose: () => void }) {
  const { data } = useLoad<any>(`clinical/consents/${id}`);
  return <Modal title={title} wide onClose={onClose}>{!data ? <Spinner /> : <RichText text={data.bodySnapshot} />}</Modal>;
}

function PatientAudit({ pid }: { pid: number }) {
  const { data, loading } = useLoad<any[]>(`admin/audit?patientId=${pid}`);
  if (loading) return <Spinner />;
  return (
    <section className="card overflow-x-auto">
      <h2 className="text-2xl">Registro accessi e operazioni</h2>
      <table className="tbl mt-3">
        <thead><tr><th>Data</th><th>Utente</th><th>Operazione</th><th>IP</th></tr></thead>
        <tbody>{(data || []).map((l) => <tr key={l.id}><td className="whitespace-nowrap">{fmtDateTime(l.at)}</td><td>{l.username}</td><td>{l.action.replace(/_/g, " ")}</td><td className="text-xs text-slate-500">{l.ip}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

