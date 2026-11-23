import { one, pool, q, tx } from "./db";
import { hashPassword } from "./auth";
import { slugify } from "./util";
import { romeToDate, todayRome, addDays } from "./time";

type Svc = [name: string, duration: number, short: string];

const CATEGORIES: { slug: string; name: string; subtitle: string; icon: string; intro: string; body: string; services: Svc[] }[] = [
  {
    slug: "terapia-del-dolore", name: "Terapia del Dolore", icon: "activity",
    subtitle: "Valutazione e trattamento del dolore acuto e cronico",
    intro: "Un percorso dedicato a chi convive con il dolore: dalla visita iniziale alla scelta del trattamento più adatto, con controlli che documentano l'evoluzione nel tempo.",
    body: "La Terapia del Dolore si occupa della diagnosi e del trattamento del dolore acuto e cronico, ad esempio a carico della colonna vertebrale, delle articolazioni e dei tessuti molli.\n\nOgni percorso inizia con una visita approfondita: storia clinica, esami già eseguiti, localizzazione e caratteristiche del dolore, misurato con la scala VAS da 0 a 10. Sulla base della valutazione la Dottoressa propone il trattamento più indicato e programma i controlli successivi.\n\nI trattamenti vengono eseguiti solo dopo valutazione clinica e consenso informato.",
    services: [
      ["Prima visita di Terapia del Dolore", 45, "Valutazione clinica completa, misurazione del dolore e impostazione del percorso."],
      ["Visita di controllo", 30, "Rivalutazione del dolore e della risposta al trattamento."],
      ["Infiltrazione articolare e periarticolare", 30, "Trattamento locale eseguito dopo valutazione clinica."],
      ["Mesoterapia antalgica", 30, "Microiniezioni locali nell'area dolorosa."],
      ["Trattamento dei trigger point", 30, "Trattamento mirato dei punti miofasciali dolorosi."],
    ],
  },
  {
    slug: "ozonoterapia", name: "Ozonoterapia", icon: "wind",
    subtitle: "Ossigeno-ozonoterapia con indicazione medica",
    intro: "L'ossigeno-ozonoterapia viene proposta dopo visita, quando indicata, con cicli di sedute pianificati e monitorati.",
    body: "L'ossigeno-ozonoterapia utilizza una miscela di ossigeno e ozono medicale somministrata con diverse modalità (locale, intramuscolare paravertebrale, intrarticolare o sistemica) secondo indicazione medica.\n\nIl trattamento è organizzato in cicli: numero e frequenza delle sedute vengono stabiliti dopo la prima valutazione e adattati in base alla risposta, registrata a ogni controllo.\n\nPrima di ogni ciclo vengono verificati anamnesi, terapie in corso ed eventuali controindicazioni.",
    services: [
      ["Prima visita e valutazione per ozonoterapia", 30, "Valutazione dell'indicazione e pianificazione del ciclo."],
      ["Ossigeno-ozonoterapia paravertebrale", 30, "Seduta del ciclo programmato per il rachide."],
      ["Ozonoterapia intrarticolare", 30, "Seduta per il trattamento articolare."],
      ["Ozonoterapia sottocutanea", 30, "Seduta locale programmata."],
      ["Grande autoemoinfusione (GAET)", 60, "Seduta sistemica su indicazione medica."],
    ],
  },
  {
    slug: "iv-therapy", name: "IV Therapy", icon: "droplet",
    subtitle: "Infusioni endovenose personalizzate",
    intro: "Infusioni endovenose formulate dopo consulto medico, eseguite in ambiente protetto e confortevole.",
    body: "La IV Therapy prevede la somministrazione endovenosa di soluzioni con vitamine, sali minerali, antiossidanti o liquidi, formulate in base alla valutazione medica.\n\nOgni infusione è preceduta da un consulto con anamnesi e, quando opportuno, dalla valutazione di esami del sangue recenti. Durante l'infusione il paziente è seguito dalla Dottoressa.\n\nLa composizione, la frequenza e la durata del ciclo sono personalizzate e registrate nella cartella clinica.",
    services: [
      ["Consulto IV Therapy", 30, "Anamnesi, valutazione degli esami e scelta dell'infusione."],
      ["Infusione vitaminica", 60, "Infusione personalizzata secondo prescrizione."],
      ["Infusione antiossidante", 60, "Infusione su indicazione medica."],
      ["Infusione idratante e reintegrante", 60, "Reintegro di liquidi e sali minerali."],
    ],
  },
  {
    slug: "medicina-estetica", name: "Medicina Estetica", icon: "sparkles",
    subtitle: "Trattamenti medici per viso e corpo, con risultati naturali",
    intro: "Trattamenti di medicina estetica eseguiti dal medico, con attenzione all'armonia del viso e alla naturalezza del risultato.",
    body: "La Medicina Estetica comprende trattamenti medici non chirurgici per il viso e il corpo. Ogni percorso inizia con una consulenza in cui si valutano obiettivi, aspettative realistiche, anamnesi ed eventuali controindicazioni.\n\nI prodotti utilizzati, le sedi di trattamento e i controlli successivi vengono registrati nella cartella clinica.\n\nI risultati variano da persona a persona: la Dottoressa illustra in consulenza benefici, limiti e possibili effetti indesiderati di ciascun trattamento.",
    services: [
      ["Consulenza di Medicina Estetica", 30, "Valutazione e proposta di un piano personalizzato."],
      ["Biorivitalizzazione viso", 45, "Trattamento per idratazione e qualità della pelle."],
      ["Filler con acido ialuronico", 45, "Trattamento di volumi e inestetismi del viso."],
      ["Tossina botulinica", 30, "Trattamento delle rughe d'espressione."],
      ["Peeling medico", 45, "Rinnovamento cutaneo con prodotti di uso medico."],
      ["Mesoterapia corpo", 30, "Trattamento localizzato per inestetismi del corpo."],
      ["Carbossiterapia", 30, "Seduta per inestetismi localizzati."],
    ],
  },
];

