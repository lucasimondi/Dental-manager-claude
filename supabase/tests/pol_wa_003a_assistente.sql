-- POL-WA-003a: permissions of the new assistant objects. Synthetic data, rolled back.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN RAISE EXCEPTION 'assertion failed: %', message; END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_denied(p_sql text, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'assertion failed: % (statement was allowed)', message;
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
END $$;

-- Supabase-like table grants for the client roles (RLS decides the rest).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.richieste_prenotazione TO anon, authenticated;
GRANT SELECT ON public.studios TO anon, authenticated;

INSERT INTO public.whatsapp_conversazioni(studio_id, telefono, paziente_id) VALUES
  ('10000000-0000-4000-8000-000000000001', '393331112222', 101),
  ('20000000-0000-4000-8000-000000000002', '393339990000', 201);

-- 1. Public booking page still works, but cannot forge a WhatsApp request.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite)
VALUES ('10000000-0000-4000-8000-000000000001', 'Anna', 'Verdi', '3330000000', ARRAY['2026-10-10'::date]);
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite, origine) VALUES ('10000000-0000-4000-8000-000000000001', 'X', 'Y', '1', ARRAY['2026-10-10'::date], 'whatsapp')$q$,
  'anon forged a WhatsApp-origin request');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite, paziente_id) VALUES ('10000000-0000-4000-8000-000000000001', 'X', 'Y', '1', ARRAY['2026-10-10'::date], 101)$q$,
  'anon linked a request to an existing patient');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite, tipo_richiesta) VALUES ('10000000-0000-4000-8000-000000000001', 'X', 'Y', '1', ARRAY['2026-10-10'::date], 'disdici')$q$,
  'anon sent a cancellation');
SELECT pg_temp.expect_denied($q$SELECT 1 FROM public.whatsapp_conversazioni$q$, 'anon read conversations');
RESET ROLE;

-- 2. Staff of studio A: sees only its conversations, may resume the assistant, nothing else.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}', true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_conversazioni) = 1, 'staff sees only own studio conversations');
UPDATE public.whatsapp_conversazioni SET ai_pausa_fino = NULL, serve_staff = false;
SELECT pg_temp.expect_denied($q$UPDATE public.whatsapp_conversazioni SET telefono = '390000'$q$, 'staff rewrote the phone number');
SELECT pg_temp.expect_denied($q$UPDATE public.whatsapp_conversazioni SET paziente_id = 102$q$, 'staff relinked the patient');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_conversazioni(studio_id, telefono) VALUES ('10000000-0000-4000-8000-000000000001', '391')$q$,
  'staff created a conversation');
SELECT pg_temp.expect_denied(
  $q$SELECT * FROM public.whatsapp_saldo_paziente_v1('10000000-0000-4000-8000-000000000001', 101)$q$,
  'an app user called the service-only balance function');
-- Staff still sees WhatsApp requests in the Agenda list (existing SELECT policy).
RESET ROLE;
INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite, origine, tipo_richiesta, paziente_id, ora_preferita)
VALUES ('10000000-0000-4000-8000-000000000001', 'Mario', 'Rossi', '393331112222', ARRAY['2026-10-10'::date], 'whatsapp', 'prenota', 101, '10:30');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.richieste_prenotazione WHERE origine = 'whatsapp' AND stato = 'nuova') = 1,
  'staff sees the WhatsApp request');
RESET ROLE;

-- 3. Constraints.
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.richieste_prenotazione(studio_id, nome, cognome, telefono, date_preferite, origine, ora_preferita) VALUES ('10000000-0000-4000-8000-000000000001', 'X', 'Y', '1', ARRAY['2026-10-10'::date], 'whatsapp', '25:99')$q$,
  'invalid time accepted');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione, origine) VALUES ('10000000-0000-4000-8000-000000000001', '1', 'in', 'robot')$q$,
  'invalid message origin accepted');

-- 4. Balance for the assistant: only that patient, only accepted plans with a residual.
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (SELECT array_agg(piano_id ORDER BY piano_id) FROM public.whatsapp_saldo_paziente_v1('10000000-0000-4000-8000-000000000001', 101)) = ARRAY[1::bigint],
  'only the accepted, unpaid plan of patient 101');
SELECT pg_temp.assert_true(
  (SELECT saldo_piano FROM public.whatsapp_saldo_paziente_v1('10000000-0000-4000-8000-000000000001', 101)) = 300,
  'residual is totale_piano - totale_pagato');
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.whatsapp_saldo_paziente_v1('10000000-0000-4000-8000-000000000001', 201)) = 0,
  'a patient of another studio is never returned');
RESET ROLE;
INSERT INTO private.financial_live_data_quality_v1(studio_id, blocking_metric) VALUES ('10000000-0000-4000-8000-000000000001', 'PLAN_BALANCE');
SET LOCAL ROLE service_role;
DO $$
BEGIN
  PERFORM * FROM public.whatsapp_saldo_paziente_v1('10000000-0000-4000-8000-000000000001', 101);
  RAISE EXCEPTION 'assertion failed: balance returned despite incomplete plan data';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'POL-FIN-006%' THEN RAISE; END IF;
END $$;
RESET ROLE;

ROLLBACK;
