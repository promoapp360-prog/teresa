import React, { useState } from "react";
import { Plus, Pencil, Copy, Printer } from "lucide-react";
import { post, patch } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, Modal, Field, Check, PageTitle, useAction, Empty } from "@/components/ui";
import { TREATMENT_AREAS } from "@shared/constants";

export default function ConsentTemplates() {
  const { data, error, loading, reload } = useLoad<any[]>("clinical/consent-templates");
  const [edit, setEdit] = useState<any | null>(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const nextVersion = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? (Math.floor(n) + 1).toFixed(1) : `${v}-2`; };
  return (
    <>
      <PageTitle title="Modelli di consenso" subtitle="Testi dei consensi informati per procedura, con gestione delle versioni"
        actions={<button className="btn-primary" onClick={() => setEdit({ version: "1.0", active: true, area: TREATMENT_AREAS[0] })}><Plus size={16} /> Nuovo modello</button>} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">I testi caricati sono bozze di partenza: vanno redatti e approvati dallo Studio prima dell'uso con i pazienti.</div>
      <div className="mt-4 space-y-3">
        {!data!.length && <Empty>Nessun modello.</Empty>}
        {data!.map((t) => (
          <div key={t.id} className={`card flex flex-wrap items-center gap-3 ${t.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1"><b>{t.name}</b> <span className="badge bg-brand-mist text-brand-deep">v{t.version}</span> {!t.active && <span className="badge bg-slate-100 text-slate-500">non attivo</span>}
              <div className="text-xs text-slate-500">{t.area} · creato il {fmtDate(t.createdAt)} · firmato da {t.uses} pazienti</div></div>
            <a className="btn-ghost btn-sm" href={`/api/clinical/consent-templates/${t.id}/pdf`} target="_blank" rel="noreferrer"><Printer size={14} /> Modulo vuoto</a>
            {t.uses > 0
              ? <button className="btn-outline btn-sm" onClick={() => setEdit({ name: t.name, area: t.area, body: t.body, version: nextVersion(t.version), active: true, from: t })}><Copy size={14} /> Nuova versione</button>
              : <button className="btn-outline btn-sm" onClick={() => setEdit(t)}><Pencil size={14} /> Modifica</button>}
          </div>
        ))}
      </div>
      {edit && <TemplateForm t={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function TemplateForm({ t, onClose, onSaved }: { t: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: t.name || "", area: t.area || "", version: t.version || "1.0", body: t.body || "", active: t.active !== false });
  const { busy, run } = useAction();
  const save = () => run(async () => {
    if (t.id) return patch(`clinical/consent-templates/${t.id}`, t.uses ? { active: f.active } : f);
    const r = await post("clinical/consent-templates", f);
    if (t.from) await patch(`clinical/consent-templates/${t.from.id}`, { active: false }); // la versione precedente non si usa più per i nuovi consensi
    return r;
  }, "Modello salvato").then((r) => r && onSaved());
  return (
    <Modal title={t.id ? "Modifica modello" : t.from ? `Nuova versione di “${t.name}”` : "Nuovo modello"} wide onClose={onClose} footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy || f.name.length < 2 || f.body.length < 10} onClick={save}>Salva</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nome" className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Versione"><input className="input" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
        <Field label="Ambito"><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{TREATMENT_AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
        <div className="pt-6 sm:col-span-2"><Check checked={f.active} onChange={(x) => setF({ ...f, active: x })} label="Attivo (selezionabile per nuovi consensi)" /></div>
        <Field label="Testo del consenso" className="sm:col-span-3"><textarea className="input font-mono text-xs" rows={16} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
