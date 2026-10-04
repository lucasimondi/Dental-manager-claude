-- POL-WA-003b: permissions of the reminder objects. Synthetic data, rolled back.
-- Order: the POL-WA-003a chain (see pol_wa_003a_local_bootstrap.sql), then
-- 20261004120000_pol_wa_003b_promemoria.sql (twice, to prove it re-runs), then this file.
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
EXCEPTION WHEN insufficient_privilege OR check_violation OR unique_violation THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user text, p_studio text)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated',
                      'app_metadata', json_build_object('studio_id', p_studio))::text, true);
$$;

-- Supabase-like grants on the patient record (RLS decides the rest).
GRANT SELECT, UPDATE ON public.patients TO authenticated;

INSERT INTO public.whatsapp_config(studio_id, phone_number_id) VALUES
  ('10000000-0000-4000-8000-000000000001', 'pnid-a'),
  ('20000000-0000-4000-8000-000000000002', 'pnid-b');
INSERT INTO public.whatsapp_promemoria(studio_id, appuntamento_id, paziente_id, telefono, stato) VALUES
  ('10000000-0000-4000-8000-000000000001', 1001, 101, '393331112222', 'inviato'),
  ('20000000-0000-4000-8000-000000000002', 2001, 201, '393339990000', 'inviato');

-- 1. Defaults: consent off, reminders off until the studio turns them on.
SELECT pg_temp.assert_true((SELECT bool_and(NOT consenso_whatsapp) FROM public.patients), 'consent defaults to false');
SELECT pg_temp.assert_true(
  (SELECT bool_and(NOT promemoria_attivi AND promemoria_ora = 18 AND promemoria_template = 'promemoria_appuntamento') FROM public.whatsapp_config),
  'reminders default to off at 18:00 with the documented template');

-- 2. One reminder per appointment; values are constrained.
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_promemoria(studio_id, appuntamento_id, telefono) VALUES ('10000000-0000-4000-8000-000000000001', 1001, '1')$q$,
  'a second reminder for the same appointment');
SELECT pg_temp.expect_denied(
  $q$UPDATE public.whatsapp_promemoria SET risposta = 'forse' WHERE appuntamento_id = 1001$q$, 'invalid reply accepted');
SELECT pg_temp.expect_denied(
  $q$UPDATE public.whatsapp_config SET promemoria_ora = 24$q$, 'invalid reminder hour accepted');
SELECT pg_temp.expect_denied(
  $q$UPDATE public.whatsapp_config SET promemoria_template = 'Promemoria; DROP'$q$, 'invalid template name accepted');

-- 3. Staff of studio A: reads only its reminders, cannot write them.
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_promemoria) = 1, 'staff sees only own studio reminders');
SELECT pg_temp.expect_denied($q$UPDATE public.whatsapp_promemoria SET risposta = 'confermato'$q$, 'staff edited a reminder');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_promemoria(studio_id, appuntamento_id, telefono) VALUES ('10000000-0000-4000-8000-000000000001', 1001, '1')$q$,
  'staff created a reminder');
SELECT pg_temp.expect_denied($q$DELETE FROM public.whatsapp_promemoria$q$, 'staff deleted a reminder');
SELECT pg_temp.expect_denied($q$SELECT public.whatsapp_cron_segreto_valido('x')$q$, 'an app user called the scheduler secret check');
SELECT pg_temp.expect_denied(
  $q$SELECT public.whatsapp_programma_promemoria('https://x.supabase.co/functions/v1/whatsapp-webhook/promemoria')$q$,
  'an app user scheduled the reminder job');

-- 4. Studio owner: may turn reminders on and pick the hour, still cannot move the number.
SELECT pg_temp.as_user('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
UPDATE public.whatsapp_config SET promemoria_attivi = true, promemoria_ora = 19;
SELECT pg_temp.expect_denied($q$UPDATE public.whatsapp_config SET phone_number_id = 'pnid-x'$q$, 'owner moved the WhatsApp number');
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT promemoria_attivi AND promemoria_ora = 19 FROM public.whatsapp_config WHERE phone_number_id = 'pnid-a'),
  'owner change was saved');
SELECT pg_temp.assert_true(
  (SELECT NOT promemoria_attivi FROM public.whatsapp_config WHERE phone_number_id = 'pnid-b'),
  'the other studio is untouched');

-- 5. Anonymous: nothing.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT pg_temp.expect_denied($q$SELECT 1 FROM public.whatsapp_promemoria$q$, 'anon read reminders');
SELECT pg_temp.expect_denied($q$SELECT public.whatsapp_cron_segreto_valido('x')$q$, 'anon called the scheduler secret check');
RESET ROLE;

-- 6. Scheduler secret: false without Vault, exact match with it, never for empty input.
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(NOT public.whatsapp_cron_segreto_valido('qualsiasi'), 'no Vault means no valid secret');
RESET ROLE;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(name text, decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES ('whatsapp_cron_secret', 'segreto-di-prova');
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(public.whatsapp_cron_segreto_valido('segreto-di-prova'), 'the stored secret is accepted');
SELECT pg_temp.assert_true(NOT public.whatsapp_cron_segreto_valido('segreto-di-prov'), 'a different secret is refused');
SELECT pg_temp.assert_true(NOT public.whatsapp_cron_segreto_valido(''), 'an empty secret is refused');
SELECT pg_temp.assert_true(NOT public.whatsapp_cron_segreto_valido(NULL), 'a null secret is refused');
SELECT pg_temp.expect_denied(
  $q$SELECT public.whatsapp_programma_promemoria('https://x.supabase.co/functions/v1/whatsapp-webhook/promemoria')$q$,
  'the service role scheduled the reminder job');
RESET ROLE;

-- 7. The job URL is validated before anything is scheduled.
DO $$
BEGIN
  PERFORM public.whatsapp_programma_promemoria('https://evil.example/steal');
  RAISE EXCEPTION 'assertion failed: unexpected URL accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'POL-WA-003b%' THEN RAISE; END IF;
END $$;

ROLLBACK;
