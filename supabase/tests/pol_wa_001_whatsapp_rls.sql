-- POL-WA-001: tenant isolation for whatsapp_config / whatsapp_messages.
-- Run on a disposable database after a bootstrap that provides studios,
-- patients, auth.jwt() and the anon/authenticated roles (for example
-- supabase/tests/pol_rbac_001_local_bootstrap.sql), then
-- supabase/migrations/20260930120000_pol_wa_001_whatsapp_baseline.sql.
-- Synthetic data only; everything is rolled back.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN
    RAISE EXCEPTION 'assertion failed: %', message;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config, public.whatsapp_messages TO authenticated, anon;

-- Seed one row per studio as the table owner (the Edge Function writes with
-- the service role, which bypasses RLS the same way).
INSERT INTO public.whatsapp_config(studio_id, phone_number_id) VALUES
  ('10000000-0000-4000-8000-000000000001', 'pnid-studio-a'),
  ('20000000-0000-4000-8000-000000000002', 'pnid-studio-b');
INSERT INTO public.whatsapp_messages(studio_id, paziente_id, telefono, direzione, contenuto) VALUES
  ('10000000-0000-4000-8000-000000000001', 101, '390000000001', 'in', 'msg A'),
  ('20000000-0000-4000-8000-000000000002', 201, '390000000002', 'in', 'msg B');

-- Studio A sees only its own rows.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}',
  true
);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_config) = 1, 'studio A sees exactly one config');
SELECT pg_temp.assert_true((SELECT phone_number_id FROM public.whatsapp_config) = 'pnid-studio-a', 'studio A sees its own config');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_messages) = 1, 'studio A sees exactly one message');
SELECT pg_temp.assert_true((SELECT contenuto FROM public.whatsapp_messages) = 'msg A', 'studio A sees its own message');

-- Studio A cannot change or delete studio B rows (filtered out, 0 rows).
UPDATE public.whatsapp_config SET attivo = false WHERE phone_number_id = 'pnid-studio-b';
DELETE FROM public.whatsapp_messages WHERE contenuto = 'msg B';

-- Studio A cannot write a row for studio B.
DO $$
BEGIN
  INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione)
  VALUES ('20000000-0000-4000-8000-000000000002', '390000000009', 'out');
  RAISE EXCEPTION 'assertion failed: cross-tenant insert into whatsapp_messages was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO public.whatsapp_config(studio_id, phone_number_id)
  VALUES ('20000000-0000-4000-8000-000000000002', 'pnid-hijack');
  RAISE EXCEPTION 'assertion failed: cross-tenant insert into whatsapp_config was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- direzione is constrained to in/out.
DO $$
BEGIN
  INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione)
  VALUES ('10000000-0000-4000-8000-000000000001', '390000000001', 'sideways');
  RAISE EXCEPTION 'assertion failed: invalid direzione accepted';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

-- A request without a studio claim (anon) sees nothing: fail closed.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_config) = 0, 'anon sees no config');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_messages) = 0, 'anon sees no messages');

-- Studio B rows are intact after studio A's attempts.
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT attivo FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-b'),
  'studio B config untouched by studio A'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.whatsapp_messages WHERE contenuto = 'msg B') = 1,
  'studio B message untouched by studio A'
);

-- Deleting a patient keeps the message, unlinked (ON DELETE SET NULL).
DELETE FROM public.patients WHERE id = 101;
SELECT pg_temp.assert_true(
  (SELECT paziente_id IS NULL FROM public.whatsapp_messages WHERE contenuto = 'msg A'),
  'patient delete unlinks the message'
);

ROLLBACK;
