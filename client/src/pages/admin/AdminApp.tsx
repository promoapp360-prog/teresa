import React, { useState } from "react";
import { Link, Route, Switch, useLocation, Redirect } from "wouter";
import { LayoutDashboard, CalendarDays, Users, Stethoscope, Clock, FileSignature, BarChart3, Settings, ShieldCheck, LogOut, Menu, X, Loader2, ExternalLink } from "lucide-react";
import { useAuth, type Me } from "@/lib/auth";
import { post } from "@/lib/api";
import { Field, ErrorBox, Spinner } from "@/components/ui";
import Dashboard from "./Dashboard";
import Agenda from "./Agenda";
import Patients from "./Patients";
import PatientRecord from "./PatientRecord";
import VisitEditor from "./VisitEditor";
import Catalog from "./Catalog";
import Availability from "./Availability";
import ConsentTemplates from "./ConsentTemplates";
import Stats from "./Stats";
import SettingsPage from "./SettingsPage";
import Security from "./Security";

function Login() {
  const { setMe } = useAuth();
  const [, nav] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = need2fa ? await post<{ user: Me }>("auth/login/2fa", { code }) : await post<{ user?: Me; need2fa?: boolean }>("auth/login", { username, password });
      if ((r as any).need2fa) { setNeed2fa(true); return; }
      setMe(r.user!);
      nav(r.user!.mustChangePassword ? "/cambia-password" : "/");
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-deep/30 font-display text-2xl text-brand-deep">TV</div>
          <h1 className="mt-3 text-3xl">Area riservata</h1>
          <p className="text-sm text-slate-500">Studio Dott.ssa Teresa della Volpe</p>
        </div>
        {!need2fa ? (
          <>
            <Field label="Utente"><input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></Field>
            <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          </>
        ) : (
          <Field label="Codice dell'app di autenticazione" hint="Inserisci il codice a 6 cifre mostrato nell'app (Google o Microsoft Authenticator).">
            <input className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
          </Field>
        )}
        {err && <ErrorBox text={err} />}
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {need2fa ? "Verifica" : "Accedi"}</button>
        <a href="/" className="block text-center text-xs text-slate-500 hover:text-brand-deep">← Torna al sito</a>
      </form>
    </div>
  );
}

export function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { setMe } = useAuth();
  const [, nav] = useLocation();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (f.newPassword !== f.confirm) return setErr("Le due password non coincidono");
    setBusy(true);
    try { const r = await post<{ user: Me }>("auth/change-password", f); setMe(r.user); nav("/"); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const form = (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
      <h1 className="text-3xl">{forced ? "Imposta la tua password" : "Cambia password"}</h1>
      {forced && <p className="text-sm text-slate-600">Per proteggere i dati dei pazienti, al primo accesso è necessario sostituire la password iniziale.</p>}
      <Field label="Password attuale"><input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required /></Field>
      <Field label="Nuova password" hint="Almeno 10 caratteri, con maiuscole, minuscole e numeri."><input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required /></Field>
      <Field label="Ripeti la nuova password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
      {err && <ErrorBox text={err} />}
      <button className="btn-primary w-full" disabled={busy}>Salva la password</button>
    </form>
  );
  return forced ? <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">{form}</div> : form;
}

const NAV = [
  { href: "/", label: "Cruscotto", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/pazienti", label: "Pazienti", icon: Users },
  { href: "/prestazioni", label: "Prestazioni", icon: Stethoscope },
  { href: "/disponibilita", label: "Orari e chiusure", icon: Clock },
  { href: "/consensi", label: "Modelli di consenso", icon: FileSignature, doctor: true },
  { href: "/statistiche", label: "Statistiche", icon: BarChart3 },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
  { href: "/sicurezza", label: "Sicurezza e accessi", icon: ShieldCheck },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { me, setMe } = useAuth();
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const logout = async () => { await post("auth/logout").catch(() => {}); setMe(null); location.href = "/admin/login"; };
  const items = NAV.filter((n) => !n.doctor || me?.role === "doctor");
  const active = (href: string) => (href === "/" ? loc === "/" : loc.startsWith(href));
  const side = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 font-display text-lg text-white">TV</span>
        <div className="leading-tight"><div className="font-display text-lg text-white">Studio della Volpe</div><div className="text-[10px] uppercase tracking-widest text-white/60">Gestionale</div></div>
      </div>
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active(n.href) ? "bg-white text-brand-deep" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
          <n.icon size={18} /> {n.label}
        </Link>
      ))}
      <div className="mt-auto space-y-1 border-t border-white/10 pt-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"><ExternalLink size={16} /> Vedi il sito</a>
        <div className="px-3 pt-2 text-xs text-white/60">{me?.fullName || me?.username} · {me?.role === "doctor" ? "Medico" : "Segreteria"}</div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"><LogOut size={16} /> Esci</button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-[#F4F1EC] lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 bg-brand-deep lg:block">{side}</aside>
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-brand-deep px-4 text-white lg:hidden">
        <span className="font-display text-xl">Studio della Volpe</span>
        <button onClick={() => setOpen(true)} aria-label="Menu"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-brand-deep" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-4 text-white" onClick={() => setOpen(false)} aria-label="Chiudi"><X /></button>
            {side}
          </aside>
        </div>
      )}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

export default function AdminApp() {
  const { me, loading } = useAuth();
  const [loc] = useLocation();
  if (loading) return <Spinner />;
  if (!me) return loc === "/login" ? <Login /> : <Redirect to="/login" />;
  if (me.mustChangePassword) return <ChangePassword forced />;
  if (loc === "/login") return <Redirect to="/" />;
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/agenda" component={Agenda} />
        <Route path="/pazienti" component={Patients} />
        <Route path="/pazienti/:id/visite/:vid">{(p) => <VisitEditor patientId={Number(p.id)} visitId={p.vid === "nuova" ? null : Number(p.vid)} />}</Route>
        <Route path="/pazienti/:id">{(p) => <PatientRecord id={Number(p.id)} />}</Route>
        <Route path="/prestazioni" component={Catalog} />
        <Route path="/disponibilita" component={Availability} />
        <Route path="/consensi" component={ConsentTemplates} />
        <Route path="/statistiche" component={Stats} />
        <Route path="/impostazioni" component={SettingsPage} />
        <Route path="/sicurezza" component={Security} />
        <Route path="/cambia-password"><div className="flex justify-center"><ChangePassword /></div></Route>
        <Route><div className="card">Pagina non trovata. <Link href="/" className="font-bold text-brand-deep">Torna al cruscotto</Link></div></Route>
      </Switch>
    </Shell>
  );
}
