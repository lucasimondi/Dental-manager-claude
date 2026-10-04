-- POL-WA-003a local bootstrap (disposable database only).
-- Order: pol_rbac_001_local_bootstrap.sql -> 20260930120000_pol_wa_001_whatsapp_baseline.sql
-- -> this file -> 20261002120000_pol_wa_003a_assistente_whatsapp.sql -> pol_wa_003a_assistente.sql
--
-- Minimal stand-ins for production objects the migration only reads: plans and
-- the two POL-FIN private views (as plain tables with the columns used).
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO service_role;

ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS attivo boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.plans(
  id bigint PRIMARY KEY, studio_id uuid NOT NULL REFERENCES public.studios(id), paziente_id bigint,
  titolo text, stato text, scadenza_pagamento date
);
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.incassi_plan_saldo_v1(
  piano_id bigint, studio_id uuid, paziente_id bigint, data date,
  totale_piano numeric, totale_eseguito numeric, totale_pagato_piano numeric
);
CREATE TABLE IF NOT EXISTS private.financial_live_data_quality_v1(
  studio_id uuid, blocking_metric text, source_table text, source_id text
);

INSERT INTO public.plans(id, studio_id, paziente_id, titolo, stato, scadenza_pagamento) VALUES
  (1, '10000000-0000-4000-8000-000000000001', 101, 'Accettato aperto', 'accettato', '2026-11-30'),
  (2, '10000000-0000-4000-8000-000000000001', 101, 'Accettato saldato', 'accettato', NULL),
  (3, '10000000-0000-4000-8000-000000000001', 101, 'Preventivo', 'proposto', NULL),
  (4, '10000000-0000-4000-8000-000000000001', 102, 'Altro paziente', 'accettato', NULL),
  (5, '20000000-0000-4000-8000-000000000002', 201, 'Altro studio', 'accettato', NULL);
INSERT INTO private.incassi_plan_saldo_v1(piano_id, studio_id, paziente_id, totale_piano, totale_pagato_piano) VALUES
  (1, '10000000-0000-4000-8000-000000000001', 101, 500, 200),
  (2, '10000000-0000-4000-8000-000000000001', 101, 300, 300),
  (3, '10000000-0000-4000-8000-000000000001', 101, 900, 0),
  (4, '10000000-0000-4000-8000-000000000001', 102, 100, 0),
  (5, '20000000-0000-4000-8000-000000000002', 201, 100, 0);
INSERT INTO public.patients(id, studio_id) VALUES (102, '10000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
