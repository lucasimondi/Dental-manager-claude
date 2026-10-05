-- POL-AI-010 step 2: run after pol_ai_010_fixture.sql, the step 1 migration,
-- pol_ai_010_pazienti_fixture.sql and 20261005120000_pol_ai_010_pazienti.sql.
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

-- The step 1 test ends with a suspended member: start from an active one.
UPDATE public.studio_users SET stato = 'attivo';

-- WhatsApp hand-over activity (POL-WA-003a) is accepted now.
INSERT INTO public.todos(testo, studio_id, origine) VALUES ('handover', '00000000-0000-0000-0000-000000000001', 'whatsapp');

SELECT set_config('test.user', '10000000-0000-0000-0000-000000000001', false);
SELECT set_config('test.studio', '00000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

-- 1. New patient: id assigned by the database (identity ALWAYS), consent date set.
SELECT pg_temp.check(public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'crea_paziente', '{"nome":" Anna ","cognome":"Verdi","telefono":"333 1112222","consenso_whatsapp":true}') >= 100, 'patient created with identity id');
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.patients WHERE nome = 'Anna' AND cognome = 'Verdi'
  AND consenso_whatsapp AND consenso_whatsapp_il IS NOT NULL AND user_id = '10000000-0000-0000-0000-000000000001'), 'patient fields');
-- Replay of the same confirmation is refused.
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'crea_paziente', '{"nome":"X","cognome":"Y"}')$q$, '%duplicate key%');
SELECT pg_temp.check((SELECT count(*) = 0 FROM public.patients WHERE nome = 'X'), 'replayed patient not created');

-- 2. Update with concurrency check; consent off clears its date.
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
  'modifica_paziente', '{"paziente_id":1,"telefono":"3339998888","consenso_whatsapp":true}', '{"telefono":null,"consenso_whatsapp":false}');
SELECT pg_temp.check((SELECT telefono = '3339998888' AND consenso_whatsapp AND consenso_whatsapp_il IS NOT NULL FROM public.patients WHERE id = 1), 'patient updated');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'modifica_paziente', '{"paziente_id":1,"telefono":"1"}', '{"telefono":null}')$q$, '%modificata nel frattempo%');
SELECT pg_temp.check((SELECT telefono = '3339998888' FROM public.patients WHERE id = 1), 'stale update rejected, nothing changed');
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
  'modifica_paziente', '{"paziente_id":1,"consenso_whatsapp":false}');
SELECT pg_temp.check((SELECT NOT consenso_whatsapp AND consenso_whatsapp_il IS NULL FROM public.patients WHERE id = 1), 'consent revoked clears date');

-- 3. Two notes appended, none lost, app shape.
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'aggiungi_nota_paziente', '{"paziente_id":1,"testo":"Prima nota"}');
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'aggiungi_nota_paziente', '{"paziente_id":1,"testo":"Seconda nota"}');
SELECT pg_temp.check((SELECT jsonb_array_length(annotazioni) = 2 AND annotazioni->1->>'testo' = 'Seconda nota' AND annotazioni->0 ? 'data' AND annotazioni->0 ? 'id' FROM public.patients WHERE id = 1), 'notes appended');

-- 4. Recall, reminder, personal commitment.
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'crea_richiamo', '{"paziente_id":1,"categoria":"clinico","motivo":"Igiene","data_scadenza":"2099-03-01"}');
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.richiami WHERE paziente_id = 1 AND origine = 'bot' AND stato = 'da_fare'), 'recall created');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'crea_richiamo', '{"paziente_id":1,"data_scadenza":"2000-01-01"}')$q$, '%passata%');
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'crea_promemoria', '{"testo":"Chiamare il laboratorio","paziente_id":1}');
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.todos WHERE origine = 'poliedron' AND paziente_id = 1), 'reminder created');
SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'crea_impegno_personale', '{"titolo":"Ferie","tipo":"ferie","data_inizio":"2099-08-01","data_fine":"2099-08-15"}');
SELECT pg_temp.check((SELECT count(*) = 1 FROM public.impegni_personali WHERE titolo = 'Ferie' AND tutto_il_giorno AND ora_inizio IS NULL), 'commitment created');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'crea_impegno_personale', '{"titolo":"X","tipo":"vacanza","data_inizio":"2099-08-01"}')$q$, '%impegni_personali_tipo_check%');

-- 5. Tenant isolation: another studio's patient is invisible; unknown action refused.
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'aggiungi_nota_paziente', '{"paziente_id":2,"testo":"x"}')$q$, '%Paziente non disponibile%');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 'crea_promemoria', '{"testo":"x"}')$q$, '%Accesso allo studio non consentito%');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'elimina_paziente', '{"paziente_id":1}')$q$, '%Azione non supportata%');
RESET ROLE;
SELECT pg_temp.check((SELECT annotazioni = '[]'::jsonb FROM public.patients WHERE id = 2), 'other studio untouched');

-- 6. Suspended member: refused.
UPDATE public.studio_users SET stato = 'sospeso' WHERE user_id = '10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_pazienti_v1('30000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'crea_promemoria', '{"testo":"x"}')$q$, '%Accesso allo studio non consentito%');
RESET ROLE;
