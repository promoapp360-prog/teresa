# Studio Medico Dott.ssa Teresa della Volpe – note per Replit

Progetto PromoApp **già completo e pronto all'uso**: sito pubblico, prenotazioni online, gestionale e cartella clinica digitale.
Repository sorgente: `https://github.com/promoapp360-prog/teresa.git`, branch `main`.

## Regole per l'Agent (importante)

- **Non ricostruire, non riscrivere e non ristrutturare il progetto.** Va importato ed eseguito così com'è, alla radice del Repl.
- **Non** convertirlo in workspace pnpm, monorepo o `artifacts/…`, non creare un nuovo progetto e non passare il codice in una chat: il file `.replit` alla radice è già configurato.
- Unici passaggi richiesti:
  1. Aggiungere il database **PostgreSQL di Replit** (crea da solo `DATABASE_URL`).
  2. Impostare nei **Secrets**: `SESSION_SECRET` (stringa lunga casuale) e `FILES_ENCRYPTION_KEY` (altra stringa lunga casuale, da non cambiare più).
  3. Premere **Run** (`npm install && npm run dev`, porta 5000).
- Le tabelle si creano da sole all'avvio (file `migrations/*.sql`), insieme a specializzazioni, prestazioni, orari e modelli di consenso. Non usare drizzle-kit push o altri generatori di schema.
- Non collegare servizi esterni, non pubblicare e non modificare la grafica senza richiesta esplicita.
- Non usare force push sul repository.

## Accesso al gestionale

- Indirizzo: `/admin`
- Utente: **Admin** – password iniziale: **Teresa** (oppure il valore del Secret `ADMIN_INITIAL_PASSWORD`, se impostato prima del primo avvio).
- Al primo accesso il sistema obbliga a scegliere una nuova password robusta (almeno 10 caratteri, maiuscole, minuscole e numeri).

## Dati dimostrativi

Per presentare il gestionale alla Dottoressa con pazienti di esempio (dati inventati) impostare il Secret `SEED_DEMO=true` e riavviare. Prima dell'uso con dati reali rimuovere il Secret ed eliminare/archiviare i pazienti di esempio (note "[DEMO]").

## Pubblicazione

Deploy → **Autoscale** (build `npm install --include=dev && npm run build`, run `npm start`), già impostato in `.replit`.
Per promemoria email sempre puntuali è preferibile **Reserved VM** (con Autoscale l'app si sospende senza visite), oppure impostare `CRON_SECRET` e far chiamare `POST /api/cron` (header `x-cron-secret`) da un servizio esterno ogni 15 minuti.

Email: impostare `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`; senza questi valori le email vengono registrate come "simulate". `PUBLIC_URL` = indirizzo definitivo del sito.
