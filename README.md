# Studio Medico Dott.ssa Teresa della Volpe

Sito web, prenotazioni online e gestionale con cartella clinica digitale per un unico medico.
Aree: **Terapia del Dolore, Ozonoterapia, IV Therapy, Medicina Estetica**. Progetto PromoApp.

## Avvio su Replit

1. Importa il repository (`https://github.com/promoapp360-prog/teresa.git`) come progetto Replit: il file `.replit` è già pronto.
2. Aggiungi il database **PostgreSQL** di Replit.
3. Secrets: `SESSION_SECRET`, `FILES_ENCRYPTION_KEY` (vedi `.env.example` per l'elenco completo).
4. **Run**. Sito: `/` · Gestionale: `/admin` (utente `Admin`, password iniziale `Teresa`, da cambiare al primo accesso).

Lo schema del database si crea automaticamente all'avvio (`migrations/`), con dati iniziali (prestazioni, orari lun–ven 9–13 / 15–19, modelli di consenso).

## Cosa contiene

### Sito pubblico
- Home, profilo della Dottoressa, pagina per ciascuna specializzazione, catalogo prestazioni con scheda (descrizione, durata, tariffa facoltativa, indicazioni informative), contatti con mappa, WhatsApp, telefono.
- SEO di base: meta tag per pagina generati dal server, dati strutturati `Physician`, `sitemap.xml`, `robots.txt`.
- Tutti i testi sono modificabili dal pannello (Impostazioni e Prestazioni).

### Prenotazioni online e agenda
- Scelta di prestazione, giorno e orario tra quelli realmente liberi (calcolati da orari settimanali, pause, ferie, assenze, chiusure, festività nazionali, durata della prestazione e appuntamenti già presenti).
- Richiesta da confermare (o conferma automatica), email di ricezione/conferma/annullamento, promemoria automatico configurabile, link per annullare.
- Agenda giornaliera e settimanale, inserimento manuale, spostamento con controllo delle sovrapposizioni, stati (da confermare, confermato, eseguito, annullato, non presentato), importi registrati, storico.

### Gestionale
- Cruscotto: appuntamenti del giorno, richieste da confermare, controlli e cicli in scadenza, chiusure, avvisi di configurazione.
- Anagrafiche pazienti con ricerca, storico prenotazioni ed esportazione CSV.
- Statistiche: andamento mensile, prestazioni più richieste, per specializzazione, annullamenti, prenotazioni online vs studio, importi.

### Cartella clinica (solo medico)
- Anamnesi personale e familiare, patologie, interventi, allergie (evidenziate), terapie in corso, trattamenti precedenti.
- Diario clinico cronologico; scheda visita con motivo, esame obiettivo, valutazione, note, indicazioni, risposta al trattamento, prossimo controllo.
- Dolore: **scala VAS 0–10** a ogni visita con grafico, **mappa anatomica interattiva** anteriore/posteriore con, per ogni area, lato, intensità, tipo, frequenza, durata, irradiazione, fattori che peggiorano/alleviano; confronto con la visita precedente e tabella di evoluzione per area.
- Farmaci prescritti e somministrati (dose, via, frequenza, durata); procedure con sede e materiali/prodotti; cicli di trattamento con sedute, controlli e valutazione della risposta.
- Esami del sangue con unità e intervalli di riferimento, valori fuori range evidenziati, grafico storico.
- Referti, immagini e documenti **cifrati AES-256-GCM** nel database.
- Consensi informati: modelli versionati per procedura, stampa del modulo precompilato, registrazione della firma con allegato, revoca; distinti dal consenso privacy.
- **Resoconto della visita in PDF** stampabile.

### Sicurezza
- Password Argon2id, cambio obbligatorio al primo accesso, blocco dopo 5 tentativi errati, limiti di frequenza su login e prenotazioni.
- **Autenticazione a due fattori** (app Authenticator), opzionalmente obbligatoria per la cartella clinica.
- Ruoli: *Medico* (accesso completo) e *Segreteria* (agenda e anagrafiche, nessun dato clinico).
- Sessioni su database con scadenza dopo 2 ore di inattività, revoca su tutti i dispositivi.
- **Registro accessi e operazioni** (login, consultazioni e modifiche della cartella, aperture documenti) con utente, data e IP.
- HTTPS/HSTS, intestazioni di sicurezza (Helmet), protezione CSRF, nessuna cache sulle API.
- Backup: punti di ripristino del database Replit e `npm run db:backup` (dump compresso con `pg_dump`).

> Lo Studio resta titolare del trattamento. Prima dell'uso con dati sanitari reali vanno completate le verifiche organizzative, legali e tecniche (informativa, nomine, hosting, eventuale DPIA) e redatti i testi definitivi di privacy e consensi.

## Struttura

```
server/        Express + PostgreSQL (pg), API pubbliche, gestionale e cliniche
  routes/      auth, public, admin, clinical
  migrations   migrate.ts applica migrations/*.sql
shared/        costanti condivise (stati, mappa anatomica)
client/        React + Vite + Tailwind (sito e gestionale /admin)
migrations/    schema SQL versionato
```

Comandi: `npm run dev` · `npm run build` · `npm start` · `npm run check` · `npm run db:backup`.
