-- POL-AI-009: memoria di Poliedron. Database usa e getta:
-- pol_rbac_001_local_bootstrap.sql -> 20261006120000_pol_ai_009_poliedron_memoria.sql -> questo file.
-- a0..01 e a0..02: membri attivi dello studio 1; a0..07: sospeso; b0..01: studio 2.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN RAISE EXCEPTION 'assertion failed: %', message; END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.come(utente text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', utente)::text, true);
$$;

SET LOCAL ROLE authenticated;

-- Il proprietario scrive, aggiorna per chiave e legge le proprie voci.
SELECT pg_temp.come('a0000000-0000-4000-8000-000000000001');
INSERT INTO public.poliedron_memoria(studio_id, user_id, categoria, testo)
VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'preferenza', 'Preferisce risposte brevi.');
INSERT INTO public.poliedron_memoria(studio_id, user_id, categoria, chiave, testo, origine)
VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'prescrizione',
        'farmaco:amoxicillina 1 g', 'Amoxicillina 1 g: 1 compressa ogni 8 ore, per 6 giorni', 'ricetta');
INSERT INTO public.poliedron_memoria(studio_id, user_id, categoria, chiave, testo, origine)
VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'prescrizione',
        'farmaco:amoxicillina 1 g', 'Amoxicillina 1 g: 1 compressa ogni 12 ore, per 5 giorni', 'ricetta')
ON CONFLICT (studio_id, user_id, chiave) DO UPDATE SET testo = EXCLUDED.testo;
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM public.poliedron_memoria), 'owner sees own 2 rows');
SELECT pg_temp.assert_true(
  (SELECT testo LIKE '%ogni 12 ore%' FROM public.poliedron_memoria WHERE chiave = 'farmaco:amoxicillina 1 g'),
  'same key replaces the previous dose');

-- Un altro membro dello stesso studio non vede, non modifica, non cancella.
SELECT pg_temp.come('a0000000-0000-4000-8000-000000000002');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.poliedron_memoria), 'colleague sees nothing');
UPDATE public.poliedron_memoria SET testo = 'x';
DELETE FROM public.poliedron_memoria;
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'scritta per conto di altri');
  RAISE EXCEPTION 'assertion failed: wrote a row for another user';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Utente di un altro studio: non può scrivere nello studio 1.
SELECT pg_temp.come('b0000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'cross-tenant');
  RAISE EXCEPTION 'assertion failed: cross-tenant insert accepted';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Membro sospeso: nessuna scrittura.
SELECT pg_temp.come('a0000000-0000-4000-8000-000000000007');
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'sospeso');
  RAISE EXCEPTION 'assertion failed: suspended member wrote';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Vincoli: testo vuoto o troppo lungo, categoria sconosciuta, cambio di proprietario.
SELECT pg_temp.come('a0000000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 2 AND bool_and(testo <> 'x') FROM public.poliedron_memoria),
  'colleague update/delete had no effect');
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '   ');
  RAISE EXCEPTION 'assertion failed: blank text accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', repeat('a', 501));
  RAISE EXCEPTION 'assertion failed: long text accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, categoria, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'clinica', 'x');
  RAISE EXCEPTION 'assertion failed: unknown category accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.poliedron_memoria SET user_id = 'a0000000-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'assertion failed: owner change accepted';
EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL; END $$;

-- Tetto di 300 voci per utente e studio.
INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
SELECT '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'voce ' || g
FROM generate_series(1, 298) g;
SELECT pg_temp.assert_true((SELECT count(*) = 300 FROM public.poliedron_memoria), '300 rows stored');
DO $$ BEGIN
  INSERT INTO public.poliedron_memoria(studio_id, user_id, testo)
  VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'una di troppo');
  RAISE EXCEPTION 'assertion failed: 301st row accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;

-- Il proprietario cancella.
DELETE FROM public.poliedron_memoria WHERE testo = 'Preferisce risposte brevi.';
SELECT pg_temp.assert_true((SELECT count(*) = 299 FROM public.poliedron_memoria), 'owner can delete');

-- anon non ha accesso.
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.poliedron_memoria;
  RAISE EXCEPTION 'assertion failed: anon can read';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

RESET ROLE;
ROLLBACK;
SELECT 'POL-AI-009 poliedron_memoria: PASS' AS risultato;
