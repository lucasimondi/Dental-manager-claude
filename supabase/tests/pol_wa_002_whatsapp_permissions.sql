-- POL-WA-002: who may configure the WhatsApp number and write the message log.
-- Run after pol_wa_002_local_bootstrap.sql (see its header for the full order).
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

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user text, p_studio text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated',
                      'app_metadata', json_build_object('studio_id', p_studio))::text,
    true
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_denied(p_sql text, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'assertion failed: % (statement was allowed)', message;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END
$$;

-- Studio B already has a number, written server-side (service role / owner).
INSERT INTO public.whatsapp_config(studio_id, phone_number_id)
VALUES ('20000000-0000-4000-8000-000000000002', 'pnid-studio-b');
INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione, contenuto)
VALUES ('10000000-0000-4000-8000-000000000001', '390000000001', 'in', 'msg A');

SET LOCAL ROLE authenticated;

-- 1. Studio owner (not super admin) cannot register a number, not even an unclaimed one.
SELECT pg_temp.as_user('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_config(studio_id, phone_number_id) VALUES ('10000000-0000-4000-8000-000000000001', 'pnid-unclaimed')$q$,
  'studio owner registered a phone number');

-- 2. Plain member cannot either.
SELECT pg_temp.as_user('a0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_config(studio_id, phone_number_id) VALUES ('10000000-0000-4000-8000-000000000001', 'pnid-unclaimed')$q$,
  'plain member registered a phone number');

-- 3. Super admin registers the number for the studio in its claim.
SELECT pg_temp.as_user('a0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001');
INSERT INTO public.whatsapp_config(studio_id, phone_number_id)
VALUES ('10000000-0000-4000-8000-000000000001', 'pnid-studio-a');

-- 4. Super admin gets no cross-tenant write through the claim-scoped policy.
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_config(studio_id, phone_number_id) VALUES ('20000000-0000-4000-8000-000000000002', 'pnid-other')$q$,
  'super admin wrote a config for a studio outside its claim');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_config) = 1, 'super admin sees only its claimed studio');

-- 5. Studio owner can turn the assistant off and on...
SELECT pg_temp.as_user('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
UPDATE public.whatsapp_config SET attivo = false WHERE phone_number_id = 'pnid-studio-a';
SELECT pg_temp.assert_true(
  (SELECT attivo = false FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-a'),
  'studio owner can switch the assistant off');
UPDATE public.whatsapp_config SET attivo = true WHERE phone_number_id = 'pnid-studio-a';

-- 6. ...but cannot move the studio to another number.
SELECT pg_temp.expect_denied(
  $q$UPDATE public.whatsapp_config SET phone_number_id = 'pnid-hijack' WHERE phone_number_id = 'pnid-studio-a'$q$,
  'studio owner changed the phone number');
SELECT pg_temp.expect_denied(
  $q$UPDATE public.whatsapp_config SET waba_id = 'waba-x' WHERE phone_number_id = 'pnid-studio-a'$q$,
  'studio owner changed the WABA id');

-- 7. Owner cannot delete the config.
DELETE FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-a';

-- 8. Plain member can read the config but not change anything (filtered: 0 rows).
SELECT pg_temp.as_user('a0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_config) = 1, 'member can read own studio config');
UPDATE public.whatsapp_config SET attivo = false;

-- 9. Nobody writes the message log from the client; members can read it.
SELECT pg_temp.assert_true((SELECT count(*) FROM public.whatsapp_messages) = 1, 'member can read own message log');
SELECT pg_temp.expect_denied(
  $q$INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione) VALUES ('10000000-0000-4000-8000-000000000001', '390000000009', 'out')$q$,
  'member inserted into the message log');
SELECT pg_temp.expect_denied($q$DELETE FROM public.whatsapp_messages$q$, 'member deleted the message log');
SELECT pg_temp.expect_denied($q$TRUNCATE public.whatsapp_messages$q$, 'member truncated the message log');
SELECT pg_temp.expect_denied($q$TRUNCATE public.whatsapp_config$q$, 'member truncated the config');

-- 10. Super admin changes the number (allowed) and deletes it (allowed).
SELECT pg_temp.as_user('a0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001');
UPDATE public.whatsapp_config SET phone_number_id = 'pnid-studio-a2' WHERE phone_number_id = 'pnid-studio-a';
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-a2') = 1,
  'super admin can change the number');

-- 11. anon has no access at all.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT pg_temp.expect_denied($q$SELECT 1 FROM public.whatsapp_config$q$, 'anon read the config');

-- 12. Final state as owner: studio A still active on the super-admin number, studio B untouched.
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT attivo FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-a2'),
  'plain member could not switch the assistant off');
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.whatsapp_config WHERE phone_number_id = 'pnid-studio-b') = 1,
  'studio B untouched');

-- 13. Service-side writes (table owner / service role) still work for the Edge Function.
UPDATE public.whatsapp_config SET phone_number_id = 'pnid-studio-b2' WHERE phone_number_id = 'pnid-studio-b';
INSERT INTO public.whatsapp_messages(studio_id, telefono, direzione) VALUES ('20000000-0000-4000-8000-000000000002', '390000000002', 'out');

ROLLBACK;
