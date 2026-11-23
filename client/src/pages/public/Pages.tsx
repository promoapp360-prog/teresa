import React from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarCheck, Clock, MapPin, Phone, Mail, MessageCircle, Info } from "lucide-react";
import { useSite, type Service } from "@/lib/site";
import { fmtMoney, waLink } from "@/lib/format";
import { RichText } from "@/components/ui";
import { AreaIcon } from "./Layout";
import { DoctorPortrait } from "./Home";

function Hero({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text?: string | null; children?: React.ReactNode }) {
  return (
    <section className="border-b border-brand-sand/60 bg-white">
      <div className="wrap py-14 md:py-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl text-5xl leading-tight sm:text-6xl">{title}</h1>
        {text && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{text}</p>}
        {children}
      </div>
    </section>
  );
}

export function ServiceCard({ s }: { s: Service }) {
  return (
    <Link href={`/prestazioni/${s.slug}`} className="group flex flex-col rounded-2xl border border-brand-sand/70 bg-white p-5 transition hover:border-brand-sage hover:shadow-soft">
      <h3 className="text-xl leading-snug">{s.name}</h3>
      <p className="mt-2 flex-1 text-sm text-slate-600">{s.shortDescription}</p>
      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock size={14} /> {s.durationMin} min{s.priceCents != null && <> · {fmtMoney(s.priceCents)}</>}</span>
        <span className="inline-flex items-center gap-1 text-brand-bronze">Dettagli <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

export function AreaPage({ slug }: { slug: string }) {
  const { site } = useSite();
  const c = site!.categories.find((x) => x.slug === slug);
  if (!c) return <NotFound />;
  const services = site!.services.filter((s) => s.categoryId === c.id);
  return (
    <>
      <Hero eyebrow="Specializzazione" title={c.name} text={c.intro}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/prenota?area=${c.slug}`} className="btn-primary"><CalendarCheck size={16} /> Prenota</Link>
          <a href="#prestazioni" className="btn-outline">Vedi le prestazioni</a>
        </div>
      </Hero>
      <section className="wrap grid gap-12 py-16 lg:grid-cols-[1.3fr_.7fr]">
        <RichText text={c.body} />
        <aside className="h-fit rounded-3xl bg-brand-mist p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-deep"><AreaIcon name={c.icon} /></span>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{site!.settings.legal.disclaimer}</p>
          <Link href="/la-dottoressa" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-deep">La Dottoressa <ArrowRight size={14} /></Link>
        </aside>
      </section>
      <section id="prestazioni" className="bg-white py-16">
        <div className="wrap">
          <h2 className="text-4xl">Prestazioni di {c.name}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map((s) => <ServiceCard key={s.id} s={s} />)}</div>
        </div>
      </section>
    </>
  );
}

export function ServicesPage() {
  const { site } = useSite();
  return (
    <>
      <Hero eyebrow="Catalogo" title="Prestazioni e trattamenti" text="Tutti i trattamenti vengono proposti dopo una valutazione medica. Scegli una prestazione per i dettagli o per prenotare." />
      <div className="wrap space-y-14 py-14">
        {site!.categories.map((c) => (
          <section key={c.id}>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-deep shadow-soft"><AreaIcon name={c.icon} size={20} /></span>
              <h2 className="text-3xl"><Link href={`/${c.slug}`}>{c.name}</Link></h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{site!.services.filter((s) => s.categoryId === c.id).map((s) => <ServiceCard key={s.id} s={s} />)}</div>
          </section>
        ))}
      </div>
    </>
  );
}

export function ServicePage({ slug }: { slug: string }) {
  const { site } = useSite();
  const s = site!.services.find((x) => x.slug === slug);
  if (!s) return <NotFound />;
  const c = site!.categories.find((x) => x.id === s.categoryId);
  const related = site!.services.filter((x) => x.categoryId === s.categoryId && x.id !== s.id).slice(0, 3);
  return (
    <>
      <Hero eyebrow={c?.name} title={s.name} text={s.shortDescription}>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Clock size={16} /> Durata indicativa {s.durationMin} minuti</span>
          {s.priceCents != null && <span>Tariffa: {fmtMoney(s.priceCents)}</span>}
        </div>
        {s.bookable && <Link href={`/prenota?servizio=${s.slug}`} className="btn-primary mt-8"><CalendarCheck size={16} /> Prenota questa prestazione</Link>}
      </Hero>
      <section className="wrap grid gap-10 py-14 lg:grid-cols-[1.3fr_.7fr]">
        <div>
          <RichText text={s.description} />
          {s.infoNotes && <div className="mt-6 flex gap-3 rounded-2xl bg-brand-mist p-5 text-sm text-slate-700"><Info size={18} className="mt-0.5 shrink-0 text-brand-deep" /><RichText text={s.infoNotes} className="[&_p]:mb-0" /></div>}
        </div>
        {related.length > 0 && (
          <aside className="space-y-3">
            <div className="eyebrow">Altre prestazioni</div>
            {related.map((r) => <ServiceCard key={r.id} s={r} />)}
          </aside>
        )}
      </section>
    </>
  );
}

export function DoctorPage() {
  const { site } = useSite();
  const s = site!.settings;
  return (
    <section className="wrap grid gap-12 py-14 md:grid-cols-[.8fr_1.2fr] md:py-20">
      <div className="mx-auto w-full max-w-sm">
        <div className="aspect-[4/5] overflow-hidden rounded-[2.5rem] rounded-tl-[7rem] shadow-soft"><DoctorPortrait /></div>
      </div>
      <div>
        <p className="eyebrow">{s.studio.doctorTitle}</p>
        <h1 className="mt-3 text-5xl sm:text-6xl">{s.studio.doctorName}</h1>
        <div className="mt-6"><RichText text={s.doctor.bio} /></div>
        {s.doctor.qualifications && (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-soft">
            <div className="eyebrow">Formazione</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">{String(s.doctor.qualifications).split("\n").filter(Boolean).map((q: string, i: number) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-bronze" />{q}</li>)}</ul>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-2">{site!.categories.map((c) => <Link key={c.id} href={`/${c.slug}`} className="btn-outline btn-sm">{c.name}</Link>)}</div>
        <Link href="/prenota" className="btn-primary mt-8"><CalendarCheck size={16} /> Prenota una visita</Link>
      </div>
    </section>
  );
}

export function ContactsPage() {
  const { site } = useSite();
  const st = site!.settings.studio;
  const address = [st.address, st.postalCode, st.city].filter(Boolean).join(" ");
  const maps = st.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <>
      <Hero eyebrow="Contatti" title="Come raggiungerci" text={st.hoursText} />
      <section className="wrap grid gap-8 py-14 lg:grid-cols-2">
        <div className="space-y-4">
          <a href={maps} target="_blank" rel="noreferrer" className="card flex gap-4 hover:border-brand-sage"><MapPin className="text-brand-bronze" /><div><div className="font-bold">Indirizzo</div><div className="text-slate-600">{address}</div><div className="mt-1 text-xs font-bold text-brand-deep">Apri in Google Maps</div></div></a>
          {st.phone && <a href={`tel:${st.phone.replace(/\s/g, "")}`} className="card flex gap-4 hover:border-brand-sage"><Phone className="text-brand-bronze" /><div><div className="font-bold">Telefono</div><div className="text-slate-600">{st.phone}</div></div></a>}
          {st.whatsapp && <a href={waLink(st.whatsapp)} target="_blank" rel="noreferrer" className="card flex gap-4 hover:border-brand-sage"><MessageCircle className="text-brand-bronze" /><div><div className="font-bold">WhatsApp</div><div className="text-slate-600">{st.whatsapp}</div></div></a>}
          {st.email && <a href={`mailto:${st.email}`} className="card flex gap-4 hover:border-brand-sage"><Mail className="text-brand-bronze" /><div><div className="font-bold">Email</div><div className="text-slate-600">{st.email}</div></div></a>}
          <Link href="/prenota" className="btn-primary w-full"><CalendarCheck size={16} /> Prenota online</Link>
        </div>
        <div className="min-h-[360px] overflow-hidden rounded-3xl bg-brand-mist shadow-soft">
          {st.mapsEmbedUrl
            ? <iframe title="Mappa dello studio" src={st.mapsEmbedUrl} className="h-full min-h-[360px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            : <div className="flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center text-slate-500"><MapPin size={36} className="mb-3 text-brand-sage" />La mappa comparirà qui dopo aver inserito l'indirizzo nel pannello.</div>}
        </div>
      </section>
    </>
  );
}

export function LegalPage({ kind }: { kind: "privacy" | "cookie" }) {
  const { site } = useSite();
  const text = kind === "privacy" ? site!.settings.legal.privacyPolicy : site!.settings.legal.cookiePolicy;
  return <section className="wrap max-w-3xl py-14"><RichText text={text} /></section>;
}

export function NotFound() {
  return (
    <section className="wrap py-24 text-center">
      <h1 className="text-5xl">Pagina non trovata</h1>
      <p className="mt-4 text-slate-600">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link href="/" className="btn-primary mt-8">Torna alla home</Link>
    </section>
  );
}
