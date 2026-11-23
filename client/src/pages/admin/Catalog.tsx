import React, { useState } from "react";
import { Plus, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { post, patch, del } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { useLoad, Spinner, ErrorBox, Modal, Field, MoneyInput, Check, PageTitle, useAction, Tabs } from "@/components/ui";

export default function Catalog() {
  const { data, error, loading, reload } = useLoad<any>("admin/catalog");
  const [tab, setTab] = useState("prestazioni");
  const [svc, setSvc] = useState<any | null>(null);
  const [cat, setCat] = useState<any | null>(null);
  const { run } = useAction();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  return (
    <>
      <PageTitle title="Prestazioni" subtitle="Catalogo pubblicato sul sito, durate per l'agenda e listino"
        actions={tab === "prestazioni"
          ? <button className="btn-primary" onClick={() => setSvc({ categoryId: data.categories[0]?.id, durationMin: 30, bookable: true, active: true, showPrice: false })}><Plus size={16} /> Nuova prestazione</button>
          : <button className="btn-primary" onClick={() => setCat({ active: true })}><Plus size={16} /> Nuova specializzazione</button>} />
      <Tabs tabs={[{ id: "prestazioni", label: "Prestazioni" }, { id: "aree", label: "Specializzazioni (pagine del sito)" }]} active={tab} onChange={setTab} />
      <div className="mt-5 space-y-6">
        {tab === "prestazioni" && data.categories.map((c: any) => (
          <section key={c.id} className="card overflow-x-auto">
            <h2 className="text-2xl">{c.name}</h2>
            <table className="tbl mt-3">
              <thead><tr><th>Prestazione</th><th>Durata</th><th>Tariffa</th><th>Online</th><th>Stato</th><th /></tr></thead>
              <tbody>
                {data.services.filter((s: any) => s.categoryId === c.id).map((s: any) => (
                  <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                    <td><b>{s.name}</b><div className="text-xs text-slate-500">{s.shortDescription}</div></td>
                    <td>{s.durationMin} min</td>
                    <td>{s.priceCents != null ? fmtMoney(s.priceCents) : "–"}{s.priceCents != null && !s.showPrice && <div className="text-[10px] text-slate-400">non pubblicata</div>}</td>
                    <td>{s.bookable ? "Sì" : "No"}</td>
                    <td>{s.active ? "Attiva" : "Nascosta"}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="btn-ghost btn-sm" onClick={() => setSvc(s)}><Pencil size={14} /></button>
                      <button className="btn-ghost btn-sm" title={s.active ? "Nascondi" : "Mostra"} onClick={() => run(() => patch(`admin/services/${s.id}`, { active: !s.active }), "Aggiornato").then(reload)}>{s.active ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      <button className="btn-ghost btn-sm text-red-600" onClick={() => { if (confirm(s.uses ? "La prestazione ha appuntamenti collegati: verrà nascosta. Continuare?" : "Eliminare la prestazione?")) run(() => del(`admin/services/${s.id}`), "Fatto").then(reload); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {tab === "aree" && data.categories.map((c: any) => (
          <section key={c.id} className="card flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl"><h2 className="text-2xl">{c.name} {!c.active && <span className="badge bg-slate-100 text-slate-500">nascosta</span>}</h2><p className="text-sm text-slate-600">{c.subtitle}</p><p className="mt-1 text-xs text-slate-400">Pagina: /{c.slug}</p></div>
            <button className="btn-outline btn-sm" onClick={() => setCat(c)}><Pencil size={14} /> Modifica testi</button>
          </section>
        ))}
      </div>
      {svc && <ServiceForm svc={svc} categories={data.categories} onClose={() => setSvc(null)} onSaved={() => { setSvc(null); reload(); }} />}
      {cat && <CategoryForm cat={cat} onClose={() => setCat(null)} onSaved={() => { setCat(null); reload(); }} />}
    </>
  );
}

function ServiceForm({ svc, categories, onClose, onSaved }: { svc: any; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ categoryId: svc.categoryId, name: svc.name || "", shortDescription: svc.shortDescription || "", description: svc.description || "", infoNotes: svc.infoNotes || "",
    durationMin: svc.durationMin || 30, priceCents: svc.priceCents ?? null, showPrice: !!svc.showPrice, bookable: svc.bookable !== false, active: svc.active !== false, sort: svc.sort ?? 0 });
  const { busy, run } = useAction();
  const save = () => run(() => (svc.id ? patch(`admin/services/${svc.id}`, f) : post("admin/services", f)), "Prestazione salvata").then((r) => r && onSaved());
  return (
    <Modal title={svc.id ? "Modifica prestazione" : "Nuova prestazione"} wide onClose={onClose} footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy || f.name.length < 2} onClick={save}>Salva</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Specializzazione"><select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: Number(e.target.value) })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Durata (minuti)" hint="Usata per calcolare gli orari disponibili"><input type="number" min={5} max={480} step={5} className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></Field>
        <Field label="Tariffa"><MoneyInput value={f.priceCents} onChange={(c) => setF({ ...f, priceCents: c })} /></Field>
        <Field label="Descrizione breve" className="sm:col-span-2"><input className="input" maxLength={300} value={f.shortDescription} onChange={(e) => setF({ ...f, shortDescription: e.target.value })} /></Field>
        <Field label="Scheda della prestazione" className="sm:col-span-2" hint="Righe vuote per separare i paragrafi; '- ' per gli elenchi."><textarea className="input" rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Indicazioni informative approvate dallo studio" className="sm:col-span-2"><textarea className="input" rows={3} value={f.infoNotes} onChange={(e) => setF({ ...f, infoNotes: e.target.value })} /></Field>
        <Field label="Ordine"><input type="number" className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <div className="space-y-2 pt-5">
          <Check checked={f.showPrice} onChange={(x) => setF({ ...f, showPrice: x })} label="Pubblica la tariffa sul sito" />
          <Check checked={f.bookable} onChange={(x) => setF({ ...f, bookable: x })} label="Prenotabile online" />
          <Check checked={f.active} onChange={(x) => setF({ ...f, active: x })} label="Visibile sul sito" />
        </div>
      </div>
    </Modal>
  );
}

function CategoryForm({ cat, onClose, onSaved }: { cat: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: cat.name || "", subtitle: cat.subtitle || "", intro: cat.intro || "", body: cat.body || "", icon: cat.icon || "activity", sort: cat.sort ?? 0, active: cat.active !== false });
  const { busy, run } = useAction();
  const save = () => run(() => (cat.id ? patch(`admin/categories/${cat.id}`, f) : post("admin/categories", f)), "Salvato").then((r) => r && onSaved());
  return (
    <Modal title={cat.id ? `Pagina ${cat.name}` : "Nuova specializzazione"} wide onClose={onClose} footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy} onClick={save}>Salva</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Icona"><select className="input" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}><option value="activity">Onda (dolore)</option><option value="wind">Aria (ozono)</option><option value="droplet">Goccia (IV)</option><option value="sparkles">Scintille (estetica)</option><option value="">Stetoscopio</option></select></Field>
        <Field label="Sottotitolo" className="sm:col-span-2"><input className="input" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></Field>
        <Field label="Introduzione" className="sm:col-span-2"><textarea className="input" rows={2} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} /></Field>
        <Field label="Testo della pagina" className="sm:col-span-2" hint="'## ' per i titoli, '- ' per gli elenchi, riga vuota tra i paragrafi."><textarea className="input" rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Ordine"><input type="number" className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <div className="pt-6"><Check checked={f.active} onChange={(x) => setF({ ...f, active: x })} label="Visibile sul sito" /></div>
      </div>
    </Modal>
  );
}
