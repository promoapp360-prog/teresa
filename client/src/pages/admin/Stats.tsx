import React, { useState } from "react";
import { addDays, fmtMoney, todayRome } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, Field, PageTitle } from "@/components/ui";
import { Bars } from "@/components/LineChart";
import { STATUS_LABELS } from "@shared/constants";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export default function Stats() {
  const [from, setFrom] = useState(addDays(todayRome(), -180).slice(0, 8) + "01");
  const [to, setTo] = useState(todayRome());
  const { data, error, loading } = useLoad<any>(`admin/stats?from=${from}&to=${to}`);
  const total = (data?.byStatus || []).reduce((s: number, x: any) => s + x.n, 0);
  const n = (st: string) => data?.byStatus.find((x: any) => x.status === st)?.n || 0;
  const maxMonth = Math.max(1, ...(data?.byMonth || []).map((m: any) => m.done + m.lost));
  return (
    <>
      <PageTitle title="Statistiche" subtitle="Andamento dell'attività dello studio" />
      <div className="mb-5 flex flex-wrap gap-3">
        <Field label="Dal"><input type="date" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label="Al"><input type="date" className="input" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
        <div className="flex items-end gap-1">
          {[["30 gg", 30], ["3 mesi", 90], ["12 mesi", 365]].map(([l, d]) => <button key={l} className="btn-outline btn-sm" onClick={() => { setFrom(addDays(todayRome(), -(d as number))); setTo(todayRome()); }}>{l}</button>)}
        </div>
      </div>
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[["Appuntamenti", total], ["Eseguiti", n("completed")], ["Annullati", n("cancelled")], ["Non presentati", n("no_show")], ["Nuovi pazienti", data.newPatients]].map(([l, v]) => (
              <div key={l as string} className="card"><div className="font-display text-4xl text-brand-deep">{v}</div><div className="text-xs font-semibold text-slate-500">{l}</div></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="text-2xl">Andamento mensile</h2>
              <div className="mt-4 flex h-48 items-end gap-2">
                {data.byMonth.map((m: any) => {
                  const [y, mm] = m.month.split("-");
                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.done} eseguiti/confermati, ${m.lost} persi`}>
                      <div className="flex w-full flex-col justify-end" style={{ height: 160 }}>
                        <div className="w-full rounded-t bg-red-200" style={{ height: (m.lost / maxMonth) * 160 }} />
                        <div className="w-full bg-brand-sage" style={{ height: (m.done / maxMonth) * 160 }} />
                      </div>
                      <div className="text-[10px] text-slate-500">{MONTHS[Number(mm) - 1]} {y.slice(2)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 bg-brand-sage" />Confermati/eseguiti</span><span><span className="mr-1 inline-block h-2 w-2 bg-red-200" />Annullati/non presentati</span></div>
            </section>
            <section className="card">
              <h2 className="text-2xl">Prestazioni più richieste</h2>
              <div className="mt-4"><Bars rows={data.byService.map((s: any) => ({ label: s.serviceName, value: s.n }))} /></div>
            </section>
            <section className="card">
              <h2 className="text-2xl">Per specializzazione</h2>
              <div className="mt-4"><Bars rows={data.byCategory.map((s: any) => ({ label: s.name, value: s.n }))} /></div>
              <div className="mt-6 text-sm text-slate-600">Prenotazioni online: <b>{data.bySource.find((x: any) => x.source === "online")?.n || 0}</b> · inserite dallo studio: <b>{data.bySource.find((x: any) => x.source === "studio")?.n || 0}</b></div>
            </section>
            <section className="card">
              <h2 className="text-2xl">Importi registrati</h2>
              <div className="mt-2 font-display text-5xl text-brand-deep">{fmtMoney(data.amountCents)}</div>
              <p className="text-xs text-slate-500">Somma degli importi inseriti sugli appuntamenti eseguiti nel periodo (dato gestionale, non contabile).</p>
              <div className="mt-4"><Bars rows={data.byMonth.map((m: any) => ({ label: m.month, value: m.amount }))} format={(v) => fmtMoney(v)} /></div>
              <div className="mt-4 text-xs text-slate-500">{Object.entries(STATUS_LABELS).map(([k, l]) => `${l}: ${n(k)}`).join(" · ")}</div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
