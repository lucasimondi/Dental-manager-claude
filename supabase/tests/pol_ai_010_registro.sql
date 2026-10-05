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

-- 6. "Ripristina". Helper: log an executed action as the Edge Function does.
CREATE FUNCTION pg_temp.log(p uuid, az text, tab text, rid bigint, prima jsonb, dopo jsonb, riep text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.poliedron_attivita(id, studio_id, user_id, azione, riepilogo, tabella, record_id, prima, dopo)
  VALUES (p, '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', az, riep, tab, rid, prima, dopo) $$;
SET ROLE authenticated;
DELETE FROM public.appointments WHERE paziente_id = 1;
UPDATE public.richiami SET stato = 'fatto';
-- 6a. Undo of a created appointment removes it; a second undo is refused.
DO $$ DECLARE v bigint; dopo jsonb; BEGIN
  dopo := jsonb_build_object('paziente_id', 1, 'data', current_date + 20, 'ora', '11:00', 'durata', 30, 'tipo', 'Controllo', 'stato', 'confermato', 'note', NULL, 'operatore_id', NULL);
  v := public.poliedron_execute_agenda_v1('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, dopo);
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000001', 'crea_appuntamento', 'appointments', v, NULL, dopo || jsonb_build_object('id', v), 'Fatto. Appuntamento creato' || E'\n' || 'Paziente: Mario Rossi');
  PERFORM pg_temp.check(public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') = 'appointments', 'undo returns the table');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = v), 'created appointment removed');
  PERFORM pg_temp.check((SELECT riepilogo = 'Ripristinato: Appuntamento creato' FROM public.poliedron_attivita WHERE ripristino_di = '50000000-0000-0000-0000-000000000001'), 'undo logged');
END $$;
SELECT pg_temp.expect_error($q$SELECT public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')$q$, '%già ripristinata%');

-- 6b. Undo of a cancellation restores the appointment and closes its "da rifissare" recall.
DO $$ DECLARE v bigint; dopo jsonb; prima jsonb; BEGIN
  dopo := jsonb_build_object('paziente_id', 1, 'data', current_date + 21, 'ora', '12:00', 'durata', 30, 'tipo', 'Igiene', 'stato', 'confermato', 'note', NULL, 'operatore_id', NULL);
  v := public.poliedron_execute_agenda_v1('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NULL, dopo);
  prima := dopo || jsonb_build_object('id', v);
  dopo := prima || '{"stato":"annullato"}';
  PERFORM public.poliedron_execute_agenda_v1('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', prima, dopo);
  PERFORM pg_temp.check((SELECT count(*) = 1 FROM public.richiami WHERE chiave_bot = 'annullato:' || v AND stato = 'da_fare'), 'recall after cancel');
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000003', 'elimina_appuntamento', 'appointments', v, prima, dopo, 'Fatto. Appuntamento annullato');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check((SELECT stato = 'confermato' FROM public.appointments WHERE id = v), 'appointment restored');
  PERFORM pg_temp.check((SELECT stato = 'fatto' FROM public.richiami WHERE chiave_bot = 'annullato:' || v), 'recall closed by the restore');
END $$;

-- 6c. Patient fields: restored; refused if the record changed afterwards.
DO $$ BEGIN
  UPDATE public.patients SET telefono = '111', provincia = 'TO' WHERE id = 1;
  PERFORM public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'modifica_paziente', '{"paziente_id":1,"telefono":" 222 ","provincia":"mi"}', '{"telefono":"111","provincia":"TO"}');
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000004', 'modifica_paziente', 'patients', 1, '{"telefono":"111","provincia":"TO"}', '{"paziente_id":1,"telefono":" 222 ","provincia":"mi"}', 'Fatto. Scheda aggiornata');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check((SELECT telefono = '111' AND provincia = 'TO' FROM public.patients WHERE id = 1), 'patient restored');
  PERFORM public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'modifica_paziente', '{"paziente_id":1,"telefono":"333"}', NULL);
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000005', 'modifica_paziente', 'patients', 1, '{"telefono":"111"}', '{"paziente_id":1,"telefono":"333"}', 'Fatto. Scheda aggiornata');
  UPDATE public.patients SET telefono = '444' WHERE id = 1;
END $$;
SELECT pg_temp.expect_error($q$SELECT public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001')$q$, '%cambiata dopo Poliedron%');
SELECT pg_temp.check((SELECT telefono = '444' FROM public.patients WHERE id = 1), 'refused undo wrote nothing');

-- 6d. Note, recall, activity and agenda block created by Poliedron are removed.
DO $$ DECLARE r bigint; t bigint; i bigint; BEGIN
  PERFORM public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'aggiungi_nota_paziente', '{"paziente_id":1,"testo":"da togliere"}');
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000006', 'aggiungi_nota_paziente', 'patients', 1, NULL, '{"paziente_id":1,"testo":"da togliere"}', 'Fatto. Nota');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check((SELECT NOT (annotazioni::text LIKE '%da togliere%') FROM public.patients WHERE id = 1), 'note removed');
  r := public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'crea_richiamo', jsonb_build_object('paziente_id', 1, 'data_scadenza', current_date + 30));
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000007', 'crea_richiamo', 'richiami', r, NULL, '{}', 'Fatto. Richiamo');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.richiami WHERE id = r), 'recall removed');
  t := public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'crea_promemoria', '{"testo":"tmp"}');
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000008', 'crea_promemoria', 'todos', t, NULL, '{}', 'Fatto. Attività');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.todos WHERE id = t), 'todo removed');
  i := public.poliedron_execute_pazienti_v1('50000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'crea_impegno_personale', jsonb_build_object('titolo', 'Ferie', 'data_inizio', current_date + 40));
  PERFORM pg_temp.log('50000000-0000-0000-0000-000000000009', 'crea_impegno_personale', 'impegni_personali', i, NULL, '{}', 'Fatto. Agenda bloccata');
  PERFORM public.poliedron_ripristina_v1('50000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.impegni_personali WHERE id = i), 'block removed');
END $$;
-- An undo row and a new patient are not undoable from here.
SELECT pg_temp.expect_error($q$SELECT public.poliedron_ripristina_v1((SELECT id FROM public.poliedron_attivita WHERE ripristino_di IS NOT NULL LIMIT 1), '00000000-0000-0000-0000-000000000001')$q$, '%non si può ripristinare%');
RESET ROLE;

-- Another studio's member cannot read it.
SELECT set_config('test.user', '10000000-0000-0000-0000-000000000002', false);
SELECT set_config('test.studio', '00000000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;
SELECT pg_temp.check((SELECT count(*) = 0 FROM public.poliedron_attivita), 'other studio sees nothing');
RESET ROLE;
SELECT 'POL-AI-010 registro: PASS';
