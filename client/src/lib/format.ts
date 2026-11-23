const TZ = "Europe/Rome";

export const fmtDate = (d?: string | Date | null) => {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }
  return new Date(d).toLocaleDateString("it-IT", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
};
export const fmtTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "");
export const fmtDateTime = (d?: string | Date | null) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : "");
export const fmtLongDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
};
export const fmtMoney = (c?: number | null) => (c == null ? "" : (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" }));
export const centsToInput = (c?: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
export const inputToCents = (s: string) => { const t = s.trim().replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? Math.round(n * 100) : null; };

/** "YYYY-MM-DD" e "HH:MM" di un istante, in ora di Roma. */
export function romeParts(d: string | Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const todayRome = () => romeParts(new Date()).day;
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const weekdayOf = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const startOfWeek = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

/** Valore per <input type="datetime-local"> in ora di Roma, e ritorno a ISO. */
export const toLocalInput = (d: string | Date) => { const p = romeParts(d); return `${p.day}T${p.time}`; };
export function fromLocalInput(v: string) {
  // interpreta l'ora come Europe/Rome
  const [day, time] = v.split("T");
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = (t: number) => { const p = romeParts(new Date(t)); const [py, pm, pd] = p.day.split("-").map(Number); const [ph, pmi] = p.time.split(":").map(Number); return Date.UTC(py, pm - 1, pd, ph, pmi) - t; };
  let ts = guess - off(guess); ts = guess - off(ts);
  return new Date(ts).toISOString();
}

export const fullName = (x: { firstName?: string; lastName?: string } | null | undefined) => (x ? `${x.lastName ?? ""} ${x.firstName ?? ""}`.trim() : "");
export const age = (birth?: string | null) => {
  if (!birth) return null;
  const [y, m, d] = birth.split("-").map(Number);
  const t = todayRome().split("-").map(Number);
  return t[0] - y - (t[1] < m || (t[1] === m && t[2] < d) ? 1 : 0);
};
export const waLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "").replace(/^(?!39)(3\d{8,9})$/, "39$1")}`;
