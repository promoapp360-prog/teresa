import React from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarCheck, ClipboardList, LineChart as LineIcon, ShieldCheck, MessageCircle, Phone } from "lucide-react";
import { useSite } from "@/lib/site";
import { waLink } from "@/lib/format";
import { AreaIcon } from "./Layout";

export function DoctorPortrait({ className = "" }: { className?: string }) {
  const { site } = useSite();
  const s = site!.settings;
  if (s.doctor.photoUrl) return <img src={s.doctor.photoUrl} alt={s.studio.doctorName} className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-deep to-brand-sage text-white ${className}`}>
      <span className="font-display text-7xl italic">T.d.V.</span>
      <span className="mt-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">{s.studio.doctorTitle}</span>
    </div>
  );
}

export default function Home() {
  const { site } = useSite();
  const s = site!.settings;
  const st = s.studio;

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <svg className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] text-brand-mist" viewBox="0 0 200 200" aria-hidden>
          <path fill="currentColor" d="M44.7,-58.5C57.2,-49.2,66.1,-35,70.6,-19.3C75.1,-3.6,75.3,13.6,68.4,27.4C61.5,41.2,47.6,51.6,32.6,58.9C17.6,66.2,1.5,70.4,-15.6,68.6C-32.7,66.8,-50.8,59,-61.6,45.4C-72.4,31.8,-75.9,12.4,-72.7,-5.3C-69.5,-23,-59.6,-39,-46.1,-48.2C-32.6,-57.4,-16.3,-59.8,0.3,-60.2C17,-60.6,32.2,-67.8,44.7,-58.5Z" transform="translate(100 100)" />
        </svg>
        <div className="wrap relative grid items-center gap-12 py-16 md:grid-cols-[1.15fr_.85fr] md:py-24">
          <div>
            <p className="eyebrow">{st.tagline}</p>
            <h1 className="mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">{s.home.heroTitle}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{s.home.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/prenota" className="btn-primary px-7 text-base"><CalendarCheck size={18} /> Prenota una visita</Link>
              {st.whatsapp
                ? <a href={waLink(st.whatsapp)} target="_blank" rel="noreferrer" className="btn-outline px-6 text-base"><MessageCircle size={18} /> Scrivi su WhatsApp</a>
                : st.phone && <a href={`tel:${st.phone.replace(/\s/g, "")}`} className="btn-outline px-6 text-base"><Phone size={18} /> {st.phone}</a>}
            </div>
            <p className="mt-6 text-sm text-slate-500">{st.doctorName} · {st.doctorTitle}</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="aspect-[4/5] overflow-hidden rounded-[2.5rem] rounded-tr-[7rem] shadow-soft"><DoctorPortrait /></div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white px-5 py-4 shadow-soft">
              <div className="font-display text-3xl text-brand-deep">4</div>
              <div className="text-xs font-semibold text-slate-500">aree di cura integrate</div>
            </div>
          </div>
        </div>
      </section>

      {/* specializzazioni */}
      <section className="bg-white py-20">
        <div className="wrap">
          <div className="max-w-2xl">
            <p className="eyebrow">Specializzazioni</p>
            <h2 className="mt-3 text-4xl sm:text-5xl">Quattro ambiti, un unico percorso di cura</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {site!.categories.map((c, i) => (
              <Link key={c.id} href={`/${c.slug}`} className="group flex flex-col rounded-3xl border border-brand-sand/70 bg-brand-cream p-6 transition hover:-translate-y-1 hover:border-brand-sage hover:shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-deep"><AreaIcon name={c.icon} /></span>
                  <span className="font-display text-2xl text-brand-sand">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-2xl">{c.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{c.subtitle}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-bronze">Scopri <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* approccio */}
      <section className="py-20">
        <div className="wrap grid gap-12 md:grid-cols-2">
          <div>
            <p className="eyebrow">Il metodo</p>
            <h2 className="mt-3 text-4xl sm:text-5xl">{s.home.approachTitle}</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{s.home.approachText}</p>
            <Link href="/la-dottoressa" className="btn-outline mt-8">Conosci la Dottoressa <ArrowRight size={16} /></Link>
          </div>
          <ol className="space-y-4">
            {[
              { icon: ClipboardList, t: "Visita e valutazione", d: "Anamnesi, esame obiettivo e misurazione del dolore con la scala VAS e la mappa del corpo." },
              { icon: CalendarCheck, t: "Piano di trattamento", d: "Un ciclo di sedute definito insieme, con obiettivi chiari e controlli programmati." },
              { icon: LineIcon, t: "Controlli documentati", d: "Ogni seduta viene registrata: l'evoluzione è visibile e il piano si adatta nel tempo." },
              { icon: ShieldCheck, t: "Riservatezza", d: "Cartella clinica digitale protetta, consultabile solo dalla Dottoressa." },
            ].map((x, i) => (
              <li key={i} className="flex gap-4 rounded-2xl bg-white p-5 shadow-soft">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-mist text-brand-deep"><x.icon size={20} strokeWidth={1.7} /></span>
                <div><div className="font-bold text-brand-deep">{x.t}</div><p className="mt-1 text-sm leading-relaxed text-slate-600">{x.d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* invito alla prenotazione */}
      <section className="wrap pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-14 text-center text-white sm:px-16">
          <h2 className="text-4xl text-white sm:text-5xl">Prenota la tua visita online</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/75">Scegli la prestazione, il giorno e l'orario tra quelli disponibili. Riceverai la conferma e un promemoria via email.</p>
          <Link href="/prenota" className="btn mt-8 bg-white px-8 text-base text-brand-deep hover:bg-brand-cream"><CalendarCheck size={18} /> Vai alla prenotazione</Link>
        </div>
      </section>
    </>
  );
}
