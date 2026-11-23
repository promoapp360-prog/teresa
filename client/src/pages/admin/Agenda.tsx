import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Plus, Phone, Mail, User, Stethoscope, Search } from "lucide-react";
import { get, patch, post } from "@/lib/api";
import { addDays, fmtLongDay, romeParts, startOfWeek, todayRome, fullName, fmtDateTime, fmtMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLoad, Spinner, ErrorBox, StatusBadge, Modal, Field, MoneyInput, PageTitle, useAction, useToast, Check } from "@/components/ui";
import { STATUS_LABELS } from "@shared/constants";

const HOUR_START = 8, HOUR_END = 20, PX_PER_MIN = 1.1;

export default function Agenda() {
  const [mode, setMode] = useState<"week" | "day">(() => (window.innerWidth < 900 ? "day" : "week"));
  const [day, setDay] = useState(todayRome());
  const [showCancelled, setShowCancelled] = useState(false);
  const from = mode === "week" ? startOfWeek(day) : day;
  const to = mode === "week" ? addDays(from, 6) : day;
  const { data, error, loading, reload } = useLoad<any[]>(`admin/appointments?from=${from}&to=${to}${showCancelled ? "&all=1" : ""}`);
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState<{ day: string; time?: string } | null>(null);

  const days = mode === "week" ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [day];
  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const a of data || []) (m[romeParts(a.startsAt).day] ||= []).push(a);
    return m;
  }, [data]);
  const shift = (n: number) => setDay(addDays(day, mode === "week" ? 7 * n : n));

  return (
    <>
      <PageTitle title="Agenda" subtitle={mode === "week" ? `${fmtLongDay(from)} – ${fmtLongDay(to)}` : fmtLongDay(day)}
        actions={<button className="btn-primary" onClick={() => setCreating({ day })}><Plus size={16} /> Nuovo appuntamento</button>} />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-white p-1 shadow-soft">
          {(["day", "week"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${mode === m ? "bg-brand-deep text-white" : "text-brand-deep"}`}>{m === "day" ? "Giorno" : "Settimana"}</button>)}
        </div>
        <button className="btn-outline btn-sm" onClick={() => shift(-1)} aria-label="Precedente"><ChevronLeft size={16} /></button>
        <button className="btn-outline btn-sm" onClick={() => setDay(todayRome())}>Oggi</button>
        <button className="btn-outline btn-sm" onClick={() => shift(1)} aria-label="Successivo"><ChevronRight size={16} /></button>
        <input type="date" className="input w-auto py-1.5" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <Check checked={showCancelled} onChange={setShowCancelled} label="Mostra annullati" />
      </div>
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Spinner /> : mode === "day" ? (
        <div className="card">
          {(byDay[day] || []).length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nessun appuntamento. <button className="font-bold text-brand-deep underline" onClick={() => setCreating({ day })}>Aggiungine uno</button></p>}
          <div className="divide-y divide-slate-100">
            {(byDay[day] || []).map((a) => (
              <button key={a.id} onClick={() => setOpen(a)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-brand-cream/50">
                <div className="w-24 font-display text-xl text-brand-deep">{romeParts(a.startsAt).time}–{romeParts(a.endsAt).time}</div>
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{fullName(a)}</div><div className="truncate text-xs text-slate-500">{a.serviceName}{a.source === "online" && " · online"}</div></div>
                <StatusBadge status={a.status} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((d) => (
              <div key={d} className={`border-b border-l border-slate-100 px-2 py-2 text-center text-xs font-bold ${d === todayRome() ? "bg-brand-mist text-brand-deep" : "text-slate-500"}`}>{fmtLongDay(d)}</div>
            ))}
            <div className="relative" style={{ height: (HOUR_END - HOUR_START) * 60 * PX_PER_MIN }}>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => <div key={i} className="absolute right-2 text-[10px] text-slate-400" style={{ top: i * 60 * PX_PER_MIN - 6 }}>{String(HOUR_START + i).padStart(2, "0")}:00</div>)}
            </div>
            {days.map((d) => (
              <div key={d} className="relative border-l border-slate-100" style={{ height: (HOUR_END - HOUR_START) * 60 * PX_PER_MIN }}
                onClick={(e) => {
                  const y = e.clientY - (e.currentTarget as HTMLDivElement).getBoundingClientRect().top;
                  const min = Math.floor(y / PX_PER_MIN / 15) * 15 + HOUR_START * 60;
                  setCreating({ day: d, time: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}` });
                }}>
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * 60 * PX_PER_MIN }} />)}
                {(byDay[d] || []).map((a) => {
                  const st = romeParts(a.startsAt).time.split(":").map(Number), en = romeParts(a.endsAt).time.split(":").map(Number);
                  const top = (st[0] * 60 + st[1] - HOUR_START * 60) * PX_PER_MIN, h = Math.max(22, ((en[0] * 60 + en[1]) - (st[0] * 60 + st[1])) * PX_PER_MIN - 2);
                  const color = a.status === "requested" ? "border-amber-400 bg-amber-50" : a.status === "completed" ? "border-sky-400 bg-sky-50" : a.status === "cancelled" || a.status === "no_show" ? "border-slate-300 bg-slate-100 opacity-60" : "border-brand-sage bg-brand-mist";
                  return (
                    <button key={a.id} onClick={(e) => { e.stopPropagation(); setOpen(a); }} className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${color}`} style={{ top, height: h }}>
                      <b>{romeParts(a.startsAt).time}</b> {fullName(a)}<div className="truncate text-slate-500">{a.serviceName}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {open && <AppointmentModal appt={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); reload(); }} />}
      {creating && <NewAppointmentModal initial={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); reload(); }} />}
    </>
  );
}

export function AppointmentModal({ appt, onClose, onChanged }: { appt: any; onClose: () => void; onChanged: () => void }) {
  const { me } = useAuth();
  const [, nav] = useLocation();
  const { busy, run } = useAction();
  const start = romeParts(appt.startsAt), end = romeParts(appt.endsAt);
  const duration = Math.round((new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 60000);
  const [moving, setMoving] = useState(false);
  const [mv, setMv] = useState({ day: start.day, time: start.time });
  const [slots, setSlots] = useState<string[]>([]);
  const [notes, setNotes] = useState(appt.internalNotes || "");
  const [amount, setAmount] = useState<number | null>(appt.amountCents ?? appt.priceCents ?? null);
  const [notify, setNotify] = useState(true);
  useEffect(() => { if (moving) get<{ slots: string[] }>(`admin/slots?day=${mv.day}&duration=${duration}&exclude=${appt.id}`).then((r) => setSlots(r.slots)); }, [moving, mv.day]); // eslint-disable-line

  const save = (body: any, msg: string) => run(async () => {
    try { await patch(`admin/appointments/${appt.id}`, { notify, ...body }); }
    catch (e: any) {
      if (e.code === "CONFLICT" && confirm(`${e.message}. Confermi comunque?`)) await patch(`admin/appointments/${appt.id}`, { notify, ...body, force: true });
      else throw e;
    }
  }, msg).then((r) => r !== undefined && onChanged());

  const active = ["requested", "confirmed"].includes(appt.status);
  return (
    <Modal title={fullName(appt)} onClose={onClose}
      footer={<>
        {appt.status === "requested" && <button className="btn-primary" disabled={busy} onClick={() => save({ status: "confirmed" }, "Confermato")}>Conferma</button>}
        {active && <button className="btn-outline" disabled={busy} onClick={() => save({ status: "completed", amountCents: amount }, "Segnato come eseguito")}>Eseguito</button>}
        {active && <button className="btn-ghost" disabled={busy} onClick={() => save({ status: "no_show" }, "Segnato come non presentato")}>Non presentato</button>}
        {active && <button className="btn-danger" disabled={busy} onClick={() => { const reason = prompt("Motivo dell'annullamento (facoltativo)"); if (reason !== null) save({ status: "cancelled", cancelReason: reason || undefined }, "Annullato"); }}>Annulla</button>}
      </>}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={appt.status} /> {appt.source === "online" && <span className="badge bg-brand-mist text-brand-deep">Prenotato online</span>}</div>
        <div><div className="text-lg font-bold text-brand-deep">{appt.serviceName}</div><div>{fmtLongDay(start.day)} · {start.time}–{end.time} ({duration} min)</div></div>
        <div className="flex flex-wrap gap-3 text-slate-600">
          {appt.phone && <a href={`tel:${appt.phone}`} className="inline-flex items-center gap-1"><Phone size={14} /> {appt.phone}</a>}
          {appt.email && <a href={`mailto:${appt.email}`} className="inline-flex items-center gap-1"><Mail size={14} /> {appt.email}</a>}
        </div>
        {appt.patientNotes && <div className="rounded-xl bg-brand-cream p-3"><div className="label">Note del paziente</div>{appt.patientNotes}</div>}
        <div className="flex flex-wrap gap-2">
          <Link href={`/pazienti/${appt.patientId}`} className="btn-outline btn-sm"><User size={14} /> Scheda paziente</Link>
          {me?.role === "doctor" && appt.status !== "cancelled" && <button className="btn-primary btn-sm" onClick={() => nav(`/pazienti/${appt.patientId}/visite/nuova?appuntamento=${appt.id}`)}><Stethoscope size={14} /> Registra visita</button>}
          {active && <button className="btn-ghost btn-sm" onClick={() => setMoving(!moving)}>Sposta</button>}
        </div>
        {moving && (
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nuovo giorno"><input type="date" className="input" value={mv.day} onChange={(e) => setMv({ ...mv, day: e.target.value })} /></Field>
              <Field label="Orario"><input type="time" step={300} className="input" value={mv.time} onChange={(e) => setMv({ ...mv, time: e.target.value })} /></Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{slots.slice(0, 40).map((t) => <button key={t} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${mv.time === t ? "border-brand-deep bg-brand-deep text-white" : "border-slate-200"}`} onClick={() => setMv({ ...mv, time: t })}>{t}</button>)}{!slots.length && <span className="text-xs text-slate-500">Nessuna fascia libera in questo giorno (puoi comunque forzare un orario).</span>}</div>
            <button className="btn-primary btn-sm mt-3" disabled={busy} onClick={() => save({ day: mv.day, time: mv.time }, "Appuntamento spostato")}>Salva il nuovo orario</button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Importo registrato" hint={appt.priceCents != null ? `Listino: ${fmtMoney(appt.priceCents)}` : undefined}><MoneyInput value={amount} onChange={setAmount} /></Field>
        </div>
        <Field label="Note interne"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Check checked={notify} onChange={setNotify} label="Avvisa il paziente via email" />
          <button className="btn-outline btn-sm" disabled={busy} onClick={() => save({ internalNotes: notes, amountCents: amount }, "Salvato")}>Salva note e importo</button>
        </div>
        {appt.cancelReason && <p className="text-xs text-slate-500">Annullato: {appt.cancelReason}</p>}
      </div>
    </Modal>
  );
}

