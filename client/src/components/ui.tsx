import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, type AppointmentStatus } from "@shared/constants";
import { centsToInput, inputToCents } from "@/lib/format";
import { get } from "@/lib/api";

// ---------- notifiche ----------
type Toast = { id: number; text: string; kind: "ok" | "err" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.kind === "ok" ? "bg-brand-deep" : "bg-red-600"}`}>
            {t.kind === "ok" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- caricamento dati ----------
export function useLoad<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try { const d = await get<T>(path); if (n === seq.current) { setData(d); setError(null); } }
    catch (e) { if (n === seq.current) setError((e as Error).message); }
    finally { if (n === seq.current) setLoading(false); }
  }, [path]); // eslint-disable-line
  useEffect(() => { reload(); }, [reload, ...deps]); // eslint-disable-line
  return { data, error, loading, reload, setData };
}

/** Esegue un'azione asincrona mostrando l'esito. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (ok) toast(ok); return r; }
    catch (e) { toast((e as Error).message, "err"); return undefined; }
    finally { setBusy(false); }
  }, [toast]);
  return { busy, run };
}

// ---------- componenti ----------
export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function MoneyInput({ value, onChange }: { value: number | null | undefined; onChange: (c: number | null) => void }) {
  const [txt, setTxt] = useState(centsToInput(value));
  useEffect(() => { if (inputToCents(txt) !== (value ?? null)) setTxt(centsToInput(value)); }, [value]); // eslint-disable-line
  return (
    <div className="relative">
      <input inputMode="decimal" className="input pr-8" value={txt} placeholder="0,00" onChange={(e) => { setTxt(e.target.value); onChange(inputToCents(e.target.value)); }} />
      <span className="pointer-events-none absolute right-3 top-2 text-sm text-slate-400">€</span>
    </div>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#24524C]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Spinner({ label = "Caricamento…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} /> {label}</div>;
}

export function ErrorBox({ text }: { text: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_COLORS[status as AppointmentStatus] || "bg-slate-100"}`}>{STATUS_LABELS[status as AppointmentStatus] || status}</span>;
}

export function Modal({ title, onClose, children, wide = false, footer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-display text-2xl">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Chiudi"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${active === t.id ? "bg-brand-deep text-white" : "bg-white text-brand-deep hover:bg-brand-mist"}`}>
          {t.label}{t.count ? <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${active === t.id ? "bg-white/20" : "bg-brand-mist"}`}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ text, onConfirm, children, className = "btn-ghost btn-sm" }: { text: string; onConfirm: () => void; children: React.ReactNode; className?: string }) {
  return <button type="button" className={className} onClick={() => { if (window.confirm(text)) onConfirm(); }}>{children}</button>;
}

/** Testo semplice con "## titoli", "- elenchi" e paragrafi (nessun HTML). */
export function RichText({ text, className = "prose-s" }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (b.startsWith("### ")) return <h3 key={i}>{b.slice(4)}</h3>;
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        if (lines.every((l) => /^[-•]\s/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.replace(/^[-•]\s/, "")}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>)}</p>;
      })}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
