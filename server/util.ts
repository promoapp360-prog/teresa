import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Wrapper per handler async: inoltra gli errori al middleware centrale. */
export const h = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: `Dati non validi: ${first.path.join(".") || "campo"} – ${first.message}` });
  }
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File troppo grande (massimo 15 MB)" });
  const status = err.status || err.statusCode || 500;
  if (err.code === "23505") return res.status(409).json({ error: "Valore già presente (duplicato)" });
  if (err.code === "23503") return res.status(409).json({ error: "Operazione non possibile: il dato è collegato ad altri record" });
  if (err.code === "23514") return res.status(400).json({ error: "Valore non consentito" });
  if (status >= 500) console.error("[errore]", err);
  res.status(status).json({ error: status >= 500 ? "Errore interno, riprova" : err.message });
}

export const id = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "ID non valido");
  return n;
};

export const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "voce";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// campi zod comuni
const empty = (v: unknown) => (v === "" || v === undefined ? null : v);
export const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data non valida");
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "ora non valida");
export const zStr = (max = 255) => z.preprocess(empty, z.string().trim().max(max).nullable());
export const zText = () => z.preprocess(empty, z.string().max(20000).nullable());
export const zOptDay = z.preprocess(empty, zDay.nullable());
export const zOptInt = (min = 0, max = 1_000_000_000) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(min).max(max).nullable());
export const zOptNum = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.number().finite().nullable());

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\n");
}

export const clientIp = (req: Request) => (req.ip || "").slice(0, 64);