export function PatientPicker({ value, onChange }: { value: any | null; onChange: (p: any | null) => void }) {
  const [term, setTerm] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [np, setNp] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const { busy, run } = useAction();
  useEffect(() => {
    if (term.trim().length < 2) { setList([]); return; }
    const t = setTimeout(() => get<any[]>(`admin/patients?search=${encodeURIComponent(term)}`).then(setList).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [term]);
  if (value) return <div className="flex items-center justify-between rounded-xl bg-brand-mist px-3 py-2 text-sm"><b>{fullName(value)}</b><button className="text-xs font-bold text-brand-deep underline" onClick={() => onChange(null)}>Cambia</button></div>;
  if (creating) return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Nome" value={np.firstName} onChange={(e) => setNp({ ...np, firstName: e.target.value })} />
        <input className="input" placeholder="Cognome" value={np.lastName} onChange={(e) => setNp({ ...np, lastName: e.target.value })} />
        <input className="input" placeholder="Telefono" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
        <input className="input" placeholder="Email" type="email" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy || !np.firstName || !np.lastName} onClick={() => run(() => post("admin/patients", np), "Paziente creato").then((p) => p && onChange(p))}>Crea paziente</button>
        <button className="btn-ghost btn-sm" onClick={() => setCreating(false)}>Annulla</button>
      </div>
    </div>
  );
  return (
    <div>
      <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cerca per cognome, nome, telefono…" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus /></div>
      {list.length > 0 && <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">{list.map((p) => <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-mist" onClick={() => onChange(p)}><b>{fullName(p)}</b> <span className="text-slate-500">{p.phone}</span></button>)}</div>}
      <button className="mt-2 text-xs font-bold text-brand-deep underline" onClick={() => { setCreating(true); const [a, ...b] = term.trim().split(" "); setNp({ ...np, lastName: a || "", firstName: b.join(" ") }); }}>+ Nuovo paziente</button>
    </div>
  );
}

