BEGIN;

INSERT INTO public.studio_user_capabilities(studio_id,user_id,capability,granted_by) VALUES
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','home.front_desk','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','clinical.physiotherapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','clinical.personal_trainer','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','clinical.massage_therapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','clinical.personal_trainer','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','clinical.massage_therapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000007','clinical.physiotherapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000008','clinical.general','a0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','clinical.physiotherapist','b0000000-0000-4000-8000-000000000001');

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(condition,false) THEN RAISE EXCEPTION 'assertion failed: %',message; END IF; END $$;

SET ROLE authenticated;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','studio.owner'),'legacy admin keeps owner capability');
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','finance.management.read'),'legacy admin keeps finance capability');
SELECT pg_temp.assert_true(NOT public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','clinical.physiotherapist'),'owner is not automatically clinical');
SELECT pg_temp.assert_true(NOT public.has_studio_capability_v1('20000000-0000-4000-8000-000000000002','studio.owner'),'owner cannot cross tenant');

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','home.front_desk'),'front desk capability resolves');
SELECT pg_temp.assert_true(cardinality(public.get_my_studio_capabilities_v1('20000000-0000-4000-8000-000000000002'))=0,'cross-tenant capability list is empty');
DO $$ BEGIN
  INSERT INTO public.studio_user_capabilities(studio_id,user_id,capability)
  VALUES ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','clinical.physiotherapist');
  RAISE EXCEPTION 'front desk escalated capability';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

RESET ROLE;
INSERT INTO public.physio_piani(studio_id,paziente_id,titolo,stato) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'Piano A','attivo'),
 ('20000000-0000-4000-8000-000000000002',201,'Piano B','attivo');
INSERT INTO public.physio_valutazioni(studio_id,paziente_id,tipo,motivo_visita,created_by) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'iniziale','Valutazione A','a0000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000002',201,'iniziale','Valutazione B','b0000000-0000-4000-8000-000000000002');
SET ROLE authenticated;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000007"}',true);
SELECT pg_temp.assert_true(cardinality(public.get_my_studio_capabilities_v1('10000000-0000-4000-8000-000000000001'))=0,'suspended user gets no capability');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'suspended user sees no physio data');

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000008"}',true);
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','clinical.general'),'general clinician capability resolves');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'general clinician receives no inferred Fisio access');

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=1,'physiotherapist sees own tenant only');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_valutazioni)=1,'physiotherapist reads evaluations');
UPDATE public.physio_piani SET stato='completato' WHERE paziente_id=101;
SELECT pg_temp.assert_true((SELECT stato='completato' FROM public.physio_piani WHERE paziente_id=101),'physiotherapist finalizes plan');
DO $$ BEGIN
  INSERT INTO public.physio_valutazioni(studio_id,paziente_id,tipo,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',201,'rivalutazione','a0000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'cross-tenant patient relationship accepted';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=1,'PT reads operational plan');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_valutazioni)=0,'PT cannot read evaluation');
INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',101,'Attività PT','a0000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  UPDATE public.physio_piani SET titolo='Escalation PT' WHERE paziente_id=101;
  IF FOUND THEN RAISE EXCEPTION 'PT modified physiotherapy plan'; END IF;
END $$;
INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',101,'Tentativo spoof','a0000000-0000-4000-8000-000000000005');
SELECT pg_temp.assert_true(
  (SELECT created_by='a0000000-0000-4000-8000-000000000004'::uuid FROM public.physio_diario_sedute WHERE trattamenti_svolti='Tentativo spoof'),
  'server forces intervention author to caller'
);

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000005"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_valutazioni)=0,'massage therapist cannot read evaluation');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_diario_sedute)=0,'massage therapist cannot read PT activity');
INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',101,'Intervento massaggio','a0000000-0000-4000-8000-000000000005');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_diario_sedute)=1,'massage therapist reads own activity only');
DO $$ BEGIN
  UPDATE public.physio_piani SET titolo='Escalation massage' WHERE paziente_id=101;
  IF FOUND THEN RAISE EXCEPTION 'massage therapist modified physiotherapy plan'; END IF;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000006"}',true);
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','clinical.personal_trainer') AND public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','clinical.massage_therapist'),'multi-role capabilities coexist');

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'non-clinical owner cannot read physio plan');
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'front desk cannot read clinical content');

RESET ROLE;
ROLLBACK;
