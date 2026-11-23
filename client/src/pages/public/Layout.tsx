import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, MessageCircle, CalendarCheck, MapPin, Mail, Activity, Wind, Droplet, Sparkles, Stethoscope } from "lucide-react";
import { useSite } from "@/lib/site";
import { waLink } from "@/lib/format";
import { Spinner } from "@/components/ui";

export const AREA_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  activity: Activity, wind: Wind, droplet: Droplet, sparkles: Sparkles,
};
export const AreaIcon = ({ name, size = 22, className = "" }: { name?: string | null; size?: number; className?: string }) => {
  const I = (name && AREA_ICONS[name]) || Stethoscope;
  return <I size={size} className={className} strokeWidth={1.6} />;
};

export function Logo({ light = false }: { light?: boolean }) {
  const { site } = useSite();
  const name = site?.settings.studio.doctorName || "Dott.ssa Teresa della Volpe";
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-display text-lg ${light ? "border-white/40 text-white" : "border-brand-deep/30 text-brand-deep"}`}>TV</span>
      <span className="leading-tight">
        <span className={`block font-display text-xl font-semibold ${light ? "text-white" : "text-brand-deep"}`}>{name}</span>
        <span className={`block text-[10px] font-bold uppercase tracking-[0.22em] ${light ? "text-white/70" : "text-brand-bronze"}`}>Studio medico</span>
      </span>
    </Link>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { site } = useSite();
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc]);

  if (!site) return <div className="min-h-screen"><Spinner /></div>;
  const st = site.settings.studio;
  const nav = [
    { href: "/la-dottoressa", label: "La Dottoressa" },
    ...site.categories.map((c) => ({ href: `/${c.slug}`, label: c.name })),
    { href: "/contatti", label: "Contatti" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-brand-sand/60 bg-brand-cream/90 backdrop-blur">
        <div className="wrap flex h-20 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigazione principale">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`rounded-full px-3 py-2 text-sm font-semibold transition hover:text-brand-bronze ${loc === n.href ? "text-brand-bronze" : "text-brand-deep"}`}>{n.label}</Link>
            ))}
            <Link href="/prenota" className="btn-primary ml-2"><CalendarCheck size={16} /> Prenota</Link>
          </nav>
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <nav className="border-t border-brand-sand/60 bg-brand-cream lg:hidden">
            <div className="wrap flex flex-col py-3">
              {nav.map((n) => <Link key={n.href} href={n.href} className="border-b border-brand-sand/40 py-3 font-semibold text-brand-deep">{n.label}</Link>)}
              <Link href="/prestazioni" className="border-b border-brand-sand/40 py-3 font-semibold text-brand-deep">Tutte le prestazioni</Link>
              <Link href="/prenota" className="btn-primary mt-4"><CalendarCheck size={16} /> Prenota una visita</Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-20 lg:pb-0">{children}</main>

      <footer className="bg-brand-ink text-white/80">
        <div className="wrap grid gap-10 py-14 md:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{st.tagline}</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="eyebrow text-brand-sand">Studio</div>
            <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {[st.address, st.postalCode, st.city].filter(Boolean).join(" ")}</p>
            {st.phone && <a className="flex gap-2 hover:text-white" href={`tel:${st.phone.replace(/\s/g, "")}`}><Phone size={16} /> {st.phone}</a>}
            {st.email && <a className="flex gap-2 hover:text-white" href={`mailto:${st.email}`}><Mail size={16} /> {st.email}</a>}
            <p className="text-white/60">{st.hoursText}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="eyebrow text-brand-sand">Specializzazioni</div>
            {site.categories.map((c) => <Link key={c.id} href={`/${c.slug}`} className="block hover:text-white">{c.name}</Link>)}
            <Link href="/prestazioni" className="block hover:text-white">Tutte le prestazioni</Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="wrap flex flex-col gap-3 py-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl">{site.settings.legal.disclaimer}{st.registrationInfo ? ` · ${st.registrationInfo}` : ""}{st.vatNumber ? ` · P.IVA ${st.vatNumber}` : ""}</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/cookie" className="hover:text-white">Cookie</Link>
              <a href="/admin" className="hover:text-white">Area riservata</a>
              <span>Realizzato da PromoApp</span>
            </div>
          </div>
        </div>
      </footer>

      {/* barra rapida su smartphone */}
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-brand-sand bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <a href={st.phone ? `tel:${st.phone.replace(/\s/g, "")}` : "/contatti"} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold text-brand-deep"><Phone size={20} /> Chiama</a>
        <a href={st.whatsapp ? waLink(st.whatsapp) : "/contatti"} target={st.whatsapp ? "_blank" : undefined} rel="noreferrer" className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold text-brand-deep"><MessageCircle size={20} /> WhatsApp</a>
        <Link href="/prenota" className="flex flex-col items-center gap-0.5 bg-brand-deep py-2.5 text-[11px] font-bold text-white"><CalendarCheck size={20} /> Prenota</Link>
      </div>
    </div>
  );
}
