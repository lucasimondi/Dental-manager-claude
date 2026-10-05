-- POL-AI-010 step 2c: run after the step 2 chain (fixture, step 1 migration,
-- pazienti fixture and migration, their tests) and 20261005170000_pol_ai_010_registro_annullati.sql.
CREATE FUNCTION pg_temp.expect_error(statement text, pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE pattern THEN RAISE EXCEPTION 'Unexpected error: %', SQLERRM; END IF;
   RETURN;
 END;
 RAISE EXCEPTION 'Expected failure: %', statement;
END $$;
CREATE FUNCTION pg_temp.check(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok, false) THEN RAISE EXCEPTION 'assertion failed: %', message; END IF; END $$;

UPDATE public.studio_users SET stato = 'attivo';
DELETE FROM public.appointments WHERE paziente_id = 1;
DELETE FROM public.richiami;
SELECT set_config('test.user', '10000000-0000-0000-0000-000000000001', false);
SELECT set_config('test.studio', '00000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

-- 1. Cancelling an upcoming appointment with no other booking creates one recall.
INSERT INTO public.appointments(studio_id, user_id, paziente_id, data, ora, durata, tipo, stato)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, current_date + 7, '09:00', 30, 'Igiene', 'confermato');
UPDATE public.appointments SET stato = 'annullato' WHERE paziente_id = 1;
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.richiami WHERE paziente_id = 1 AND origine = 'annullamento'
  AND stato = 'da_fare' AND motivo LIKE 'Da rifissare: Igiene del %' AND user_id = '10000000-0000-0000-0000-000000000001'), 'recall created');
-- Cancelling again (no state change) does not duplicate it.
UPDATE public.appointments SET stato = 'annullato' WHERE paziente_id = 1;
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.richiami WHERE origine = 'annullamento'), 'no duplicate recall');

-- 2. Booking the patient again closes the recall.
INSERT INTO public.appointments(studio_id, user_id, paziente_id, data, ora, durata, tipo, stato)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, current_date + 9, '10:00', 30, 'Igiene', 'confermato');
SELECT pg_temp.check((SELECT stato = 'fatto' FROM public.richiami WHERE origine = 'annullamento'), 'recall closed when rebooked');

-- 3. Cancelling while another upcoming appointment exists: no recall.
UPDATE public.appointments SET stato = 'annullato' WHERE paziente_id = 1 AND data = current_date + 9;
INSERT INTO public.appointments(studio_id, user_id, paziente_id, data, ora, durata, tipo, stato)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, current_date + 12, '10:00', 30, 'Controllo', 'confermato');
UPDATE public.appointments SET stato = 'annullato' WHERE paziente_id = 1 AND data = current_date + 7;
SELECT pg_temp.check((SELECT count(*) FROM public.richiami WHERE origine = 'annullamento' AND stato = 'da_fare') = 0, 'no recall when still booked');

-- 4. Past appointments never create recalls.
INSERT INTO public.appointments(studio_id, user_id, paziente_id, data, ora, durata, tipo, stato)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, current_date - 3, '10:00', 30, 'Visita', 'annullato');
SELECT pg_temp.check((SELECT count(*) FROM public.richiami WHERE origine = 'annullamento' AND stato = 'da_fare') = 0, 'past ignored');

-- 5. Activity log: only for the caller's own claim, readable by the studio, immutable.
SELECT public.poliedron_execute_pazienti_v1('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'crea_promemoria', '{"testo":"log test"}');
INSERT INTO public.poliedron_attivita(id, studio_id, user_id, azione, riepilogo, tabella, record_id)
VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'crea_promemoria', 'Attività creata: log test', 'todos', 1);
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.poliedron_attivita), 'own activity visible');
SELECT pg_temp.expect_error($q$INSERT INTO public.poliedron_attivita(id, studio_id, user_id, azione, riepilogo) VALUES ('40000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'x', 'senza claim')$q$, '%foreign key%');
SELECT pg_temp.expect_error($q$INSERT INTO public.poliedron_attivita(id, studio_id, user_id, azione, riepilogo) VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'x', 'altro utente')$q$, '%row-level security%');
SELECT pg_temp.expect_error($q$UPDATE public.poliedron_attivita SET riepilogo = 'cambiato'$q$, '%permission denied%');
SELECT pg_temp.expect_error($q$DELETE FROM public.poliedron_attivita$q$, '%permission denied%');
RESET ROLE;

-- Another studio's member cannot read it.
SELECT set_config('test.user', '10000000-0000-0000-0000-000000000002', false);
SELECT set_config('test.studio', '00000000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;
SELECT pg_temp.check((SELECT count(*) = 0 FROM public.poliedron_attivita), 'other studio sees nothing');
RESET ROLE;
SELECT 'POL-AI-010 registro: PASS';
