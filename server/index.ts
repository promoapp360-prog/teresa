import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import helmet from "helmet";
import { pool, one } from "./db";
import { runMigrations } from "./migrate";
import { seedIfEmpty } from "./seed";
import { setupSession, csrfGuard } from "./auth";
import { errorHandler, esc } from "./util";
import { getSettings } from "./settings";
import { startJobs, runJobsOnce } from "./jobs";
import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";
import clinicalRoutes from "./routes/clinical";

const isProd = process.env.NODE_ENV === "production";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  // Le migrazioni SQL sono idempotenti e protette da lock: si applicano a ogni avvio (sviluppo e pubblicazione).
  await runMigrations();
  await seedIfEmpty();

  const app = express();
  const server = http.createServer(app);
  app.disable("x-powered-by");
  app.use(helmet({
    frameguard: isProd ? { action: "sameorigin" } : false, // l'anteprima Replit usa un iframe
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "frame-ancestors": isProd ? ["'self'"] : null,
        "script-src": ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"])],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "frame-src": ["'self'", "https://www.google.com", "https://maps.google.com"],
        "connect-src": ["'self'", ...(isProd ? [] : ["ws:", "wss:"])],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "object-src": ["'self'"],
        "upgrade-insecure-requests": isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression());
  app.use("/api", csrfGuard);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  setupSession(app);
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  app.get("/api/health", async (_req, res) => { await one("SELECT 1"); res.json({ ok: true }); });

  // Promemoria con deploy Autoscale: un servizio esterno può chiamare POST /api/cron con l'header x-cron-secret
  app.post("/api/cron", async (req, res, next) => {
    if (!process.env.CRON_SECRET || req.get("x-cron-secret") !== process.env.CRON_SECRET) return res.status(403).json({ error: "Non autorizzato" });
    try { await runJobsOnce(); res.json({ ok: true }); } catch (e) { next(e); }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/clinical", clinicalRoutes);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint inesistente" }));

  app.get("/robots.txt", (req, res) => {
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    res.type("text/plain").send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /prenotazione/\nSitemap: ${base}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
      const cats = await pool.query("SELECT slug FROM categories WHERE active");
      const svcs = await pool.query("SELECT slug FROM services WHERE active");
      const urls = ["/", "/la-dottoressa", "/prestazioni", "/prenota", "/contatti", ...cats.rows.map((c) => `/${c.slug}`), ...svcs.rows.map((s) => `/prestazioni/${s.slug}`)];
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join("")}</urlset>`);
    } catch (e) { next(e); }
  });

  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({ configFile: path.join(ROOT, "vite.config.ts"), server: { middlewareMode: true, hmr: { server } }, appType: "custom" });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        let html = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(await injectMeta(html, req.originalUrl));
      } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); }
    });
  } else {
    const dist = path.join(ROOT, "dist/public");
    if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("Build mancante: esegui `npm run build` prima di `npm start`.");
    app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1y", immutable: true }));
    app.use(express.static(dist, { maxAge: "1h", index: false }));
    const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    app.get("*", async (req, res, next) => {
      try { res.set("Cache-Control", "no-cache").type("html").send(await injectMeta(template, req.originalUrl)); } catch (e) { next(e); }
    });
  }

  app.use(errorHandler);
  const port = Number(process.env.PORT || 5000);
  server.listen(port, "0.0.0.0", () => console.log(`Studio della Volpe in ascolto su http://0.0.0.0:${port} (${isProd ? "produzione" : "sviluppo"})`));
  startJobs();

  const shutdown = () => { server.close(() => pool.end().finally(() => process.exit(0))); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// ---------- meta tag SEO lato server ----------
const metaCache = new Map<string, { t: number; title: string; desc: string }>();

async function injectMeta(html: string, url: string) {
  const pathname = url.split("?")[0].replace(/\/$/, "") || "/";
  const s = await getSettings();
  let title = s.seo.title, desc = s.seo.description;
  const cached = metaCache.get(pathname);
  if (cached && Date.now() - cached.t < 300_000) { title = cached.title; desc = cached.desc; }
  else {
    const seg = pathname.split("/").filter(Boolean);
    if (seg.length === 1) {
      const c = await one<any>("SELECT name, subtitle, intro FROM categories WHERE slug = $1 AND active", [seg[0]]);
      if (c) { title = `${c.name} | ${s.studio.doctorName}`; desc = c.intro || c.subtitle || desc; }
      else if (seg[0] === "la-dottoressa") title = `${s.studio.doctorName} | Profilo`;
      else if (seg[0] === "prestazioni") title = `Prestazioni e trattamenti | ${s.studio.doctorName}`;
      else if (seg[0] === "prenota") title = `Prenota una visita | ${s.studio.doctorName}`;
      else if (seg[0] === "contatti") title = `Contatti | ${s.studio.name}`;
    } else if (seg[0] === "prestazioni" && seg[1]) {
      const sv = await one<any>("SELECT name, short_description FROM services WHERE slug = $1 AND active", [seg[1]]);
      if (sv) { title = `${sv.name} | ${s.studio.doctorName}`; desc = sv.shortDescription || desc; }
    }
    metaCache.set(pathname, { t: Date.now(), title, desc });
  }
  const base = process.env.PUBLIC_URL || "";
  const priv = pathname.startsWith("/admin") || pathname.startsWith("/prenotazione/");
  const ld = {
    "@context": "https://schema.org", "@type": "Physician", name: s.studio.doctorName, medicalSpecialty: ["PainMedicine", "Dermatology"],
    telephone: s.studio.phone || undefined, email: s.studio.email || undefined, url: base || undefined,
    address: { "@type": "PostalAddress", streetAddress: s.studio.address, addressLocality: s.studio.city || undefined, postalCode: s.studio.postalCode || undefined, addressCountry: "IT" },
  };
  return html.replace("<!--META-->", [
    `<title>${esc(title)}</title>`, `<meta name="description" content="${esc(desc)}">`, `<meta name="robots" content="${priv ? "noindex, nofollow" : "index, follow"}">`,
    `<link rel="canonical" href="${base}${pathname}">`, `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:locale" content="it_IT">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    "));
}

main().catch((e) => { console.error("Avvio non riuscito:", e); process.exit(1); });
