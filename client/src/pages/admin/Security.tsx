import React, { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, ShieldAlert, KeyRound, UserPlus, LogOut } from "lucide-react";
import { post, patch } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLoad, Spinner, Field, PageTitle, Tabs, useAction, Modal, Empty } from "@/components/ui";
import { ROLE_LABELS } from "@shared/constants";

export default function Security() {
  const { me } = useAuth();
  const [tab, setTab] = useState("profilo");
  const tabs = [{ id: "profilo", label: "Il mio accesso" }, ...(me?.role === "doctor" ? [{ id: "utenti", label: "Utenti" }, { id: "registro", label: "Registro accessi" }] : [])];
  return (
    <>
      <PageTitle title="Sicurezza e accessi" subtitle="Password, autenticazione a due fattori, utenti e tracciamento delle operazioni" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "profilo" && <Profile />}
        {tab === "utenti" && <Users />}
        {tab === "registro" && <AuditLog />}
      </div>
    </>
  );
}

function Profile() {
  const { me, refresh } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [dis, setDis] = useState({ password: "", code: "" });
  const { busy, run } = useAction();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <div className="flex items-center gap-3">{me?.totpEnabled ? <ShieldCheck className="text-emerald-600" /> : <ShieldAlert className="text-amber-500" />}<h2 className="text-2xl">Autenticazione a due fattori</h2></div>
        {me?.totpEnabled ? (
          <>
            <p className="mt-2 text-sm text-slate-600">Attiva: a ogni accesso viene richiesto il codice dell'app di autenticazione.</p>
            {!disabling ? <button className="btn-ghost btn-sm mt-3 text-red-600" onClick={() => setDisabling(true)}>Disattiva</button> : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className="input" type="password" placeholder="Password" value={dis.password} onChange={(e) => setDis({ ...dis, password: e.target.value })} />
                <input className="input" inputMode="numeric" placeholder="Codice a 6 cifre" value={dis.code} onChange={(e) => setDis({ ...dis, code: e.target.value })} />
                <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => post("auth/2fa/disable", dis), "Autenticazione a due fattori disattivata").then((r) => { if (r) { setDisabling(false); refresh(); } })}>Conferma disattivazione</button>
              </div>
            )}
          </>
        ) : !setup ? (
          <>
            <p className="mt-2 text-sm text-slate-600">Protegge la cartella clinica anche se la password venisse scoperta. Serve un'app gratuita come Google Authenticator o Microsoft Authenticator.</p>
            <button className="btn-primary mt-4" disabled={busy} onClick={() => run(() => post<{ secret: string; qr: string }>("auth/2fa/setup")).then((r) => r && setSetup(r))}>Attiva</button>
          </>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p>1. Inquadra il codice QR con l'app di autenticazione.</p>
            <img src={setup.qr} alt="Codice QR per l'app di autenticazione" className="h-52 w-52 rounded-xl border" />
            <p className="text-xs text-slate-500">Oppure inserisci a mano la chiave: <code className="break-all font-bold">{setup.secret}</code></p>
            <p>2. Inserisci il codice a 6 cifre che compare nell'app.</p>
            <div className="flex gap-2">
              <input className="input w-40 text-center text-lg tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn-primary" disabled={busy || code.length !== 6} onClick={() => run(() => post("auth/2fa/enable", { code }), "Autenticazione a due fattori attivata").then((r) => { if (r) { setSetup(null); refresh(); } })}>Verifica e attiva</button>
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <div className="flex items-center gap-3"><KeyRound className="text-brand-deep" /><h2 className="text-2xl">Password e sessioni</h2></div>
        <p className="mt-2 text-sm text-slate-600">Utente <b>{me?.username}</b>{me?.lastLoginAt && <> · ultimo accesso {fmtDateTime(me.lastLoginAt)}</>}. La sessione si chiude dopo 2 ore di inattività.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/cambia-password" className="btn-outline">Cambia password</Link>
          <button className="btn-ghost" onClick={() => { if (confirm("Chiudere la sessione su tutti i dispositivi, compreso questo?")) run(() => post("auth/logout-all")).then(() => (location.href = "/admin/login")); }}><LogOut size={16} /> Esci da tutti i dispositivi</button>
        </div>
      </section>
    </div>
  );
}

