import React, { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { post, patch, del } from "@/lib/api";
import { Modal, Field, Empty, useAction } from "./ui";

export type FieldDef = {
  key: string; label: string; type?: "text" | "textarea" | "date" | "number" | "select";
  options?: (string | { value: string | number; label: string })[]; required?: boolean; full?: boolean; hint?: string; list?: string[];
};
export type ColDef = { key: string; label: string; render?: (row: any) => React.ReactNode };

/** Elenco con inserimento/modifica/eliminazione per le tabelle collegate alla cartella. */
export function CrudList({ title, rows, fields, columns, createPath, itemPath, onChange, defaults = {}, emptyText = "Nessuna voce registrata.", addLabel = "Aggiungi" }:
  { title?: string; rows: any[]; fields: FieldDef[]; columns: ColDef[]; createPath: string; itemPath: (id: number) => string; onChange: () => void; defaults?: Record<string, any>; emptyText?: string; addLabel?: string }) {
  const [editing, setEditing] = useState<any | null>(null);
  const { busy, run } = useAction();

  const save = async (values: Record<string, any>) => {
    const r = await run(() => (editing?.id ? patch(itemPath(editing.id), values) : post(createPath, values)), "Salvato");
    if (r) { setEditing(null); onChange(); }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {title && <h3 className="text-2xl">{title}</h3>}
        <button className="btn-primary btn-sm ml-auto" onClick={() => setEditing({ ...defaults })}><Plus size={14} /> {addLabel}</button>
      </div>
      {!rows.length ? <Empty>{emptyText}</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
          <table className="tbl">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th className="w-20" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key] ?? ""}</td>)}
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(r)} aria-label="Modifica"><Pencil size={14} /></button>
                    <button className="btn-ghost btn-sm text-red-600" disabled={busy} aria-label="Elimina" onClick={() => { if (confirm("Eliminare questa voce?")) run(() => del(itemPath(r.id)), "Eliminato").then(onChange); }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CrudForm title={editing.id ? "Modifica" : addLabel} fields={fields} initial={editing} busy={busy} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

export function CrudForm({ title, fields, initial, onSave, onClose, busy }: { title: string; fields: FieldDef[]; initial: Record<string, any>; onSave: (v: Record<string, any>) => void; onClose: () => void; busy?: boolean }) {
  const [v, setV] = useState<Record<string, any>>(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ""])));
  const set = (k: string, val: any) => setV((x) => ({ ...x, [k]: val }));
  const missing = fields.some((f) => f.required && (v[f.key] === "" || v[f.key] == null));
  return (
    <Modal title={title} onClose={onClose} wide footer={<><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy || missing} onClick={() => onSave(v)}>Salva</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} hint={f.hint} className={f.full || f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "textarea" ? <textarea className="input" rows={3} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              : f.type === "select" ? (
                <select className="input" value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {!f.required && <option value="">–</option>}
                  {f.options!.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <>
                  <input className="input" type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} list={f.list ? `dl-${f.key}` : undefined}
                    value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                  {f.list && <datalist id={`dl-${f.key}`}>{f.list.map((x) => <option key={x} value={x} />)}</datalist>}
                </>
              )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
