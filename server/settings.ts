import { one, pool } from "./db";

export const DEFAULT_SETTINGS = {
  studio: {
    name: "Studio Medico Dott.ssa Teresa della Volpe",
    doctorName: "Dott.ssa Teresa della Volpe",
    doctorTitle: "Medico Chirurgo",
    tagline: "Terapia del Dolore · Ozonoterapia · IV Therapy · Medicina Estetica",
    address: "Indirizzo dello studio (da inserire)",
    city: "",
    postalCode: "",
    phone: "",
    whatsapp: "",
    email: "",
    mapsUrl: "",
    mapsEmbedUrl: "",
    hoursText: "Su appuntamento",
    registrationInfo: "",
    vatNumber: "",
  },
  doctor: {
    photoUrl: "",
    bio: "La Dott.ssa Teresa della Volpe accoglie ogni paziente con un percorso personalizzato: ascolto, valutazione clinica accurata e un piano di trattamento condiviso, seguito nel tempo con controlli programmati.\n\nSi occupa di Terapia del Dolore, Ozonoterapia, IV Therapy e Medicina Estetica, con un approccio che unisce rigore medico e attenzione alla persona.",
    qualifications: "Laurea in Medicina e Chirurgia\nFormazione in Terapia del Dolore\nFormazione in Ossigeno-Ozonoterapia\nFormazione in Medicina Estetica",
  },
  home: {
    heroTitle: "Medicina che ascolta, cura che accompagna",
    heroText: "Percorsi personalizzati per il trattamento del dolore, l'ozonoterapia, la IV Therapy e la medicina estetica, in uno studio riservato e accogliente.",
    approachTitle: "Un percorso, non una singola seduta",
    approachText: "Ogni trattamento parte da una visita accurata. Ogni controllo viene registrato, così l'evoluzione è documentata e il piano può essere adattato nel tempo.",
  },
  booking: {
    enabled: true,
    autoConfirm: false,
    slotStepMin: 15,
    minNoticeHours: 24,
    maxDaysAhead: 60,
    cancelMinHours: 24,
    autoHolidays: true,
    notifyEmail: "",
    notice: "La richiesta verrà confermata dallo studio via email. Per urgenze contatta lo studio telefonicamente.",
  },
  reminders: { enabled: true, hoursBefore: 24 },
  emails: {
    requestReceived: {
      subject: "Richiesta di appuntamento ricevuta – {studio}",
      body: "Gentile {nome},\n\nabbiamo ricevuto la sua richiesta di appuntamento per {prestazione} il giorno {data} alle ore {ora}.\n\nRiceverà una email di conferma appena lo studio avrà verificato la disponibilità.\n\nPer gestire o annullare la richiesta: {link}\n\nCordiali saluti,\n{studio}",
    },
    confirmed: {
      subject: "Appuntamento confermato – {data} ore {ora}",
      body: "Gentile {nome},\n\nle confermiamo l'appuntamento per {prestazione} il giorno {data} alle ore {ora}.\n\nIndirizzo: {indirizzo}\n\nSe non potesse presentarsi, la preghiamo di avvisarci per tempo: {link}\n\nCordiali saluti,\n{studio}",
    },
    reminder: {
      subject: "Promemoria appuntamento – {data} ore {ora}",
      body: "Gentile {nome},\n\nle ricordiamo l'appuntamento per {prestazione} il giorno {data} alle ore {ora}.\n\nIndirizzo: {indirizzo}\n\nPer spostare o annullare: {link}\n\nA presto,\n{studio}",
    },
    cancelled: {
      subject: "Appuntamento annullato – {data} ore {ora}",
      body: "Gentile {nome},\n\nl'appuntamento per {prestazione} del giorno {data} alle ore {ora} è stato annullato.\n\nPer fissare un nuovo appuntamento può prenotare dal sito o contattare lo studio.\n\nCordiali saluti,\n{studio}",
    },
  },
  seo: {
    title: "Dott.ssa Teresa della Volpe – Terapia del Dolore, Ozonoterapia, IV Therapy, Medicina Estetica",
    description: "Studio medico della Dott.ssa Teresa della Volpe: terapia del dolore, ossigeno-ozonoterapia, IV therapy e medicina estetica. Prenota online la tua visita.",
  },
  legal: {
    privacyPolicy: "## Informativa sul trattamento dei dati personali\n\nTesto da predisporre a cura del Titolare del trattamento (lo Studio) prima della messa in esercizio.\n\nL'informativa deve indicare: titolare e contatti, finalità e basi giuridiche (prenotazione, prestazione sanitaria, obblighi di legge), categorie di dati (inclusi i dati relativi alla salute), destinatari e responsabili esterni (hosting, servizio email), tempi di conservazione, diritti dell'interessato e modalità di esercizio, diritto di reclamo al Garante.",
    cookiePolicy: "## Cookie policy\n\nQuesto sito utilizza esclusivamente cookie tecnici necessari al funzionamento (sessione dell'area riservata). Non sono utilizzati cookie di profilazione o di terze parti a fini pubblicitari.",
    bookingConsentText: "Ho letto l'informativa privacy e acconsento al trattamento dei miei dati per la gestione della richiesta di appuntamento.",
    disclaimer: "Le informazioni presenti sul sito hanno finalità esclusivamente informative e non sostituiscono la visita medica. Ogni trattamento viene proposto solo dopo valutazione clinica.",
  },
  security: { require2faForClinical: false },
};

export type Settings = typeof DEFAULT_SETTINGS;

function merge(base: any, over: any): any {
  if (Array.isArray(base) || typeof base !== "object" || base === null) return over === undefined ? base : over;
  const out: any = { ...base };
  for (const k of Object.keys(over || {})) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  return out;
}

let cache: { t: number; v: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.t < 30_000) return cache.v;
  const row = await one<{ value: any }>("SELECT value FROM settings WHERE key = 'site'");
  const v = merge(DEFAULT_SETTINGS, row?.value || {}) as Settings;
  cache = { t: Date.now(), v };
  return v;
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  const next = merge(current, patch);
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('site', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  cache = null;
  return next as Settings;
}

/** Parte pubblica delle impostazioni (niente email di notifica interne o opzioni di sicurezza). */
export function publicSettings(s: Settings) {
  const { emails, security, reminders, ...rest } = s;
  const { notifyEmail, ...booking } = s.booking;
  return { ...rest, booking };
}
