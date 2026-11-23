import React from "react";
import { Link } from "wouter";
import { AlertTriangle, CalendarClock, Inbox, Phone, CalendarOff, ClipboardCheck, Check, X } from "lucide-react";
import { patch } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtTime, fullName, fmtLongDay } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLoad, Spinner, ErrorBox, StatusBadge, Empty, PageTitle, useAction } from "@/components/ui";
import { CLOSURE_LABELS } from "@shared/constants";

export default function Dashboard() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useLoad<any>("admin/dashboard");
  const { run, busy } = useAction();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const d = data!;
  const setStatus = (id: number, status: string) => run(() => patch(`admin/appointments/${id}`, { status }), status === "confirmed" ? "Appuntamento confermato: email inviata al paziente" : "Richiesta rifiutata").then(reload);
  const hello = new Date().getHours() < 13 ? "Buongiorno" : "Buonasera";

  return (
    <>
      <PageTitle title={`${hello}${me?.role === "doctor" ? ", Dottoressa" : ""}`} subtitle={fmtLongDay(d.today)} actions={<Link href="/agenda" className="btn-primary">Apri l'agenda</Link>} />

      {d.warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {d.warnings.map((w: string, i: number) => <div key={i} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {w}</div>)}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarClock} label="Appuntamenti oggi" value={d.todayAppts.length} />
        <Stat icon={Inbox} label="Richieste da confermare" value={d.requests.length} highlight={d.requests.length > 0} />
        <Stat icon={ClipboardCheck} label="Prossimi 7 giorni" value={d.weekCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-2xl">Oggi</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {d.todayAppts.length === 0 && <Empty>Nessun appuntamento oggi.</Empty>}
            {d.todayAppts.map((a: any) => (
              <Link key={a.id} href={`/pazienti/${a.patientId}`} className="flex items-center gap-3 py-3 hover:bg-brand-cream/50">
                <div className="w-14 font-display text-2xl text-brand-deep">{fmtTime(a.startsAt)}</div>
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{fullName(a)}</div><div className="truncate text-xs text-slate-500">{a.serviceName}</div></div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl">Richieste online da confermare</h2>
          <div className="mt-3 space-y-3">
            {d.requests.length === 0 && <Empty>Nessuna richiesta in attesa.</Empty>}
            {d.requests.map((a: any) => (
              <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/pazienti/${a.patientId}`} className="font-bold hover:underline">{fullName(a)}</Link>
                    <div className="text-sm text-slate-600">{a.serviceName} · <b>{fmtDateTime(a.startsAt)}</b></div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">{a.phone && <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1"><Phone size={12} /> {a.phone}</a>}<span>{a.email}</span></div>
                    {a.patientNotes && <p className="mt-1 text-xs italic text-slate-600">“{a.patientNotes}”</p>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-primary btn-sm" disabled={busy} onClick={() => setStatus(a.id, "confirmed")}><Check size={14} /> Conferma</button>
                    <button className="btn-outline btn-sm" disabled={busy} onClick={() => { if (confirm("Rifiutare la richiesta? Il paziente riceverà un'email di annullamento.")) setStatus(a.id, "cancelled"); }}><X size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {me?.role === "doctor" && (
          <section className="card">
            <h2 className="text-2xl">Controlli e scadenze</h2>
            <p className="text-xs text-slate-500">Cicli attivi e controlli programmati nei prossimi 14 giorni (o scaduti).</p>
            <div className="mt-3 divide-y divide-slate-100">
              {d.checks.length === 0 && <Empty>Nessun controllo in scadenza.</Empty>}
              {d.checks.map((c: any) => (
                <Link key={`${c.kind}-${c.id}`} href={`/pazienti/${c.patientId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-brand-cream/50">
                  <div><b>{fullName(c)}</b><div className="text-xs text-slate-500">{c.kind === "ciclo" ? "Ciclo: " : "Controllo: "}{c.title}</div></div>
                  <span className={`badge ${c.due < d.today ? "bg-red-100 text-red-700" : "bg-brand-mist text-brand-deep"}`}>{fmtDate(c.due)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2 className="text-2xl">Chiusure in programma</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {d.closures.length === 0 && <Empty>Nessuna chiusura nei prossimi 30 giorni.</Empty>}
            {d.closures.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <CalendarOff size={16} className="text-brand-bronze" />
                <div className="flex-1"><b>{CLOSURE_LABELS[c.kind]}</b> {c.note && <span className="text-slate-500">– {c.note}</span>}</div>
                <span className="text-slate-600">{fmtDate(c.startDay)}{c.endDay !== c.startDay && ` → ${fmtDate(c.endDay)}`}{c.startTime && ` ${c.startTime.slice(0, 5)}–${c.endTime?.slice(0, 5)}`}</span>
              </div>
            ))}
          </div>
          <Link href="/disponibilita" className="btn-ghost btn-sm mt-2">Gestisci orari e chiusure</Link>
        </section>
      </div>
    </>
  );
}

function Stat({ icon: I, label, value, highlight }: { icon: any; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card flex items-center gap-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mist text-brand-deep"><I size={22} /></span>
      <div><div className="font-display text-4xl leading-none text-brand-deep">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{label}</div></div>
    </div>
  );
}
