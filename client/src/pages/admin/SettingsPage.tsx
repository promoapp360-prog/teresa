import React, { createContext, useContext, useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCw } from "lucide-react";
import { put, post } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useSite } from "@/lib/site";
import { useLoad, Spinner, ErrorBox, Field, Check, PageTitle, Tabs, useAction } from "@/components/ui";

type S = Record<string, any>;

const Ctx = createContext<{ val: (p: string) => any; setVal: (p: string, v: any) => void }>({ val: () => "", setVal: () => {} });

function T({ path, label, hint, rows, type = "text", className = "" }: { path: string; label: string; hint?: string; rows?: number; type?: string; className?: string }) {
  const { val, setVal } = useContext(Ctx);
  return (
    <Field label={label} hint={hint} className={className}>
      {rows ? <textarea className="input" rows={rows} value={val(path) ?? ""} onChange={(e) => setVal(path, e.target.value)} />
        : <input className="input" type={type} value={val(path) ?? ""} onChange={(e) => setVal(path, type === "number" ? Number(e.target.value) : e.target.value)} />}
    </Field>
  );
}

export default function SettingsPage() {
  const { me } = useAuth();
  const site = useSite();
  const { data, error, loading, reload } = useLoad<{ settings: S; system: S }>("admin/settings");
  const [s, setS] = useState<S | null>(null);
  const [tab, setTab] = useState("studio");
  const { busy, run } = useAction();
  useEffect(() => { if (data) setS(structuredClone(data.settings)); }, [data]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  if (!s) return null;

  const val = (path: string) => path.split(".").reduce((o: any, k) => o?.[k], s);
  const setVal = (path: string, v: any) => setS((prev) => {
    const next = structuredClone(prev!);
    const keys = path.split(".");
    let o: any = next;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys[keys.length - 1]] = v;
    return next;
  });
  const save = () => run(() => put("admin/settings", s), "Impostazioni salvate").then(() => { reload(); site.reload(); });

  const tabs = [
    { id: "studio", label: "Studio e contatti" }, { id: "sito", label: "Testi del sito" }, { id: "prenotazioni", label: "Prenotazioni e promemoria" },
    { id: "email", label: "Testi delle email" }, { id: "legale", label: "Privacy e SEO" }, { id: "sistema", label: "Sistema" },
  ];

  return (
    <Ctx.Provider value={{ val, setVal }}>
      <PageTitle title="Impostazioni" actions={tab !== "sistema" && <button className="btn-primary" disabled={busy} onClick={save}>Salva le modifiche</button>} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="card mt-5">
        {tab === "studio" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <T path="studio.name" label="Nome dello studio" />
            <T path="studio.doctorName" label="Nome della Dottoressa" />
            <T path="studio.doctorTitle" label="Titolo" />
            <T path="studio.tagline" label="Specializzazioni (riga sotto il nome)" />
            <T path="studio.address" label="Indirizzo" />
            <div className="grid grid-cols-[1fr_2fr] gap-3"><T path="studio.postalCode" label="CAP" /><T path="studio.city" label="Città" /></div>
            <T path="studio.phone" label="Telefono" type="tel" />
            <T path="studio.whatsapp" label="WhatsApp" type="tel" hint="Numero per il pulsante WhatsApp" />
            <T path="studio.email" label="Email dello studio" type="email" />
            <T path="studio.hoursText" label="Orari (testo per il sito)" />
            <T path="studio.mapsUrl" label="Link Google Maps" />
            <T path="studio.mapsEmbedUrl" label="Link mappa incorporata" hint="Google Maps › Condividi › Incorpora una mappa › copia solo l'indirizzo src" />
            <T path="studio.registrationInfo" label="Iscrizione all'Ordine dei Medici" hint="Es. Iscritta all'Ordine dei Medici di … n. …" />
            <T path="studio.vatNumber" label="Partita IVA" />
          </div>
        )}
        {tab === "sito" && (
          <div className="grid gap-4">
            <T path="home.heroTitle" label="Titolo della home" />
            <T path="home.heroText" label="Testo della home" rows={3} />
            <div className="grid gap-4 sm:grid-cols-2"><T path="home.approachTitle" label="Titolo sezione metodo" /><T path="doctor.photoUrl" label="Foto della Dottoressa (URL immagine)" hint="Lascia vuoto per il monogramma" /></div>
            <T path="home.approachText" label="Testo sezione metodo" rows={3} />
            <T path="doctor.bio" label="Profilo della Dottoressa" rows={8} />
            <T path="doctor.qualifications" label="Formazione (una voce per riga)" rows={5} />
          </div>
        )}
        {tab === "prenotazioni" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2">
              <Check checked={val("booking.enabled")} onChange={(v) => setVal("booking.enabled", v)} label="Prenotazioni online attive" />
              <Check checked={val("booking.autoConfirm")} onChange={(v) => setVal("booking.autoConfirm", v)} label="Conferma automatica (altrimenti le richieste vanno confermate dal pannello)" />
              <Check checked={val("booking.autoHolidays")} onChange={(v) => setVal("booking.autoHolidays", v)} label="Blocca automaticamente le festività nazionali" />
              <Check checked={val("reminders.enabled")} onChange={(v) => setVal("reminders.enabled", v)} label="Invia promemoria automatici via email" />
            </div>
            <T path="reminders.hoursBefore" label="Promemoria: ore prima dell'appuntamento" type="number" />
            <T path="booking.slotStepMin" label="Intervallo tra gli orari proposti (minuti)" type="number" />
            <T path="booking.minNoticeHours" label="Preavviso minimo per prenotare (ore)" type="number" />
            <T path="booking.maxDaysAhead" label="Prenotabile fino a (giorni)" type="number" />
            <T path="booking.cancelMinHours" label="Annullamento online fino a (ore prima)" type="number" />
            <T path="booking.notifyEmail" label="Email per le notifiche delle nuove richieste" type="email" hint="Se vuota si usa l'email dello studio" />
            <T path="booking.notice" label="Avviso nella pagina di prenotazione" rows={2} className="sm:col-span-2" />
          </div>
        )}
        {tab === "email" && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">Segnaposto disponibili: <code>{"{nome} {prestazione} {data} {ora} {studio} {indirizzo} {link}"}</code></p>
            {[["requestReceived", "Richiesta ricevuta"], ["confirmed", "Conferma appuntamento"], ["reminder", "Promemoria"], ["cancelled", "Annullamento"]].map(([k, l]) => (
              <div key={k} className="grid gap-3 border-b border-slate-100 pb-5">
                <div className="font-display text-2xl text-brand-deep">{l}</div>
                <T path={`emails.${k}.subject`} label="Oggetto" />
                <T path={`emails.${k}.body`} label="Testo" rows={7} />
              </div>
            ))}
          </div>
        )}
        {tab === "legale" && (
          <div className="grid gap-4">
            <T path="seo.title" label="Titolo per Google" />
            <T path="seo.description" label="Descrizione per Google" rows={2} />
            <T path="legal.disclaimer" label="Avvertenza (piè di pagina)" rows={2} />
            <T path="legal.bookingConsentText" label="Testo del consenso privacy nella prenotazione" rows={2} />
            <T path="legal.privacyPolicy" label="Informativa privacy" rows={12} hint="Testo a cura del Titolare del trattamento (lo Studio)" />
            <T path="legal.cookiePolicy" label="Cookie policy" rows={5} />
            {me?.role === "doctor" && <Check checked={val("security.require2faForClinical")} onChange={(v) => setVal("security.require2faForClinical", v)} label="Richiedi l'autenticazione a due fattori per accedere alla cartella clinica" />}
          </div>
        )}
        {tab === "sistema" && <SystemTab system={data!.system} />}
      </div>
    </Ctx.Provider>
  );
}

