import { q } from "./db";
import { getSettings } from "./settings";
import { romeToDate, dateToRome, weekdayOf, addDays, toMin, fromMin, todayRome } from "./time";

/** Festività nazionali italiane (inclusa Pasquetta). */
export function italianHolidays(year: number): Set<string> {
  // calcolo della Pasqua (algoritmo anonimo gregoriano)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const fixed = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"].map((x) => `${year}-${x}`);
  return new Set([...fixed, easter, addDays(easter, 1)]);
}

export const isHoliday = (day: string) => italianHolidays(Number(day.slice(0, 4))).has(day);

type Interval = [number, number];

function subtract(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [s, e] of intervals) {
    if (cut[1] <= s || cut[0] >= e) { out.push([s, e]); continue; }
    if (cut[0] > s) out.push([s, cut[0]]);
    if (cut[1] < e) out.push([cut[1], e]);
  }
  return out;
}

/** Fasce libere di un giorno in minuti (ora di Roma), al netto di orari, chiusure e appuntamenti. */
export async function freeIntervals(day: string, opts: { excludeAppointmentId?: number; ignoreHolidays?: boolean } = {}): Promise<Interval[]> {
  const s = await getSettings();
  if (!opts.ignoreHolidays && s.booking.autoHolidays && isHoliday(day)) return [];
  const hours = await q<{ startTime: string; endTime: string }>("SELECT start_time::text, end_time::text FROM weekly_hours WHERE weekday = $1 ORDER BY start_time", [weekdayOf(day)]);
  let free: Interval[] = hours.map((x) => [toMin(x.startTime.slice(0, 5)), toMin(x.endTime.slice(0, 5))]);
  if (!free.length) return [];

  const closures = await q<{ startTime: string | null; endTime: string | null }>(
    "SELECT start_time::text, end_time::text FROM closures WHERE $1::date BETWEEN start_day AND end_day", [day]);
  for (const c of closures) {
    if (!c.startTime || !c.endTime) return [];
    free = subtract(free, [toMin(c.startTime.slice(0, 5)), toMin(c.endTime.slice(0, 5))]);
  }

  const dayStart = romeToDate(day, "00:00"), dayEnd = romeToDate(addDays(day, 1), "00:00");
  const appts = await q<{ startsAt: Date; endsAt: Date }>(
    `SELECT starts_at, ends_at FROM appointments WHERE status IN ('requested','confirmed') AND starts_at < $2 AND ends_at > $1 AND id <> $3`,
    [dayStart, dayEnd, opts.excludeAppointmentId ?? 0]);
  for (const a of appts) {
    const st = a.startsAt < dayStart ? 0 : toMin(dateToRome(a.startsAt).time);
    const en = a.endsAt >= dayEnd ? 24 * 60 : toMin(dateToRome(a.endsAt).time);
    free = subtract(free, [st, en]);
  }
  return free;
}

/** Orari prenotabili online per una durata, rispettando preavviso minimo e orizzonte massimo. */
export async function slotsForDay(day: string, durationMin: number): Promise<string[]> {
  const s = await getSettings();
  const today = todayRome();
  if (day < today || day > addDays(today, s.booking.maxDaysAhead)) return [];
  const step = Math.max(5, s.booking.slotStepMin || 15);
  const earliest = Date.now() + s.booking.minNoticeHours * 3600_000;
  const out: string[] = [];
  for (const [st, en] of await freeIntervals(day)) {
    // allinea al passo della griglia
    for (let t = Math.ceil(st / step) * step; t + durationMin <= en; t += step) {
      if (romeToDate(day, fromMin(t)).getTime() >= earliest) out.push(fromMin(t));
    }
  }
  return out;
}

/** Verifica che l'intervallo richiesto sia libero (usata anche per inserimenti manuali). */
export async function isFree(day: string, time: string, durationMin: number, excludeAppointmentId?: number) {
  const st = toMin(time), en = st + durationMin;
  const free = await freeIntervals(day, { excludeAppointmentId, ignoreHolidays: false });
  return free.some(([a, b]) => st >= a && en <= b);
}
