-- Studio Medico Dott.ssa Teresa della Volpe – schema iniziale

CREATE TABLE users (
  id serial PRIMARY KEY,
  username varchar(60) NOT NULL UNIQUE,
  full_name varchar(120),
  email varchar(160),
  role varchar(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('doctor', 'staff')),
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  session_version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX session_expire_idx ON "session" (expire);

CREATE TABLE settings (
  key varchar(60) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- sito e prestazioni ----------
CREATE TABLE categories (
  id serial PRIMARY KEY,
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  subtitle varchar(255),
  intro text,
  body text,
  icon varchar(40),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE services (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug varchar(120) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  short_description varchar(300),
  description text,
  info_notes text,
  duration_min integer NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 5 AND 480),
  price_cents integer CHECK (price_cents >= 0),
  show_price boolean NOT NULL DEFAULT false,
  bookable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_category_idx ON services (category_id);

-- ---------- disponibilità ----------
CREATE TABLE weekly_hours (
  id serial PRIMARY KEY,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE closures (
  id serial PRIMARY KEY,
  kind varchar(20) NOT NULL DEFAULT 'chiusura' CHECK (kind IN ('ferie', 'assenza', 'festivita', 'pausa', 'chiusura')),
  start_day date NOT NULL,
  end_day date NOT NULL,
  start_time time,
  end_time time,
  note varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_day >= start_day)
);

-- ---------- pazienti e appuntamenti ----------
CREATE TABLE patients (
  id serial PRIMARY KEY,
  first_name varchar(80) NOT NULL,
  last_name varchar(80) NOT NULL,
  birth_date date,
  birth_place varchar(120),
  sex varchar(1) CHECK (sex IN ('F', 'M', 'X')),
  tax_code varchar(16),
  phone varchar(40),
  email varchar(160),
  address varchar(255),
  city varchar(120),
  profession varchar(120),
  notes text,
  privacy_accepted_at timestamptz,
  source varchar(20) NOT NULL DEFAULT 'studio',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patients_name_idx ON patients (lower(last_name), lower(first_name));
CREATE INDEX patients_email_idx ON patients (lower(email));
CREATE INDEX patients_phone_idx ON patients (phone);

CREATE TABLE appointments (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  service_id integer REFERENCES services(id) ON DELETE SET NULL,
  service_name varchar(160) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source varchar(20) NOT NULL DEFAULT 'studio' CHECK (source IN ('online', 'studio')),
  patient_notes text,
  internal_notes text,
  price_cents integer,
  amount_cents integer,
  manage_token varchar(64) UNIQUE,
  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX appointments_starts_idx ON appointments (starts_at);
CREATE INDEX appointments_patient_idx ON appointments (patient_id);
CREATE INDEX appointments_status_idx ON appointments (status);

CREATE TABLE email_outbox (
  id serial PRIMARY KEY,
  to_email varchar(160) NOT NULL,
  subject varchar(255) NOT NULL,
  html text NOT NULL,
  text_body text,
  kind varchar(40) NOT NULL,
  appointment_id integer REFERENCES appointments(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'simulated')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_pending_idx ON email_outbox (status, send_after);

-- ---------- cartella clinica ----------
CREATE TABLE anamnesis (
  patient_id integer PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  personal text,
  family text,
  pathologies text,
  surgeries text,
  allergies text,
  current_therapies text,
  previous_treatments text,
  lifestyle text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE visits (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id integer REFERENCES appointments(id) ON DELETE SET NULL,
  visit_date timestamptz NOT NULL DEFAULT now(),
  area varchar(80),
  reason text,
  objective_exam text,
  assessment text,
  clinical_notes text,
  indications text,
  treatment_response text,
  vas smallint CHECK (vas BETWEEN 0 AND 10),
  next_check_date date,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visits_patient_idx ON visits (patient_id, visit_date DESC);

CREATE TABLE pain_areas (
  id serial PRIMARY KEY,
  visit_id integer NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  region varchar(40) NOT NULL,
  view varchar(5) NOT NULL CHECK (view IN ('front', 'back')),
  side varchar(12),
  intensity smallint CHECK (intensity BETWEEN 0 AND 10),
  pain_type varchar(80),
  frequency varchar(80),
  duration varchar(80),
  radiation varchar(255),
  worsening varchar(255),
  relieving varchar(255),
  notes text
);
CREATE INDEX pain_areas_visit_idx ON pain_areas (visit_id);

CREATE TABLE treatment_cycles (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  area varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  start_date date,
  end_date date,
  planned_sessions integer,
  status varchar(20) NOT NULL DEFAULT 'attivo' CHECK (status IN ('attivo', 'concluso', 'sospeso')),
  next_check_date date,
  response text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_cycles_patient_idx ON treatment_cycles (patient_id);

CREATE TABLE medications (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id integer REFERENCES visits(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL DEFAULT 'prescritto' CHECK (kind IN ('prescritto', 'somministrato')),
  med_date date,
  drug varchar(160) NOT NULL,
  dose varchar(80),
  route varchar(80),
  frequency varchar(80),
  duration varchar(80),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medications_patient_idx ON medications (patient_id);

CREATE TABLE procedures (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id integer REFERENCES visits(id) ON DELETE CASCADE,
  cycle_id integer REFERENCES treatment_cycles(id) ON DELETE SET NULL,
  proc_date date,
  name varchar(160) NOT NULL,
  site varchar(160),
  materials text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX procedures_patient_idx ON procedures (patient_id);

CREATE TABLE lab_results (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  test_name varchar(120) NOT NULL,
  value numeric,
  value_text varchar(80),
  unit varchar(40),
  ref_min numeric,
  ref_max numeric,
  ref_text varchar(120),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_results_patient_idx ON lab_results (patient_id, test_name, test_date);

-- allegati clinici: contenuto cifrato (AES-256-GCM) dentro il database
CREATE TABLE files (
  id serial PRIMARY KEY,
  original_name varchar(255) NOT NULL,
  mime varchar(120) NOT NULL,
  size integer NOT NULL,
  sha256 varchar(64) NOT NULL,
  encrypted boolean NOT NULL DEFAULT true,
  iv bytea,
  tag bytea,
  data bytea NOT NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id integer REFERENCES visits(id) ON DELETE SET NULL,
  kind varchar(20) NOT NULL DEFAULT 'referto' CHECK (kind IN ('referto', 'immagine', 'esame', 'lettera', 'altro')),
  title varchar(200) NOT NULL,
  doc_date date,
  file_id integer NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_patient_idx ON documents (patient_id);

CREATE TABLE consent_templates (
  id serial PRIMARY KEY,
  name varchar(160) NOT NULL,
  area varchar(80),
  version varchar(20) NOT NULL DEFAULT '1.0',
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE patient_consents (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id integer REFERENCES consent_templates(id) ON DELETE SET NULL,
  template_name varchar(160) NOT NULL,
  version varchar(20) NOT NULL,
  body_snapshot text,
  signed_date date NOT NULL,
  file_id integer REFERENCES files(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'firmato' CHECK (status IN ('firmato', 'revocato')),
  revoked_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_consents_patient_idx ON patient_consents (patient_id);

-- ---------- registro accessi e operazioni ----------
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  username varchar(60),
  action varchar(60) NOT NULL,
  entity varchar(40),
  entity_id integer,
  patient_id integer,
  ip varchar(64),
  detail jsonb
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX audit_log_patient_idx ON audit_log (patient_id);
