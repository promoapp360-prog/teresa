import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { useSite, type Service } from "@/lib/site";
import { get, post } from "@/lib/api";
import { addDays, fmtLongDay, todayRome, fmtMoney } from "@/lib/format";
import { Check, ErrorBox, Field } from "@/components/ui";
import { AreaIcon } from "./Layout";

type Day = { day: string; slots: string[] };

export default function Booking() {
  const { site } = useSite();
  const params = new URLSearchParams(useSearch());
  const s = site!.settings;
  const bookable = site!.services.filter((x) => x.bookable);
  const initial = bookable.find((x) => x.slug === params.get("servizio")) || null;
  const [area, setArea] = useState<number | null>(initial?.categoryId ?? site!.categories.find((c) => c.slug === params.get("area"))?.id ?? null);
  const [service, setService] = useState<Service | null>(initial);
  const [from, setFrom] = useState(todayRome());
  const [days, setDays] = useState<Day[] | null>(null);
  const [maxDay, setMaxDay] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", birthDate: "", notes: "", website: "" });
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string } | null>(null);

  useEffect(() => {
    if (!service) return;
    setDays(null);
    get<{ days: Day[]; maxDay: string }>(`public/availability?serviceId=${service.id}&from=${from}&days=14`).then((r) => {
      setDays(r.days); setMaxDay(r.maxDay);
      if (!day || !r.days.some((d) => d.day === day && d.slots.length)) { const first = r.days.find((d) => d.slots.length); setDay(first?.day || null); setTime(null); }
    }).catch((e) => setErr(e.message));
  }, [service?.id, from]); // eslint-disable-line

  const slots = useMemo(() => days?.find((d) => d.day === day)?.slots || [], [days, day]);
  const step = !service ? 1 : !time ? 2 : 3;

  if (!s.booking.enabled) {
    return <section className="wrap max-w-2xl py-20 text-center"><h1 className="text-4xl">Prenotazioni online sospese</h1><p className="mt-4 text-slate-600">Per fissare un appuntamento contatta lo studio.</p><Link href="/contatti" className="btn-primary mt-6">Contatti</Link></section>;
  }

  if (done) {
    return (
      <section className="wrap max-w-2xl py-20 text-center">
        <CheckCircle2 size={56} className="mx-auto text-brand-sage" />
        <h1 className="mt-4 text-4xl">{done.status === "confirmed" ? "Appuntamento confermato" : "Richiesta inviata"}</h1>
        <p className="mt-4 text-lg text-slate-600">
          {service?.name} · {day && fmtLongDay(day)} alle {time}.<br />
          {done.status === "confirmed" ? "Ti abbiamo inviato la conferma via email." : "Riceverai un'email di conferma appena lo studio avrà verificato la richiesta."}
        </p>
        <Link href="/" className="btn-outline mt-8">Torna al sito</Link>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!privacy) return setErr("Per proseguire è necessario accettare l'informativa privacy.");
    setBusy(true);
    try {
      const r = await post<{ status: string }>("public/bookings", { ...form, serviceId: service!.id, day, time, privacy: true });
      setDone(r);
    } catch (e2) {
      setErr((e2 as Error).message);
      if (/non è più disponibile/.test((e2 as Error).message)) { setTime(null); setFrom((f) => f); setDays(null); get<{ days: Day[] }>(`public/availability?serviceId=${service!.id}&from=${from}&days=14`).then((r) => setDays(r.days)); }
    } finally { setBusy(false); }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="wrap max-w-4xl py-12 md:py-16">
      <p className="eyebrow">Prenotazione online</p>
      <h1 className="mt-2 text-5xl">Prenota una visita</h1>
      <p className="mt-3 max-w-2xl text-slate-600">{s.booking.notice}</p>

      <ol className="mt-8 flex gap-2 text-xs font-bold">
        {["Prestazione", "Giorno e ora", "I tuoi dati"].map((l, i) => (
          <li key={l} className={`flex-1 rounded-full px-3 py-2 text-center ${step > i ? "bg-brand-deep text-white" : step === i + 1 ? "bg-brand-mist text-brand-deep" : "bg-white text-slate-400"}`}>{i + 1}. {l}</li>
        ))}
      </ol>

      {/* 1. prestazione */}
      <div className="card mt-6">
        <h2 className="text-2xl">1. Scegli la prestazione</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {site!.categories.map((c) => (
            <button key={c.id} type="button" onClick={() => { setArea(c.id); if (service?.categoryId !== c.id) { setService(null); setTime(null); } }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${area === c.id ? "border-brand-deep bg-brand-deep text-white" : "border-brand-sand bg-white text-brand-deep hover:border-brand-sage"}`}>
              <AreaIcon name={c.icon} size={16} /> {c.name}
            </button>
          ))}
        </div>
        {area && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {bookable.filter((x) => x.categoryId === area).map((x) => (
              <button key={x.id} type="button" onClick={() => { setService(x); setTime(null); setFrom(todayRome()); }}
                className={`rounded-2xl border p-4 text-left transition ${service?.id === x.id ? "border-brand-deep bg-brand-mist" : "border-slate-200 bg-white hover:border-brand-sage"}`}>
                <div className="font-bold text-brand-deep">{x.name}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock size={13} /> {x.durationMin} min{x.priceCents != null && ` · ${fmtMoney(x.priceCents)}`}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. giorno e ora */}
      {service && (
        <div className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl">2. Scegli giorno e orario</h2>
            <div className="flex gap-1">
              <button className="btn-ghost btn-sm" disabled={from <= todayRome()} onClick={() => setFrom(addDays(from, -14) < todayRome() ? todayRome() : addDays(from, -14))} aria-label="Settimane precedenti"><ChevronLeft size={18} /></button>
              <button className="btn-ghost btn-sm" disabled={!!maxDay && addDays(from, 14) > maxDay} onClick={() => setFrom(addDays(from, 14))} aria-label="Settimane successive"><ChevronRight size={18} /></button>
            </div>
          </div>
          {!days ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Verifico le disponibilità…</div> : (
            <>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {days.map((d) => {
                  const [, , dd] = d.day.split("-");
                  const label = fmtLongDay(d.day).split(" ");
                  const has = d.slots.length > 0;
                  return (
                    <button key={d.day} type="button" disabled={!has} onClick={() => { setDay(d.day); setTime(null); }}
                      className={`rounded-xl border px-1 py-2 text-center transition ${day === d.day ? "border-brand-deep bg-brand-deep text-white" : has ? "border-slate-200 bg-white hover:border-brand-sage" : "border-transparent bg-slate-50 text-slate-300"}`}>
                      <div className="text-[10px] font-bold uppercase">{label[0].slice(0, 3)}</div>
                      <div className="font-display text-2xl leading-tight">{Number(dd)}</div>
                      <div className="text-[10px]">{label[2]?.slice(0, 3)}</div>
                    </button>
                  );
                })}
              </div>
              {!days.some((d) => d.slots.length) && <p className="mt-4 text-sm text-slate-500">Nessuna disponibilità in queste due settimane: prova con le successive.</p>}
              {day && slots.length > 0 && (
                <div className="mt-5">
                  <div className="label">{fmtLongDay(day)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((t) => (
                      <button key={t} type="button" onClick={() => setTime(t)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold transition ${time === t ? "border-brand-bronze bg-brand-bronze text-white" : "border-slate-200 bg-white text-brand-deep hover:border-brand-sage"}`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. dati */}
      {service && day && time && (
        <form onSubmit={submit} className="card mt-4 space-y-4">
          <h2 className="text-2xl">3. I tuoi dati</h2>
          <div className="rounded-xl bg-brand-mist px-4 py-3 text-sm font-semibold text-brand-deep"><CalendarCheck size={16} className="mr-1 inline" /> {service.name} · {fmtLongDay(day)} alle {time}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *"><input className="input" required maxLength={80} autoComplete="given-name" value={form.firstName} onChange={set("firstName")} /></Field>
            <Field label="Cognome *"><input className="input" required maxLength={80} autoComplete="family-name" value={form.lastName} onChange={set("lastName")} /></Field>
            <Field label="Email *"><input className="input" required type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Telefono *"><input className="input" required type="tel" autoComplete="tel" minLength={6} value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Data di nascita"><input className="input" type="date" value={form.birthDate} onChange={set("birthDate")} /></Field>
          </div>
          <Field label="Note per lo studio" hint="Facoltativo. Non inserire qui dati clinici dettagliati: ne parlerai durante la visita."><textarea className="input" rows={3} maxLength={1000} value={form.notes} onChange={set("notes")} /></Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={set("website")} aria-hidden />
          <Check checked={privacy} onChange={setPrivacy} label={<>{s.legal.bookingConsentText} <Link href="/privacy" className="font-bold text-brand-deep underline">Informativa privacy</Link></>} />
          {err && <ErrorBox text={err} />}
          <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : <CalendarCheck size={16} />} {s.booking.autoConfirm ? "Conferma la prenotazione" : "Invia la richiesta"}</button>
        </form>
      )}
      {err && step < 3 && <div className="mt-4"><ErrorBox text={err} /></div>}
    </section>
  );
}