const CONSENTS: { name: string; area: string; body: string }[] = [
  { name: "Consenso informato – Terapia infiltrativa", area: "Terapia del Dolore", body: "Il/La sottoscritto/a dichiara di essere stato/a informato/a in modo chiaro e comprensibile sulla natura della procedura infiltrativa proposta, sui benefici attesi, sulle possibili alternative, sui rischi e sui possibili effetti indesiderati, e di aver potuto porre domande ricevendo risposte esaurienti.\n\n[Testo da completare e approvare a cura dello Studio]" },
  { name: "Consenso informato – Ossigeno-ozonoterapia", area: "Ozonoterapia", body: "Il/La sottoscritto/a dichiara di essere stato/a informato/a sulle modalità di esecuzione dell'ossigeno-ozonoterapia, sul numero di sedute previsto, sui benefici attesi, sulle alternative e sui possibili effetti indesiderati.\n\n[Testo da completare e approvare a cura dello Studio]" },
  { name: "Consenso informato – Terapia infusionale endovenosa", area: "IV Therapy", body: "Il/La sottoscritto/a dichiara di essere stato/a informato/a sulla composizione dell'infusione proposta, sulle modalità di somministrazione endovenosa, sui benefici attesi e sui possibili effetti indesiderati.\n\n[Testo da completare e approvare a cura dello Studio]" },
  { name: "Consenso informato – Trattamenti di medicina estetica", area: "Medicina Estetica", body: "Il/La sottoscritto/a dichiara di essere stato/a informato/a sul trattamento proposto, sul prodotto utilizzato, sui risultati attesi e sulla loro variabilità individuale, sulla durata, sulle alternative e sui possibili effetti indesiderati.\n\n[Testo da completare e approvare a cura dello Studio]" },
];

