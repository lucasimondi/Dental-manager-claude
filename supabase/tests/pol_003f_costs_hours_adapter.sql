-- POL-003F synthetic-only regression. Every mutation is rolled back.
BEGIN;

INSERT INTO public.studio_users(user_id,studio_id,stato) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','51000000-0000-4000-8000-000000000001','attivo'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','52000000-0000-4000-8000-000000000001','attivo');

INSERT INTO public.spese(
  id,studio_id,data,importo,tipo_costo,ricorrente,frequenza,data_fine
) VALUES
  (5101,'51000000-0000-4000-8000-000000000001','2025-01-15',100,'fisso',false,NULL,NULL),
  (5102,'51000000-0000-4000-8000-000000000001','2025-01-10',300,'fisso',true,'Mensile','2025-03-20'),
  (5103,'51000000-0000-4000-8000-000000000001','2025-01-01',120,'fisso',true,'Bimestrale','2025-02-28'),
  (5104,'51000000-0000-4000-8000-000000000001','2025-02-10',200,'variabile',true,'Trimestrale','2025-04-30'),
  (5105,'51000000-0000-4000-8000-000000000001','2025-01-31',50,'variabile',false,NULL,NULL),
  (5106,'51000000-0000-4000-8000-000000000001','2025-01-01',75,'fisso',true,'Sconosciuta',NULL),
  (5201,'52000000-0000-4000-8000-000000000001','2025-01-05',999,'fisso',false,NULL,NULL);

INSERT INTO public.personale(id,studio_id,costo_mensile,attivo,data_inizio) VALUES
  (5111,'51000000-0000-4000-8000-000000000001',1000,true,'2025-02-15'),
  (5112,'51000000-0000-4000-8000-000000000001',500,true,'2025-03-01'),
  (5113,'51000000-0000-4000-8000-000000000001',900,false,'2025-01-01'),
  (5114,'51000000-0000-4000-8000-000000000001',250,true,NULL);

INSERT INTO public.macchinari(
  id,studio_id,costo_acquisto,data_acquisto,anni_ammortamento,attivo
) VALUES
  (5121,'51000000-0000-4000-8000-000000000001',12000,'2024-01-01',5,true),
  (5122,'51000000-0000-4000-8000-000000000001',6000,'2024-06-01',3,true);

INSERT INTO public.studio_info(studio_id,config_orario) VALUES
  ('51000000-0000-4000-8000-000000000001',
    '{"giorni_settimana":5,"ore_al_giorno":8,"num_postazioni":2}'),
  ('52000000-0000-4000-8000-000000000001',
    '{"giorni_settimana":4,"ore_al_giorno":6,"num_postazioni":1}'),
  ('53000000-0000-4000-8000-000000000001',
    '{"giorni_settimana":0,"ore_al_giorno":8,"num_postazioni":1}');

INSERT INTO public.appointments(id,studio_id,data,stato,durata) VALUES
  (5131,'51000000-0000-4000-8000-000000000001','2025-02-10','confermato',60),
  (5132,'51000000-0000-4000-8000-000000000001','2025-03-10','confermato',90),
  (5133,'51000000-0000-4000-8000-000000000001','2025-03-11','completato',45);

-- Product value exists only to prove downstream margin/EBITDA/break-even.
INSERT INTO public.financial_contracts_v1(
  studio_id,patient_id,proposal_date,discount_kind,discount_value,source_table,source_id
) VALUES
  ('51000000-0000-4000-8000-000000000001',51001,'2025-03-01','NONE',0,'synthetic-pol003f','contract');
INSERT INTO public.financial_contract_lines_v1(
  studio_id,contract_id,patient_id,gross_amount,source_table,source_id,source_line_id
)
SELECT studio_id,id,patient_id,5000,'synthetic-pol003f','contract','1'
FROM public.financial_contracts_v1
WHERE studio_id='51000000-0000-4000-8000-000000000001'
  AND source_table='synthetic-pol003f' AND source_id='contract';
INSERT INTO public.financial_line_events_v1(
  studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,
  source_table,source_id,source_line_id
)
SELECT studio_id,id,'PRODOTTO','2025-03-15',1,1,'ORIGINAL',
  'synthetic-pol003f','produced','1'
FROM public.financial_contract_lines_v1
WHERE studio_id='51000000-0000-4000-8000-000000000001'
  AND source_table='synthetic-pol003f' AND source_id='contract';

DO $test$
DECLARE
  r record;
  r2 record;
  s record;
  n bigint;
  amount numeric;
