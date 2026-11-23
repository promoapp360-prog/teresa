import React, { useEffect, useState } from "react";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { put, post, del } from "@/lib/api";
import { fmtDate, fmtDateTime, fullName, todayRome } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, Field, PageTitle, useAction, Empty, Modal } from "@/components/ui";
import { WEEKDAYS, CLOSURE_KINDS, CLOSURE_LABELS } from "@shared/constants";

type Slot = { weekday: number; startTime: string; endTime: string };

export default function Availability() {
  const { data, error, loading, reload } = useLoad<any>("admin/hours");
  const [hours, setHours] = useState<Slot[]>([]);
  const [c, setC] = useState({ kind: "ferie", startDay: todayRome(), endDay: todayRome(), startTime: "", endTime: "", note: "" });
  const [affected, setAffected] = useState<any[] | null>(null);
  const { busy, run } = useAction();
  useEffect(() => { if (data) setHours(data.hours.map((h: any) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime }))); }, [data]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;

  const order = [1, 2, 3, 4, 5, 6, 0];
  const upd = (i: number, k: keyof Slot, v: string) => setHours(hours.map((h, j) => (j === i ? { ...h, [k]: v } : h)));

  return (
    <>
      <PageTitle title="Orari e chiusure" subtitle="Disponibilità settimanale della Dottoressa: gli orari prenotabili online vengono calcolati da qui" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="text-2xl">Orario settimanale</h2>
          <p className="text-xs text-slate-500">Le pause si ottengono con più fasce nello stesso giorno (es. 9–13 e 15–19).</p>
          <div className="mt-4 space-y-3">
            {order.map((wd) => {
              const list = hours.map((h, i) => ({ ...h, i })).filter((h) => h.weekday === wd);
              return (
                <div key={wd} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-24 text-sm font-bold">{WEEKDAYS[wd]}</div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {!list.length && <span className="text-sm text-slate-400">Chiuso</span>}
                    {list.map((h) => (
                      <div key={h.i} className="flex items-center gap-1 rounded-xl bg-brand-cream px-2 py-1">
                        <input type="time" step={300} className="input w-[104px] py-1" value={h.startTime} onChange={(e) => upd(h.i, "startTime", e.target.value)} />
                        <span>–</span>
                        <input type="time" step={300} className="input w-[104px] py-1" value={h.endTime} onChange={(e) => upd(h.i, "endTime", e.target.value)} />
                        <button className="btn-ghost btn-sm text-red-600" onClick={() => setHours(hours.filter((_, j) => j !== h.i))} aria-label="Rimuovi fascia"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => setHours([...hours, { weekday: wd, startTime: list.length ? "15:00" : "09:00", endTime: list.length ? "19:00" : "13:00" }])}><Plus size={14} /> Fascia</button>
                </div>
              );
            })}
          </div>
          <button className="btn-primary mt-4" disabled={busy} onClick={() => run(() => put("admin/hours", { hours }), "Orario salvato").then(reload)}>Salva orario</button>
        </section>

        <section className="card">
          <h2 className="text-2xl">Ferie, assenze e chiusure</h2>
          <p className="text-xs text-slate-500">Gli orari interessati non saranno prenotabili. Le festività nazionali sono bloccate automaticamente (modificabile in Impostazioni).</p>
          <div className="mt-4 grid gap-3 rounded-2xl bg-brand-cream p-4 sm:grid-cols-2">
            <Field label="Tipo"><select className="input" value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value })}>{CLOSURE_KINDS.map((k) => <option key={k} value={k}>{CLOSURE_LABELS[k]}</option>)}</select></Field>
            <Field label="Note"><input className="input" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} /></Field>
            <Field label="Dal"><input type="date" className="input" value={c.startDay} onChange={(e) => setC({ ...c, startDay: e.target.value, endDay: e.target.value > c.endDay ? e.target.value : c.endDay })} /></Field>
            <Field label="Al"><input type="date" className="input" value={c.endDay} min={c.startDay} onChange={(e) => setC({ ...c, endDay: e.target.value })} /></Field>
            <Field label="Dalle ore" hint="Vuoto = giornata intera"><input type="time" className="input" value={c.startTime} onChange={(e) => setC({ ...c, startTime: e.target.value })} /></Field>
            <Field label="Alle ore"><input type="time" className="input" value={c.endTime} onChange={(e) => setC({ ...c, endTime: e.target.value })} /></Field>
            <button className="btn-primary sm:col-span-2" disabled={busy} onClick={() => run(() => post<any>("admin/closures", c), "Chiusura inserita").then((r) => { if (r) { reload(); if (r.affected.length) setAffected(r.affected); } })}><CalendarOff size={16} /> Aggiungi</button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {!data.closures.length && <Empty>Nessuna chiusura in programma.</Empty>}
            {data.closures.map((x: any) => (
              <div key={x.id} className={`flex items-center gap-3 py-2.5 text-sm ${x.endDay < todayRome() ? "opacity-50" : ""}`}>
                <span className="badge bg-brand-mist text-brand-deep">{CLOSURE_LABELS[x.kind]}</span>
                <div className="flex-1">{fmtDate(x.startDay)}{x.endDay !== x.startDay && ` → ${fmtDate(x.endDay)}`}{x.startTime && ` · ${x.startTime}–${x.endTime}`}{x.note && <span className="text-slate-500"> · {x.note}</span>}</div>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => run(() => del(`admin/closures/${x.id}`), "Rimossa").then(reload)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
      {affected && (
        <Modal title="Appuntamenti nel periodo di chiusura" onClose={() => setAffected(null)}>
          <p className="text-sm text-slate-600">Questi appuntamenti cadono nel periodo appena chiuso: spostali o annullali dall'agenda.</p>
          <ul className="mt-3 space-y-1 text-sm">{affected.map((a) => <li key={a.id}><b>{fmtDateTime(a.startsAt)}</b> – {fullName(a)}</li>)}</ul>
        </Modal>
      )}
    </>
  );
}
