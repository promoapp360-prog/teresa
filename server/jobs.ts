import { pool, q } from "./db";
import { getSettings } from "./settings";
import { appointmentEmail, processOutbox } from "./mail";

/** Accoda i promemoria per gli appuntamenti confermati entro la finestra configurata. */
export async function queueReminders() {
  const s = await getSettings();
  if (!s.reminders.enabled) return 0;
  const rows = await q<{ id: number }>(
    `SELECT id FROM appointments WHERE status = 'confirmed' AND reminder_sent_at IS NULL
       AND starts_at > now() AND starts_at <= now() + ($1 * interval '1 hour')`, [s.reminders.hoursBefore]);
  for (const r of rows) {
    // marca prima di accodare: evita doppi invii con più istanze
    const upd = await pool.query(`UPDATE appointments SET reminder_sent_at = now() WHERE id = $1 AND reminder_sent_at IS NULL`, [r.id]);
    if (upd.rowCount) await appointmentEmail("reminder", r.id);
  }
  return rows.length;
}

export async function runJobsOnce() {
  const c = await pool.connect();
  try {
    const { rows } = await c.query("SELECT pg_try_advisory_lock(771101) AS ok");
    if (!rows[0].ok) return;
    try {
      await queueReminders();
      await processOutbox();
      await c.query(`DELETE FROM "session" WHERE expire < now()`);
    } finally {
      await c.query("SELECT pg_advisory_unlock(771101)");
    }
  } finally {
    c.release();
  }
}

export function startJobs() {
  const tick = () => runJobsOnce().catch((e) => console.error("[jobs]", e.message));
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