export function NewAppointmentModal({ initial, onClose, onCreated, patient: fixedPatient }: { initial: { day: string; time?: string }; onClose: () => void; onCreated: () => void; patient?: any }) {
  const toast = useToast();
  const { data: catalog } = useLoad<any>("admin/catalog");
  const [patient, setPatient] = useState<any | null>(fixedPatient || null);
  const [serviceId, setServiceId] = useState<number | "">("");
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time || "");
  const [slots, setSlots] = useState<string[]>([]);
  const [status, setStatus] = useState<"confirmed" | "requested">("confirmed");
  const [sendEmail, setSendEmail] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const svc = catalog?.services.find((s: any) => s.id === serviceId);
  useEffect(() => { if (svc) get<{ slots: string[] }>(`admin/slots?day=${day}&duration=${svc.durationMin}`).then((r) => setSlots(r.slots)); }, [day, serviceId]); // eslint-disable-line

  const submit = async (force = false) => {
    if (!patient || !serviceId || !time) return toast("Seleziona paziente, prestazione e orario", "err");
    setBusy(true);
    try { await post("admin/appointments", { patientId: patient.id, serviceId, day, time, status, sendEmail, internalNotes: notes, force }); toast("Appuntamento creato"); onCreated(); }
    catch (e: any) { if (e.code === "CONFLICT" && confirm(`${e.message}. Inserire comunque?`)) { setBusy(false); return submit(true); } toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Nuovo appuntamento" onClose={onClose} footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy} onClick={() => submit()}>Salva</button></>}>
      <div className="space-y-4">
        <Field label="Paziente">{fixedPatient ? <div className="rounded-xl bg-brand-mist px-3 py-2 text-sm font-bold">{fullName(fixedPatient)}</div> : <PatientPicker value={patient} onChange={setPatient} />}</Field>
        <Field label="Prestazione">
          <select className="input" value={serviceId} onChange={(e) => setServiceId(Number(e.target.value) || "")}>
            <option value="">Seleziona…</option>
            {catalog?.categories.map((c: any) => <optgroup key={c.id} label={c.name}>{catalog.services.filter((s: any) => s.categoryId === c.id && s.active).map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}</optgroup>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giorno"><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label="Orario"><input type="time" step={300} className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        {svc && <div className="flex flex-wrap gap-1">{slots.slice(0, 48).map((t) => <button key={t} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${time === t ? "border-brand-deep bg-brand-deep text-white" : "border-slate-200"}`} onClick={() => setTime(t)}>{t}</button>)}{!slots.length && <span className="text-xs text-slate-500">Nessuna fascia libera: puoi comunque inserire un orario manuale.</span>}</div>}
        <Field label="Stato"><select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}><option value="confirmed">{STATUS_LABELS.confirmed}</option><option value="requested">{STATUS_LABELS.requested}</option></select></Field>
        <Field label="Note interne"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Check checked={sendEmail} onChange={setSendEmail} label="Invia email di conferma al paziente (se ha un indirizzo email)" />
      </div>
    </Modal>
  );
}

export const apptWhen = (a: any) => fmtDateTime(a.startsAt);