export async function seedIfEmpty() {
  // amministratore iniziale (medico): username "Admin"
  const admins = await one<{ n: number }>("SELECT count(*)::int AS n FROM users");
  if (!admins?.n) {
    const pw = process.env.ADMIN_INITIAL_PASSWORD || "Teresa";
    await pool.query(
      `INSERT INTO users (username, full_name, role, password_hash, must_change_password) VALUES ('Admin', 'Dott.ssa Teresa della Volpe', 'doctor', $1, true)`,
      [await hashPassword(pw)]);
    console.log("[seed] creato utente Admin (cambio password obbligatorio al primo accesso)");
  }

  const cats = await one<{ n: number }>("SELECT count(*)::int AS n FROM categories");
  if (!cats?.n) {
    await tx(async (c) => {
      let ci = 0;
      for (const cat of CATEGORIES) {
        const { rows } = await c.query(
          `INSERT INTO categories (slug, name, subtitle, intro, body, icon, sort) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [cat.slug, cat.name, cat.subtitle, cat.intro, cat.body, cat.icon, ci++]);
        let si = 0;
        for (const [name, duration, short] of cat.services) {
          await c.query(
            `INSERT INTO services (category_id, slug, name, short_description, description, info_notes, duration_min, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [rows[0].id, slugify(name), name, short, `${short}\n\nDurata indicativa: ${duration} minuti. Il trattamento viene eseguito solo dopo valutazione medica.`,
              "Testo informativo da approvare a cura dello studio.", duration, si++]);
        }
      }
      // orari standard: lun–ven 9–13 e 15–19
      for (const wd of [1, 2, 3, 4, 5]) {
        await c.query("INSERT INTO weekly_hours (weekday, start_time, end_time) VALUES ($1,'09:00','13:00'), ($1,'15:00','19:00')", [wd]);
      }
      for (const t of CONSENTS) {
        await c.query("INSERT INTO consent_templates (name, area, version, body) VALUES ($1,$2,'1.0',$3)", [t.name, t.area, t.body]);
      }
    });
    console.log("[seed] caricate specializzazioni, prestazioni, orari e modelli di consenso");
  }

  if (process.env.SEED_DEMO === "true") await seedDemo();
}

