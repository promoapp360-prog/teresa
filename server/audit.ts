import type { Request } from "express";
import { pool } from "./db";
import { clientIp } from "./util";

/** Registra un'operazione rilevante (accessi, letture e modifiche di dati clinici). Non blocca mai la richiesta. */
export async function audit(req: Request | null, action: string, opts: { entity?: string; entityId?: number | null; patientId?: number | null; detail?: Record<string, unknown>; userId?: number | null; username?: string | null } = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, patient_id, ip, detail) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [opts.userId ?? req?.user?.id ?? null, opts.username ?? req?.user?.username ?? null, action, opts.entity ?? null, opts.entityId ?? null, opts.patientId ?? null, req ? clientIp(req) : null, opts.detail ? JSON.stringify(opts.detail) : null],
    );
  } catch (e) {
    console.error("[audit] registrazione non riuscita:", (e as Error).message);
  }
}