function SystemTab({ system }: { system: S }) {
  const emails = useLoad<any[]>("admin/emails");
  const { run } = useAction();
  const Row = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
    <div className="flex gap-3 py-2">{ok ? <CheckCircle2 className="text-emerald-600" size={20} /> : <XCircle className="text-amber-500" size={20} />}<div><div className="font-bold">{label}</div><div className="text-xs text-slate-500">{hint}</div></div></div>
  );
  return (
    <div className="space-y-6">
      <div className="divide-y divide-slate-100">
        <Row ok={system.smtp} label="Invio email (SMTP)" hint={system.smtp ? "Configurato: conferme e promemoria vengono inviati." : "Imposta SMTP_HOST, SMTP_USER, SMTP_PASS e MAIL_FROM nei Secrets di Replit. Fino ad allora le email risultano 'simulate'."} />
        <Row ok={system.encryption} label="Cifratura dei documenti clinici" hint={system.encryption ? "Attiva (AES-256-GCM)." : "Imposta FILES_ENCRYPTION_KEY nei Secrets prima di caricare referti."} />
        <Row ok={!!system.publicUrl} label="Indirizzo pubblico del sito" hint={system.publicUrl || "Imposta PUBLIC_URL (es. https://www.dominio.it) per i link nelle email e nella sitemap."} />
        <Row ok={system.cron} label="Promemoria garantiti con pubblicazione Autoscale" hint={system.cron ? "CRON_SECRET impostato: un servizio esterno può richiamare /api/cron." : "Facoltativo: con Autoscale l'app si sospende senza visite; per promemoria sempre puntuali usa una pubblicazione Reserved VM oppure imposta CRON_SECRET."} />
      </div>
      <div>
        <h3 className="text-2xl">Ultime email</h3>
        <div className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-slate-100">
          <table className="tbl">
            <thead><tr><th>Data</th><th>Destinatario</th><th>Oggetto</th><th>Stato</th><th /></tr></thead>
            <tbody>{(emails.data || []).map((m) => (
              <tr key={m.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(m.createdAt)}</td><td className="text-xs">{m.toEmail}</td><td className="text-xs">{m.subject}</td>
                <td><span className={`badge ${m.status === "sent" ? "bg-emerald-100 text-emerald-800" : m.status === "failed" ? "bg-red-100 text-red-700" : m.status === "simulated" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{{ sent: "inviata", failed: "non inviata", simulated: "simulata", pending: "in coda" }[m.status as string]}</span>{m.lastError && <div className="text-[10px] text-red-600">{m.lastError}</div>}</td>
                <td>{["failed", "simulated"].includes(m.status) && system.smtp && <button className="btn-ghost btn-sm" onClick={() => run(() => post(`admin/emails/${m.id}/retry`), "Rimessa in coda").then(emails.reload)}><RotateCw size={13} /></button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