BEGIN
  SELECT * INTO r
  FROM private.run_pol_003f_costs_hours_adapter_v1(
    '51000000-0000-4000-8000-000000000001','2025-01-01','2025-03-31'
  );

  IF (r.expense_events_inserted,r.personnel_events_inserted,
      r.available_hour_events_inserted,r.expenses_skipped,r.personnel_skipped,
      r.machinery_blocked,r.confirmed_appointments_blocked,r.hour_config_skipped)
     IS DISTINCT FROM
     (9::bigint,3::bigint,3::bigint,1::bigint,1::bigint,2::bigint,2::bigint,0::bigint) THEN
    RAISE EXCEPTION 'FAIL adapter counters: %',row_to_json(r);
  END IF;

  SELECT * INTO r2
  FROM private.run_pol_003f_costs_hours_adapter_v1(
    '51000000-0000-4000-8000-000000000001','2025-01-01','2025-03-31'
  );
  IF (r2.expense_events_inserted,r2.personnel_events_inserted,
      r2.available_hour_events_inserted)
     IS DISTINCT FROM (0::bigint,0::bigint,0::bigint) THEN
    RAISE EXCEPTION 'FAIL idempotency: %',row_to_json(r2);
  END IF;

  SELECT count(*) INTO n
  FROM public.financial_cost_events_v1
  WHERE studio_id='51000000-0000-4000-8000-000000000001'
    AND source_table='macchinari';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL machinery depreciation imported'; END IF;

  SELECT count(*) INTO n
  FROM public.financial_hours_v1
  WHERE studio_id='51000000-0000-4000-8000-000000000001'
    AND hour_kind='WORKED';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL confirmed appointments became worked hours'; END IF;

  SELECT COALESCE(sum(c.amount),0) INTO amount
  FROM public.financial_cost_events_v1 c
  WHERE c.studio_id='51000000-0000-4000-8000-000000000001'
    AND c.source_table='spese' AND c.classification='FISSO_OPERATIVO';
  IF amount IS DISTINCT FROM 1120::numeric THEN
    RAISE EXCEPTION 'FAIL fixed expense recurrence/boundaries: %',amount;
  END IF;

  SELECT COALESCE(sum(c.amount),0) INTO amount
  FROM public.financial_cost_events_v1 c
  WHERE c.studio_id='51000000-0000-4000-8000-000000000001'
    AND c.source_table='spese' AND c.classification='VARIABILE_ATTRIBUIBILE';
  IF round(amount,6) IS DISTINCT FROM 183.333334::numeric THEN
    RAISE EXCEPTION 'FAIL variable expenses: %',amount;
  END IF;

  SELECT COALESCE(sum(c.amount),0) INTO amount
  FROM public.financial_cost_events_v1 c
  WHERE c.studio_id='51000000-0000-4000-8000-000000000001'
    AND c.source_table='personale';
  IF amount IS DISTINCT FROM 2500::numeric THEN
    RAISE EXCEPTION 'FAIL personnel start date: %',amount;
  END IF;

  SELECT COALESCE(sum(h.hours),0) INTO amount
  FROM public.financial_hours_v1 h
  WHERE h.studio_id='51000000-0000-4000-8000-000000000001'
    AND h.hour_kind='AVAILABLE';
  IF amount IS DISTINCT FROM 1039.2::numeric THEN
    RAISE EXCEPTION 'FAIL available capacity: %',amount;
  END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'app_metadata',jsonb_build_object('studio_id','51000000-0000-4000-8000-000000000001')
  )::text,true);
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-01-01','2025-03-31');
  IF round(s.costi_fissi_operativi,6) IS DISTINCT FROM 3620::numeric THEN
    RAISE EXCEPTION 'FAIL canonical fixed costs: %',s.costi_fissi_operativi;
  END IF;
  IF round(s.costi_variabili,6) IS DISTINCT FROM 183.333334::numeric THEN
    RAISE EXCEPTION 'FAIL canonical variable costs: %',s.costi_variabili;
  END IF;
  IF round(s.margine_contribuzione,6) IS DISTINCT FROM 4816.666666::numeric THEN
    RAISE EXCEPTION 'FAIL contribution margin: %',s.margine_contribuzione;
  END IF;
  IF round(s.ebitda_operativo_gestionale,6) IS DISTINCT FROM 1196.666666::numeric THEN
    RAISE EXCEPTION 'FAIL management EBITDA: %',s.ebitda_operativo_gestionale;
  END IF;
  IF round(s.break_even,6) IS DISTINCT FROM round(
      s.costi_fissi_operativi/(s.margine_contribuzione/s.prodotto),6) THEN
    RAISE EXCEPTION 'FAIL break-even: %',s.break_even;
  END IF;
  IF round(s.ore_produttive_disponibili,6) IS DISTINCT FROM 1039.2::numeric THEN
    RAISE EXCEPTION 'FAIL snapshot available hours: %',s.ore_produttive_disponibili;
  END IF;
  IF round(s.costo_orario_struttura,6) IS DISTINCT FROM round(3620::numeric/1039.2,6) THEN
    RAISE EXCEPTION 'FAIL structure hourly cost: %',s.costo_orario_struttura;
  END IF;
  IF s.ore_effettivamente_lavorate<>0
     OR s.produzione_ora IS NOT NULL OR s.incasso_ora IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL worked-hour metrics must remain unavailable: %',row_to_json(s);
  END IF;

  -- Tenant B is imported independently and cannot change tenant A.
  PERFORM private.run_pol_003f_costs_hours_adapter_v1(
    '52000000-0000-4000-8000-000000000001','2025-01-01','2025-03-31'
  );
  SELECT count(*) INTO n
  FROM public.financial_cost_events_v1
  WHERE studio_id='51000000-0000-4000-8000-000000000001'
    AND source_table IN ('spese','personale');
  IF n<>12 THEN RAISE EXCEPTION 'FAIL tenant A changed after tenant B: %',n; END IF;
  SELECT COALESCE(sum(c.amount),0) INTO amount
  FROM public.financial_cost_events_v1 c
  WHERE c.studio_id='52000000-0000-4000-8000-000000000001';
  IF amount IS DISTINCT FROM 999::numeric THEN
    RAISE EXCEPTION 'FAIL tenant B fixed cost: %',amount;
  END IF;

  SELECT * INTO r
  FROM private.run_pol_003f_costs_hours_adapter_v1(
    '53000000-0000-4000-8000-000000000001','2025-01-01','2025-03-31'
  );
  IF r.available_hour_events_inserted<>0 OR r.hour_config_skipped<>1 THEN
    RAISE EXCEPTION 'FAIL zero config must fail closed: %',row_to_json(r);
  END IF;

  IF has_function_privilege(
      'authenticated','private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL authenticated adapter execute';
  END IF;
  IF has_function_privilege(
      'service_role','private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL service role adapter execute';
  END IF;
END
$test$;

ROLLBACK;