function Users() {
  const { me } = useAuth();
  const { data, loading, reload } = useLoad<any[]>("admin/users");
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ username: "", fullName: "", email: "", role: "staff" });
  const [temp, setTemp] = useState<{ user: string; password: string } | null>(null);
  const { busy, run } = useAction();
  if (loading && !data) return <Spinner />;
  return (
    <section className="card overflow-x-auto">
      <div className="flex items-center justify-between"><h2 className="text-2xl">Utenti</h2><button className="btn-primary btn-sm" onClick={() => setCreating(true)}><UserPlus size={14} /> Nuovo utente</button></div>
      <p className="mt-1 text-xs text-slate-500">Le utenze “Segreteria” gestiscono agenda e anagrafiche ma non vedono mai i dati clinici.</p>
      <table className="tbl mt-3">
        <thead><tr><th>Utente</th><th>Ruolo</th><th>2FA</th><th>Ultimo accesso</th><th>Stato</th><th /></tr></thead>
        <tbody>{(data || []).map((u) => (
          <tr key={u.id}>
            <td><b>{u.username}</b><div className="text-xs text-slate-500">{u.fullName}</div></td>
            <td className="text-xs">{ROLE_LABELS[u.role]}</td>
            <td>{u.totpEnabled ? "Sì" : "No"}</td>
            <td className="text-xs">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "–"}</td>
            <td>{u.active ? "Attivo" : "Disattivato"}</td>
            <td className="whitespace-nowrap text-right">
              {u.id !== me?.id && <>
                <button className="btn-ghost btn-sm" onClick={() => run(() => patch<any>(`admin/users/${u.id}`, { resetPassword: true }), "Password reimpostata").then((r) => r && setTemp({ user: u.username, password: r.tempPassword }))}>Reimposta password</button>
                {u.totpEnabled && <button className="btn-ghost btn-sm" onClick={() => run(() => patch(`admin/users/${u.id}`, { reset2fa: true }), "2FA azzerata").then(reload)}>Azzera 2FA</button>}
                <button className="btn-ghost btn-sm" onClick={() => run(() => patch(`admin/users/${u.id}`, { active: !u.active }), "Aggiornato").then(reload)}>{u.active ? "Disattiva" : "Riattiva"}</button>
              </>}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {creating && (
        <Modal title="Nuovo utente" onClose={() => setCreating(false)} footer={<><button className="btn-ghost" onClick={() => setCreating(false)}>Annulla</button>
          <button className="btn-primary" disabled={busy || f.username.length < 3} onClick={() => run(() => post<any>("admin/users", f), "Utente creato").then((r) => { if (r) { setCreating(false); setTemp({ user: r.user.username, password: r.tempPassword }); reload(); } })}>Crea</button></>}>
          <div className="space-y-3">
            <Field label="Nome utente (per l'accesso)"><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
            <Field label="Nome e cognome"><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Ruolo"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
        </Modal>
      )}
      {temp && (
        <Modal title="Password temporanea" onClose={() => setTemp(null)}>
          <p className="text-sm">Comunica a <b>{temp.user}</b> questa password temporanea: al primo accesso dovrà sceglierne una nuova.</p>
          <div className="mt-3 rounded-xl bg-brand-mist p-4 text-center font-mono text-xl font-bold tracking-wider">{temp.password}</div>
          <p className="mt-2 text-xs text-slate-500">Non verrà più mostrata.</p>
        </Modal>
      )}
    </section>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad<any[]>(`admin/audit?page=${page}`);
  if (loading && !data) return <Spinner />;
  return (
    <section className="card overflow-x-auto">
      <h2 className="text-2xl">Registro accessi e operazioni</h2>
      <p className="text-xs text-slate-500">Accessi, consultazioni e modifiche dei dati clinici, con data, utente e indirizzo IP.</p>
      {!data?.length ? <Empty>Nessuna registrazione.</Empty> : (
        <table className="tbl mt-3">
          <thead><tr><th>Data</th><th>Utente</th><th>Operazione</th><th>Paziente</th><th>IP</th></tr></thead>
          <tbody>{data.map((l) => (
            <tr key={l.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(l.at)}</td><td>{l.username || "–"}</td><td className={l.action === "login_fallito" ? "font-bold text-red-600" : ""}>{l.action.replace(/_/g, " ")}</td>
              <td>{l.patientId ? <Link href={`/pazienti/${l.patientId}`} className="text-brand-deep hover:underline">{l.lastName} {l.firstName}</Link> : ""}</td><td className="text-xs text-slate-500">{l.ip}</td></tr>
          ))}</tbody>
        </table>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Più recenti</button>
        <button className="btn-outline btn-sm" disabled={(data?.length || 0) < 100} onClick={() => setPage(page + 1)}>Meno recenti</button>
      </div>
    </section>
  );
}
