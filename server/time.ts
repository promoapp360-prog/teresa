// Utility per il fuso Europe/Rome senza dipendenze esterne.
export const TZ = "Europe/Rome";

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** Offset (ms) di Europe/Rome rispetto a UTC all'istante dato. */
function offsetAt(d: Date) {
  const p = parts(d);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-05-12" + "09:30" (ora di Roma) -> Date UTC */
export function romeToDate(day: string, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ts = guess - offsetAt(new Date(guess));
  ts = guess - offsetAt(new Date(ts));
  return new Date(ts);
}

/** Date -> { day: "YYYY-MM-DD", time: "HH:MM", weekday 0-6 } in ora di Roma */
export function dateToRome(d: Date) {
  const p = parts(d);
  const day = `${p.year}-${p.month}-${p.day}`;
  const weekday = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
  return { day, time: `${p.hour}:${p.minute}`, weekday };
}

export const todayRome = () => dateToRome(new Date()).day;

export function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const fromMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function fmtRome(d: Date) {
  return d.toLocaleString("it-IT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
