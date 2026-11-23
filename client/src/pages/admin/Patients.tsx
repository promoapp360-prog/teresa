import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, Download } from "lucide-react";
import { post, patch } from "@/lib/api";
import { fmtDate, fmtDateTime, fullName, age } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLoad, Spinner, ErrorBox, Empty, Modal, Field, PageTitle, useAction, Check } from "@/components/ui";

export default function Patients() {
  const { me } = useAuth();
  const [, nav] = useLocation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(term), 250); return () => clearTimeout(t); }, [term]);
  const { data, error, loading, reload } = useLoad<any[]>(`admin/patients?search=${encodeURIComponent(debounced)}&archived=${archived}`);
  return (
    <>
      <PageTitle title="Pazienti" subtitle="Anagrafiche, storico delle prenotazioni e cartelle cliniche"
        actions={<>
          {me?.role === "doctor" && <a className="btn-outline" href="/api/admin/patients-export.csv"><Download size={16} /> Esporta</a>}
          <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuovo paziente</button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cerca per nome, telefono, email, codice fiscale…" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        <Check checked={archived} onChange={setArchived} label="Archiviati" />
      </div>
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Spinner /> : !data?.length ? <Empty>Nessun paziente trovato.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead><tr><th>Paziente</th><th>Età</th><th>Contatti</th><th>Ultima visita</th><th>Prossimo appuntamento</th></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-brand-cream/60" onClick={() => nav(`/pazienti/${p.id}`)}>
                  <td><Link href={`/pazienti/${p.id}`} className="font-bold text-brand-deep">{fullName(p)}</Link>{p.source === "online" && <span className="ml-2 badge bg-brand-mist text-brand-deep">online</span>}</td>
                  <td>{age(p.birthDate) ?? "–"}</td>
                  <td className="text-xs text-slate-600">{p.phone}<br />{p.email}</td>
                  <td className="text-xs">{p.lastVisit ? fmtDate(p.lastVisit) : "–"}</td>
                  <td className="text-xs">{p.nextAppointment ? fmtDateTime(p.nextAppointment) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <PatientForm onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); reload(); nav(`/pazienti/${p.id}`); }} />}
    </>
  );
}

const EMPTY = { firstName: "", lastName: "", birthDate: "", birthPlace: "", sex: "", taxCode: "", phone: "", email: "", address: "", city: "", profession: "", notes: "" };

export function PatientForm({ patient, onClose, onSaved }: { patient?: any; onClose: () => void; onSaved: (p: any) => void }) {
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = { ...EMPTY };
    if (patient) for (const k of Object.keys(EMPTY)) o[k] = patient[k] ?? "";
    return o;
  });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => run(() => (patient ? patch(`admin/patients/${patient.id}`, f) : post("admin/patients", f)), "Anagrafica salvata").then((p) => p && onSaved(p));
  return (
    <Modal title={patient ? "Modifica anagrafica" : "Nuovo paziente"} onClose={onClose} wide footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy || !f.firstName || !f.lastName} onClick={save}>Salva</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Cognome *"><input className="input" value={f.lastName} onChange={set("lastName")} /></Field>
        <Field label="Nome *"><input className="input" value={f.firstName} onChange={set("firstName")} /></Field>
        <Field label="Sesso"><select className="input" value={f.sex} onChange={set("sex")}><option value="">–</option><option value="F">F</option><option value="M">M</option><option value="X">Altro</option></select></Field>
        <Field label="Data di nascita"><input type="date" className="input" value={f.birthDate} onChange={set("birthDate")} /></Field>
        <Field label="Luogo di nascita"><input className="input" value={f.birthPlace} onChange={set("birthPlace")} /></Field>
        <Field label="Codice fiscale"><input className="input uppercase" maxLength={16} value={f.taxCode} onChange={set("taxCode")} /></Field>
        <Field label="Telefono"><input className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Professione"><input className="input" value={f.profession} onChange={set("profession")} /></Field>
        <Field label="Indirizzo" className="sm:col-span-2"><input className="input" value={f.address} onChange={set("address")} /></Field>
        <Field label="Città"><input className="input" value={f.city} onChange={set("city")} /></Field>
        <Field label="Note organizzative" className="sm:col-span-3" hint="Visibili anche alla segreteria: non inserire qui dati clinici."><textarea className="input" rows={2} value={f.notes} onChange={set("notes")} /></Field>
      </div>
    </Modal>
  );
}
