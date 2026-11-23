import React, { useState } from "react";
import { Link } from "wouter";
import { CalendarX, CalendarCheck } from "lucide-react";
import { post } from "@/lib/api";
import { fmtLongDay } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, StatusBadge, useAction } from "@/components/ui";

export default function ManageBooking({ token }: { token: string }) {
  const { data, error, loading, reload } = useLoad<any>(`public/bookings/${token}`);
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  if (loading) return <Spinner />;
  if (error || !data) return <section className="wrap max-w-xl py-20"><ErrorBox text={error || "Prenotazione non trovata"} /></section>;
  const active = ["requested", "confirmed"].includes(data.status);
  return (
    <section className="wrap max-w-xl py-16">
      <p className="eyebrow">La tua prenotazione</p>
      <h1 className="mt-2 text-4xl">Gentile {data.firstName}</h1>
      <div className="card mt-6 space-y-2">
        <div className="text-xl font-bold text-brand-deep">{data.serviceName}</div>
        <div className="text-slate-600">{fmtLongDay(data.day)} alle {data.time}</div>
        <StatusBadge status={data.status} />
      </div>
      {active && data.canCancel && (
        !confirm
          ? <button className="btn-outline mt-6" onClick={() => setConfirm(true)}><CalendarX size={16} /> Annulla l'appuntamento</button>
          : <div className="card mt-6 border-red-200">
              <p className="text-sm">Vuoi davvero annullare l'appuntamento? Lo studio riceverà una notifica.</p>
              <div className="mt-4 flex gap-2">
                <button className="btn-danger" disabled={busy} onClick={() => run(() => post(`public/bookings/${token}/cancel`), "Appuntamento annullato").then(() => { setConfirm(false); reload(); })}>Sì, annulla</button>
                <button className="btn-ghost" onClick={() => setConfirm(false)}>No</button>
              </div>
            </div>
      )}
      {active && !data.canCancel && <p className="mt-6 text-sm text-slate-600">L'annullamento online è possibile fino a {data.cancelMinHours} ore prima. Per modifiche contatta lo studio.</p>}
      <div className="mt-8 flex gap-2">
        <Link href="/prenota" className="btn-primary"><CalendarCheck size={16} /> Nuova prenotazione</Link>
        <Link href="/contatti" className="btn-ghost">Contatti</Link>
      </div>
    </section>
  );
}
