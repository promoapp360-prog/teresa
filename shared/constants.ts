// Costanti condivise tra server e client.

export const APPOINTMENT_STATUSES = ["requested", "confirmed", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Da confermare",
  confirmed: "Confermato",
  completed: "Eseguito",
  cancelled: "Annullato",
  no_show: "Non presentato",
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-slate-200 text-slate-600",
  no_show: "bg-red-100 text-red-700",
};

export const CLOSURE_KINDS = ["ferie", "assenza", "festivita", "pausa", "chiusura"] as const;
export const CLOSURE_LABELS: Record<string, string> = {
  ferie: "Ferie", assenza: "Assenza", festivita: "Festività", pausa: "Pausa", chiusura: "Chiusura straordinaria",
};

export const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export const TREATMENT_AREAS = ["Terapia del Dolore", "Ozonoterapia", "IV Therapy", "Medicina Estetica", "Altro"];

export const PAIN_TYPES = ["Sordo", "Urente (bruciore)", "Trafittivo", "Pulsante", "Crampiforme", "Elettrico/scossa", "Tensivo", "Formicolio/parestesie", "Altro"];
export const PAIN_FREQUENCIES = ["Continuo", "Quotidiano", "Più volte a settimana", "Settimanale", "Occasionale", "Solo sotto sforzo"];
export const PAIN_SIDES = ["destro", "sinistro", "bilaterale", "centrale"];

export const DOC_KINDS: Record<string, string> = {
  referto: "Referto", immagine: "Immagine", esame: "Esame", lettera: "Lettera", altro: "Altro",
};

export const ROLE_LABELS: Record<string, string> = { doctor: "Medico (accesso completo)", staff: "Segreteria (senza dati clinici)" };

// ---------- mappa anatomica ----------
export type BodyView = "front" | "back";
export type BodyRegion = { id: string; label: string; view: BodyView; side: string; x: number; y: number; w: number; h: number; rx: number; shape?: "ellipse" };

const W = 220;
type Part = { key: string; label: string; x: number; y: number; w: number; h: number; rx?: number; shape?: "ellipse"; central?: boolean };

const FRONT: Part[] = [
  { key: "testa", label: "Testa / viso", x: 84, y: 8, w: 52, h: 62, central: true, shape: "ellipse" },
  { key: "collo", label: "Collo (anteriore)", x: 98, y: 70, w: 24, h: 18, central: true },
  { key: "spalla", label: "Spalla", x: 54, y: 88, w: 32, h: 26, rx: 12 },
  { key: "torace", label: "Torace", x: 87, y: 88, w: 46, h: 62, central: true },
  { key: "addome", label: "Addome", x: 89, y: 152, w: 42, h: 50, central: true },
  { key: "pelvi", label: "Inguine / pelvi", x: 87, y: 204, w: 46, h: 34, central: true },
  { key: "braccio", label: "Braccio", x: 48, y: 116, w: 26, h: 62 },
  { key: "gomito", label: "Gomito", x: 45, y: 180, w: 26, h: 18 },
  { key: "avambraccio", label: "Avambraccio", x: 41, y: 200, w: 26, h: 56 },
  { key: "mano", label: "Polso / mano", x: 36, y: 258, w: 28, h: 38 },
  { key: "coscia", label: "Coscia", x: 87, y: 240, w: 22, h: 80 },
  { key: "ginocchio", label: "Ginocchio", x: 87, y: 322, w: 22, h: 24 },
  { key: "gamba", label: "Gamba", x: 88, y: 348, w: 20, h: 70 },
  { key: "piede", label: "Caviglia / piede", x: 84, y: 420, w: 26, h: 32 },
];

const BACK: Part[] = [
  { key: "nuca", label: "Nuca / occipite", x: 84, y: 8, w: 52, h: 62, central: true, shape: "ellipse" },
  { key: "cervicale", label: "Rachide cervicale", x: 98, y: 70, w: 24, h: 18, central: true },
  { key: "scapola", label: "Spalla / scapola", x: 54, y: 88, w: 32, h: 30, rx: 12 },
  { key: "dorsale", label: "Rachide dorsale", x: 87, y: 88, w: 46, h: 64, central: true },
  { key: "lombare", label: "Rachide lombare", x: 89, y: 154, w: 42, h: 44, central: true },
  { key: "sacrale", label: "Regione sacrale", x: 99, y: 200, w: 22, h: 22, central: true },
  { key: "gluteo", label: "Gluteo", x: 86, y: 204, w: 12, h: 36 },
  { key: "braccio_post", label: "Braccio (posteriore)", x: 48, y: 120, w: 26, h: 58 },
  { key: "gomito_post", label: "Gomito (posteriore)", x: 45, y: 180, w: 26, h: 18 },
  { key: "avambraccio_post", label: "Avambraccio (dorsale)", x: 41, y: 200, w: 26, h: 56 },
  { key: "mano_dorso", label: "Dorso della mano", x: 36, y: 258, w: 28, h: 38 },
  { key: "coscia_post", label: "Coscia (posteriore)", x: 87, y: 242, w: 22, h: 78 },
  { key: "poplite", label: "Cavo popliteo", x: 87, y: 322, w: 22, h: 24 },
  { key: "polpaccio", label: "Polpaccio", x: 88, y: 348, w: 20, h: 70 },
  { key: "tallone", label: "Tallone / pianta", x: 84, y: 420, w: 26, h: 32 },
];

function build(parts: Part[], view: BodyView): BodyRegion[] {
  const out: BodyRegion[] = [];
  // vista anteriore: il lato destro del paziente è a sinistra dell'immagine; vista posteriore il contrario
  const imageLeft = view === "front" ? "destro" : "sinistro";
  const imageRight = view === "front" ? "sinistro" : "destro";
  for (const p of parts) {
    const rx = p.rx ?? 9;
    if (p.central) { out.push({ id: `${view}_${p.key}`, label: p.label, view, side: "centrale", x: p.x, y: p.y, w: p.w, h: p.h, rx, shape: p.shape }); continue; }
    out.push({ id: `${view}_${p.key}_${imageLeft === "destro" ? "dx" : "sx"}`, label: `${p.label} ${imageLeft}`, view, side: imageLeft, x: p.x, y: p.y, w: p.w, h: p.h, rx, shape: p.shape });
    out.push({ id: `${view}_${p.key}_${imageRight === "destro" ? "dx" : "sx"}`, label: `${p.label} ${imageRight}`, view, side: imageRight, x: W - p.x - p.w, y: p.y, w: p.w, h: p.h, rx, shape: p.shape });
  }
  return out;
}

export const BODY_REGIONS: BodyRegion[] = [...build(FRONT, "front"), ...build(BACK, "back")];
export const BODY_VIEWBOX = `0 0 ${W} 460`;
export const regionLabel = (id: string) => BODY_REGIONS.find((r) => r.id === id)?.label || id;

// colore per intensità 0–10 (verde → giallo → rosso)
export function intensityColor(v: number | null | undefined) {
  if (v == null) return "#94a3b8";
  const n = Math.max(0, Math.min(10, v));
  const hue = 120 - n * 12;
  return `hsl(${hue} 70% 48%)`;
}
