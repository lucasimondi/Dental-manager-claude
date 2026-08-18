-- ============================================================================
-- POLIEDRA PHYSIO — Fase 2: modello dati (7 tabelle nuove)
-- Applicata direttamente in produzione il 18/08/2026 (branching Supabase non
-- disponibile sul piano attuale — vedi piano-schema-dati-physio.md nel
-- progetto Claude "Poliedra Soft" per il contesto completo).
--
-- Ogni tabella: RLS attiva + singola policy studio-scoped dal template di
-- runbook-rls-nuove-tabelle.md. Testato con simulazione JWT su
-- physio_valutazioni e physio_esercizi/physio_prescrizioni (isolamento
-- confermato: 0 righe visibili con studio_id estraneo). get_advisors
-- (security) pulito su queste tabelle.
-- ============================================================================

-- 1. PIANO RIABILITATIVO (creata prima, senza FK a valutazioni)
CREATE TABLE public.physio_piani (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  paziente_id bigint NOT NULL REFERENCES public.patients(id),
  titolo text,
  frequenza_sedute text,
  durata_prevista_settimane integer,
  note text,
  stato text NOT NULL DEFAULT 'programmato'
    CHECK (stato IN ('programmato','attivo','sospeso','completato','interrotto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_piani ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_piani_studio ON public.physio_piani
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 2. VALUTAZIONI (ripetibile: iniziale + rivalutazioni nel tempo)
CREATE TABLE public.physio_valutazioni (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  paziente_id bigint NOT NULL REFERENCES public.patients(id),
  tipo text NOT NULL DEFAULT 'rivalutazione' CHECK (tipo IN ('iniziale','rivalutazione')),
  data date NOT NULL DEFAULT CURRENT_DATE,
  motivo_visita text,
  distretto text,
  dati jsonb NOT NULL DEFAULT '{}',
  dolore_riposo numeric,
  dolore_esercizio numeric,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_valutazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_valutazioni_studio ON public.physio_valutazioni
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- Ora che physio_valutazioni esiste, aggiungo l'FK incrociato su physio_piani
ALTER TABLE public.physio_piani
  ADD COLUMN valutazione_baseline_id bigint REFERENCES public.physio_valutazioni(id);

-- 3. OBIETTIVI TERAPEUTICI
CREATE TABLE public.physio_obiettivi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  paziente_id bigint NOT NULL REFERENCES public.patients(id),
  piano_id bigint REFERENCES public.physio_piani(id),
  termine text NOT NULL DEFAULT 'breve' CHECK (termine IN ('breve','medio','lungo')),
  descrizione text NOT NULL,
  valore_iniziale numeric,
  valore_attuale numeric,
  valore_target numeric,
  unita text,
  data_prevista date,
  stato text NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo','raggiunto','sospeso','annullato')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_obiettivi ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_obiettivi_studio ON public.physio_obiettivi
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 4. DIARIO SEDUTE
CREATE TABLE public.physio_diario_sedute (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  paziente_id bigint NOT NULL REFERENCES public.patients(id),
  piano_id bigint REFERENCES public.physio_piani(id),
  appointment_id bigint REFERENCES public.appointments(id),
  numero_seduta integer,
  data date NOT NULL DEFAULT CURRENT_DATE,
  durata_minuti integer,
  trattamenti_svolti text,
  note text,
  dolore_prima numeric,
  dolore_dopo numeric,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_diario_sedute ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_diario_sedute_studio ON public.physio_diario_sedute
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 5. LIBRERIA ESERCIZI (per studio)
CREATE TABLE public.physio_esercizi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  nome text NOT NULL,
  categoria text,
  distretto text,
  descrizione text,
  istruzioni text,
  video_url text,
  immagine_url text,
  livello_difficolta text CHECK (livello_difficolta IN ('facile','medio','difficile')),
  avvertenze text,
  esercizio_progressione_id bigint REFERENCES public.physio_esercizi(id),
  esercizio_regressione_id bigint REFERENCES public.physio_esercizi(id),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_esercizi ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_esercizi_studio ON public.physio_esercizi
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 6. PRESCRIZIONI ESERCIZI (assegnazione esercizio -> paziente/piano)
CREATE TABLE public.physio_prescrizioni (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  paziente_id bigint NOT NULL REFERENCES public.patients(id),
  piano_id bigint REFERENCES public.physio_piani(id),
  esercizio_id bigint NOT NULL REFERENCES public.physio_esercizi(id),
  serie integer,
  ripetizioni integer,
  durata_secondi integer,
  frequenza_settimanale integer,
  istruzioni_personalizzate text,
  data_inizio date NOT NULL DEFAULT CURRENT_DATE,
  data_fine date,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_prescrizioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_prescrizioni_studio ON public.physio_prescrizioni
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 7. LOG ESECUZIONE (per compliance — scritto manualmente dal fisioterapista
--    per ora; in futuro anche da un'eventuale app paziente)
CREATE TABLE public.physio_esecuzioni (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  prescrizione_id bigint NOT NULL REFERENCES public.physio_prescrizioni(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  eseguito boolean NOT NULL,
  dolore numeric,
  difficolta numeric,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physio_esecuzioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_esecuzioni_studio ON public.physio_esecuzioni
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);