/** Pazienti dimostrativi con dati INVENTATI, per presentare il gestionale. */
async function seedDemo() {
  const exists = await one<{ n: number }>("SELECT count(*)::int AS n FROM patients WHERE notes LIKE '[DEMO]%'");
  if (exists?.n) return;
  const svc = await q<{ id: number; name: string; durationMin: number; slug: string }>("SELECT id, name, duration_min, slug FROM services");
  const pick = (slug: string) => svc.find((s) => s.slug === slug) || svc[0];
  const today = todayRome();
  await tx(async (c) => {
    const mk = async (p: any) => (await c.query(
      `INSERT INTO patients (first_name, last_name, birth_date, sex, phone, email, city, notes, privacy_accepted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()) RETURNING id`,
      [p.first, p.last, p.birth, p.sex, p.phone, p.email, p.city, "[DEMO] Paziente di esempio con dati inventati"])).rows[0].id as number;

    const p1 = await mk({ first: "Marta", last: "Esposito", birth: "1971-04-12", sex: "F", phone: "3330000001", email: "marta.demo@example.com", city: "Roma" });
    const p2 = await mk({ first: "Giorgio", last: "Ferri", birth: "1964-09-30", sex: "M", phone: "3330000002", email: "giorgio.demo@example.com", city: "Roma" });
    const p3 = await mk({ first: "Elena", last: "Conti", birth: "1985-01-22", sex: "F", phone: "3330000003", email: "elena.demo@example.com", city: "Roma" });

    await c.query(`INSERT INTO anamnesis (patient_id, personal, family, pathologies, surgeries, allergies, current_therapies, previous_treatments) VALUES
      ($1, 'Impiegata, lavoro sedentario. Non fumatrice.', 'Madre con artrosi.', 'Lombalgia cronica da circa 3 anni.', 'Appendicectomia (1990).', 'Nessuna allergia nota.', 'Paracetamolo al bisogno.', 'Fisioterapia nel 2023 con beneficio parziale.')`, [p1]);
    await c.query(`INSERT INTO anamnesis (patient_id, personal, pathologies, allergies, current_therapies) VALUES
      ($1, 'Pensionato, attività fisica moderata.', 'Gonartrosi bilaterale, ipertensione arteriosa in trattamento.', 'Allergia a penicillina.', 'Antipertensivo quotidiano.')`, [p2]);

    // percorso di p1: tre visite con VAS in miglioramento
    const cyc = (await c.query(`INSERT INTO treatment_cycles (patient_id, area, name, start_date, planned_sessions, status, next_check_date, response)
      VALUES ($1,'Ozonoterapia','Ossigeno-ozonoterapia paravertebrale lombare',$2,8,'attivo',$3,'Buona risposta dopo le prime sedute.') RETURNING id`,
      [p1, addDays(today, -42), addDays(today, 7)])).rows[0].id;
    const vis = [
      { d: -42, vas: 8, reason: "Lombalgia con irradiazione alla coscia sinistra.", assess: "Lombalgia cronica con componente radicolare L5 sinistra." , intensity: [8, 6] },
      { d: -21, vas: 6, reason: "Controllo dopo 3 sedute.", assess: "Miglioramento del dolore lombare, irradiazione ridotta.", intensity: [6, 4] },
      { d: -7, vas: 4, reason: "Controllo dopo 6 sedute.", assess: "Ulteriore miglioramento, migliore autonomia nelle attività quotidiane.", intensity: [4, 2] },
    ];
    for (const v of vis) {
      const vid = (await c.query(`INSERT INTO visits (patient_id, visit_date, area, reason, objective_exam, assessment, indications, vas) VALUES ($1,$2,'Terapia del Dolore',$3,$4,$5,$6,$7) RETURNING id`,
        [p1, romeToDate(addDays(today, v.d), "10:00"), v.reason, "Dolore alla palpazione paravertebrale L4-L5, Lasègue positivo a 60° a sinistra.", v.assess, "Proseguire il ciclo. Esercizi posturali quotidiani.", v.vas])).rows[0].id;
      await c.query(`INSERT INTO pain_areas (visit_id, region, view, side, intensity, pain_type, frequency, duration, radiation, worsening, relieving) VALUES
        ($1,'back_lombare','back','centrale',$2,'Sordo','Quotidiano','3 anni','Gluteo e coscia sinistra','Posizione seduta prolungata','Riposo, calore'),
        ($1,'back_coscia_post_sx','back','sinistro',$3,'Elettrico/scossa','Più volte a settimana','6 mesi',null,'Flessione del tronco','Posizione supina')`, [vid, v.intensity[0], v.intensity[1]]);
      await c.query(`INSERT INTO procedures (patient_id, visit_id, cycle_id, proc_date, name, site, materials) VALUES ($1,$2,$3,$4,'Ossigeno-ozonoterapia paravertebrale','L4-L5 bilaterale','O2-O3 20 ml per lato, 20 µg/ml')`,
        [p1, vid, cyc, addDays(today, v.d)]);
    }
    await c.query(`INSERT INTO medications (patient_id, kind, med_date, drug, dose, route, frequency, duration) VALUES ($1,'prescritto',$2,'Paracetamolo','1000 mg','orale','al bisogno, max 3 volte al giorno','2 settimane')`, [p1, addDays(today, -42)]);

    // esami di p2
    for (const [d, hb, ferr, vitd] of [[-120, 13.8, 22, 18], [-30, 14.1, 41, 29]] as const) {
      await c.query(`INSERT INTO lab_results (patient_id, test_date, test_name, value, unit, ref_min, ref_max) VALUES
        ($1,$2,'Emoglobina',$3,'g/dL',13,17), ($1,$2,'Ferritina',$4,'ng/mL',30,400), ($1,$2,'Vitamina D (25-OH)',$5,'ng/mL',30,100)`, [p2, addDays(today, d), hb, ferr, vitd]);
    }

    // agenda: alcuni appuntamenti futuri
    const ap = async (pid: number, slug: string, dayOff: number, time: string, status: string) => {
      const s = pick(slug);
      const st = romeToDate(addDays(today, dayOff), time);
      await c.query(`INSERT INTO appointments (patient_id, service_id, service_name, starts_at, ends_at, status, source, manage_token) VALUES ($1,$2,$3,$4,$5,$6,'studio', md5(random()::text))`,
        [pid, s.id, s.name, st, new Date(st.getTime() + s.durationMin * 60000), status]);
    };
    await ap(p1, "ossigeno-ozonoterapia-paravertebrale", 1, "10:00", "confirmed");
    await ap(p2, "prima-visita-di-terapia-del-dolore", 2, "16:00", "confirmed");
    await ap(p3, "consulenza-di-medicina-estetica", 3, "11:30", "requested");
  });
  console.log("[seed] caricati pazienti dimostrativi (dati inventati)");
}
