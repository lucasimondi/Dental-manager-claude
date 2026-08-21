-- POL-003A synthetic regression suite. All mutations roll back.
BEGIN;

CREATE FUNCTION pg_temp.assert_num(p_label text,p_actual numeric,p_expected numeric)
RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %',p_label,p_expected,p_actual;
  END IF;
END $f$;
CREATE FUNCTION pg_temp.assert_null(p_label text,p_actual numeric)
RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
  IF p_actual IS NOT NULL THEN RAISE EXCEPTION 'FAIL %: expected NULL, got %',p_label,p_actual; END IF;
END $f$;
CREATE FUNCTION pg_temp.set_claim(p_user uuid,p_studio uuid)
RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_user::text,'role','authenticated','app_metadata',jsonb_build_object('studio_id',p_studio::text)
  )::text,true);
END $f$;
-- POL-003A repro: authenticated JWT with NO app_metadata.studio_id claim at
-- all (the exact condition that previously made get_financial_snapshot_v1
-- raise 'access denied' for a legitimate, actively-assigned owner/admin).
CREATE FUNCTION pg_temp.set_claim_no_studio(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_user::text,'role','authenticated','app_metadata','{}'::jsonb
  )::text,true);
END $f$;

-- Contract headers and lines. Scenarios use one isolated synthetic tenant each.
INSERT INTO public.financial_contracts_v1(studio_id,patient_id,proposal_date,discount_kind,discount_value,source_table,source_id) VALUES
('10000000-0000-4000-8000-000000000001',101,'2025-01-02','PERCENT',10,'synthetic','pct'),
('10000000-0000-4000-8000-000000000001',102,'2025-01-03','FIXED',20,'synthetic','fixed'),
('10000000-0000-4000-8000-000000000002',201,'2025-02-01','NONE',0,'synthetic','advance'),
('10000000-0000-4000-8000-000000000003',301,'2025-03-01','NONE',0,'synthetic','partial'),
('10000000-0000-4000-8000-000000000004',401,'2025-04-01','NONE',0,'synthetic','fifo-old'),
('10000000-0000-4000-8000-000000000004',401,'2025-04-02','NONE',0,'synthetic','fifo-new'),
('10000000-0000-4000-8000-000000000005',501,'2025-05-01','NONE',0,'synthetic','cancel'),
('10000000-0000-4000-8000-000000000006',601,'2025-06-01','NONE',0,'synthetic','refund'),
('10000000-0000-4000-8000-000000000007',701,'2025-07-01','NONE',0,'synthetic','reversals'),
('10000000-0000-4000-8000-000000000008',801,'2025-08-01','NONE',0,'synthetic','external'),
('10000000-0000-4000-8000-000000000009',901,'2025-09-01','NONE',0,'synthetic','kpi'),
('10000000-0000-4000-8000-000000000010',1001,'2025-10-01','NONE',0,'synthetic','tenant-a'),
('20000000-0000-4000-8000-000000000010',2001,'2025-10-01','NONE',0,'synthetic','tenant-b');

INSERT INTO public.financial_contract_lines_v1(studio_id,contract_id,patient_id,service_ref,operator_ref,gross_amount,source_table,source_id,source_line_id)
SELECT c.studio_id,c.id,c.patient_id,'service',CASE WHEN c.source_id='kpi' THEN 'op-a' END,
  CASE c.source_id WHEN 'pct' THEN 200 WHEN 'fixed' THEN 100 WHEN 'kpi' THEN 200 WHEN 'tenant-b' THEN 999 ELSE 100 END,
  'synthetic',c.source_id,'line-1'
FROM public.financial_contracts_v1 c;

-- Accepted and produced lifecycle events.
INSERT INTO public.financial_line_events_v1(studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,operator_ref,source_table,source_id)
SELECT l.studio_id,l.id,s.stage,
  CASE c.source_id WHEN 'cancel' THEN DATE '2025-05-05' ELSE c.proposal_date+1 END,
  1,CASE WHEN c.source_id='kpi' AND s.stage='PRODOTTO' THEN .5 ELSE 1 END,
  'ORIGINAL',l.operator_ref,'synthetic',c.source_id||'-'||lower(s.stage)
FROM public.financial_contract_lines_v1 l JOIN public.financial_contracts_v1 c ON c.id=l.contract_id
CROSS JOIN (VALUES('ACCETTATO'),('PRODOTTO')) s(stage)
WHERE c.source_id NOT IN ('advance','external')
  AND NOT (c.source_id='cancel' AND s.stage='PRODOTTO');

-- Advance is accepted but not produced. External scenario has no production/invoice.
INSERT INTO public.financial_line_events_v1(studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,source_table,source_id)
SELECT l.studio_id,l.id,'ACCETTATO','2025-02-02',1,1,'ORIGINAL','synthetic','advance-accepted'
FROM public.financial_contract_lines_v1 l JOIN public.financial_contracts_v1 c ON c.id=l.contract_id WHERE c.source_id='advance';

-- Cancellation and production reversal occur now; history is not rewritten.
INSERT INTO public.financial_line_events_v1(studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,source_table,source_id)
SELECT l.studio_id,l.id,'ACCETTATO','2025-05-20',-1,1,'CANCELLATION','synthetic','cancel-event'
FROM public.financial_contract_lines_v1 l JOIN public.financial_contracts_v1 c ON c.id=l.contract_id WHERE c.source_id='cancel';
INSERT INTO public.financial_line_events_v1(studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,source_table,source_id)
SELECT l.studio_id,l.id,'PRODOTTO','2025-07-20',-1,.2,'PRODUCTION_REVERSAL','synthetic','production-reversal'
FROM public.financial_contract_lines_v1 l JOIN public.financial_contracts_v1 c ON c.id=l.contract_id WHERE c.source_id='reversals';

-- Invoices: taxable/net VAT and VAT are stored separately; gross is generated.
INSERT INTO public.financial_invoice_events_v1(studio_id,contract_id,patient_id,event_date,direction,taxable_amount,vat_amount,event_kind,source_table,source_id)
SELECT c.studio_id,c.id,c.patient_id,c.proposal_date+2,1,
  CASE c.source_id WHEN 'pct' THEN 180 WHEN 'fixed' THEN 80 WHEN 'fifo-old' THEN 50 WHEN 'fifo-new' THEN 70
    WHEN 'kpi' THEN 80 WHEN 'tenant-b' THEN 999 ELSE 100 END,
  CASE c.source_id WHEN 'pct' THEN 18 WHEN 'fixed' THEN 8 WHEN 'fifo-old' THEN 5 WHEN 'fifo-new' THEN 7
    WHEN 'kpi' THEN 8 WHEN 'tenant-b' THEN 0 ELSE 10 END,
  'INVOICE','synthetic',c.source_id||'-invoice'
FROM public.financial_contracts_v1 c
WHERE c.source_id NOT IN ('advance','cancel','external');

-- Credit note is independent from production reversal.
INSERT INTO public.financial_invoice_events_v1(studio_id,contract_id,patient_id,event_date,direction,taxable_amount,vat_amount,event_kind,source_table,source_id)
SELECT c.studio_id,c.id,c.patient_id,'2025-07-21',-1,30,3,'CREDIT_NOTE','synthetic','credit-note'
FROM public.financial_contracts_v1 c WHERE c.source_id='reversals';

-- Cash events: advances/overpayment, partial, FIFO, refund and external reconciliation.
INSERT INTO public.financial_payment_events_v1(studio_id,contract_id,patient_id,event_date,direction,amount,event_kind,reconciled,source_table,source_id)
SELECT c.studio_id,c.id,c.patient_id,d.dt,d.direction,d.amount,d.kind,d.reconciled,'synthetic',d.sid
FROM (VALUES
 ('advance',DATE '2025-02-03',1::smallint,150::numeric,'PAYMENT',true,'advance-payment'),
 ('partial',DATE '2025-03-04',1::smallint,40::numeric,'PAYMENT',true,'partial-payment'),
 ('partial',DATE '2025-07-15',-1::smallint,10::numeric,'REFUND',true,'partial-unallocated-refund'),
 ('fifo-old',DATE '2025-04-10',1::smallint,80::numeric,'PAYMENT',true,'fifo-payment'),
 ('refund',DATE '2025-06-04',1::smallint,110::numeric,'PAYMENT',true,'refund-original-payment'),
 ('refund',DATE '2025-06-10',-1::smallint,20::numeric,'REFUND',true,'refund-event'),
 ('external',DATE '2025-08-03',1::smallint,40::numeric,'EXTERNAL_PAYMENT',false,'external-unreconciled'),
 ('external',DATE '2025-08-04',1::smallint,60::numeric,'EXTERNAL_PAYMENT',true,'external-reconciled'),
 ('kpi',DATE '2025-09-05',1::smallint,50::numeric,'PAYMENT',true,'kpi-payment'),
 ('tenant-a',DATE '2025-10-05',1::smallint,110::numeric,'PAYMENT',true,'tenant-a-payment'),
 ('tenant-b',DATE '2025-10-05',1::smallint,999::numeric,'PAYMENT',true,'tenant-b-payment')
) d(contract_ref,dt,direction,amount,kind,reconciled,sid)
JOIN public.financial_contracts_v1 c ON c.source_id=d.contract_ref;

-- Explicit allocations override FIFO. Refund allocation is explicitly negative through payment direction.
INSERT INTO public.financial_payment_allocations_v1(studio_id,payment_event_id,invoice_event_id,contract_id,allocation_method,amount,source_table,source_id)
SELECT p.studio_id,p.id,i.id,p.contract_id,'EXPLICIT',x.amount,'synthetic',x.sid
FROM (VALUES
 ('partial-payment','partial-invoice',40::numeric,'partial-allocation'),
 ('refund-original-payment','refund-invoice',110::numeric,'refund-payment-allocation'),
 ('refund-event','refund-invoice',20::numeric,'refund-allocation'),
 ('tenant-a-payment','tenant-a-invoice',110::numeric,'tenant-a-allocation'),
 ('tenant-b-payment','tenant-b-invoice',999::numeric,'tenant-b-allocation')
) x(payment_ref,invoice_ref,amount,sid)
JOIN public.financial_payment_events_v1 p ON p.source_id=x.payment_ref
JOIN public.financial_invoice_events_v1 i ON i.source_id=x.invoice_ref AND i.studio_id=p.studio_id;

-- An explicit pre-invoice plan link is preserved and is not silently FIFO-allocated elsewhere.
INSERT INTO public.financial_payment_allocations_v1(studio_id,payment_event_id,contract_id,allocation_method,amount,source_table,source_id)
SELECT p.studio_id,p.id,p.contract_id,'EXPLICIT',150,'synthetic','advance-plan-link'
FROM public.financial_payment_events_v1 p WHERE p.source_id='advance-payment';

-- KPI costs deliberately include excluded EBITDA categories.
INSERT INTO public.financial_cost_events_v1(studio_id,stage,classification,cost_scope,event_date,direction,amount,operator_ref,cost_version_ref,source_table,source_id) VALUES
('10000000-0000-4000-8000-000000000009','SOSTENUTO','VARIABILE_ATTRIBUIBILE','STRUCTURE','2025-09-10',1,20,NULL,'v1','synthetic','variable'),
('10000000-0000-4000-8000-000000000009','SOSTENUTO','FISSO_OPERATIVO','STRUCTURE','2025-09-10',1,30,NULL,'v1','synthetic','fixed'),
('10000000-0000-4000-8000-000000000009','SOSTENUTO','FISSO_OPERATIVO','OPERATOR','2025-09-10',1,20,'op-base','v1','synthetic','base-payroll'),
('10000000-0000-4000-8000-000000000009','SOSTENUTO','AMMORTAMENTO_DEPREZZAMENTO','STRUCTURE','2025-09-10',1,25,NULL,'v1','synthetic','depreciation'),
('10000000-0000-4000-8000-000000000009','PREVISTO','FISSO_OPERATIVO','STRUCTURE','2025-09-01',1,140,NULL,'v1','synthetic','predicted'),
('10000000-0000-4000-8000-000000000009','IMPEGNATO','FISSO_OPERATIVO','STRUCTURE','2025-09-02',1,130,NULL,'v1','synthetic','committed');
INSERT INTO public.financial_hours_v1(studio_id,event_date,scope,hour_kind,operator_ref,hours,source_table,source_id) VALUES
('10000000-0000-4000-8000-000000000009','2025-09-30','STRUCTURE','AVAILABLE',NULL,50,'synthetic','available'),
('10000000-0000-4000-8000-000000000009','2025-09-30','OPERATOR','WORKED','op-a',12,'synthetic','worked-a'),
('10000000-0000-4000-8000-000000000009','2025-09-30','OPERATOR','WORKED','op-b',8,'synthetic','worked-b');

SET LOCAL ROLE authenticated;

DO $tests$
DECLARE s record;v_count integer;v_amount numeric;
BEGIN
  -- Percentage and fixed discounts are separate and proportionally reduce lifecycle values.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000001');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-01-01','2025-01-31');
  PERFORM pg_temp.assert_num('discount gross',s.preventivato_lordo,300);
  PERFORM pg_temp.assert_num('discount separate',s.sconto,40);
  PERFORM pg_temp.assert_num('discount net quote',s.preventivato,260);
  PERFORM pg_temp.assert_num('discount accepted',s.accettato,260);
  PERFORM pg_temp.assert_num('discount produced',s.prodotto,260);
  PERFORM pg_temp.assert_num('discount invoice net VAT',s.fatturato_netto_iva,260);
  PERFORM pg_temp.assert_num('discount invoice VAT',s.fatturato_iva,26);
  PERFORM pg_temp.assert_num('discount invoice gross',s.fatturato_lordo,286);

  -- Advance and overpayment affect cash only and remain unallocated customer-favour balance.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000002');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-02-01','2025-02-28');
  PERFORM pg_temp.assert_num('advance accepted',s.accettato,100);
  PERFORM pg_temp.assert_num('advance product',s.prodotto,0);
  PERFORM pg_temp.assert_num('advance invoice',s.fatturato_lordo,0);
  PERFORM pg_temp.assert_num('advance cash',s.incassato,150);
  PERFORM pg_temp.assert_num('advance portfolio',s.portafoglio_da_eseguire,100);
  PERFORM pg_temp.assert_num('advance customer credit balance',s.saldo_incassi_non_allocato,150);
  SELECT count(*) INTO v_count FROM public.financial_payment_allocations_v1 WHERE source_id='advance-plan-link';
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL explicit plan allocation link'; END IF;

  -- Explicit partial payment.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000003');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-03-01','2025-03-31');
  PERFORM pg_temp.assert_num('partial allocated',s.incassato_allocato,40);
  PERFORM pg_temp.assert_num('partial receivable gross',s.credito_clienti,70);
  PERFORM pg_temp.assert_num('partial unallocated',s.saldo_incassi_non_allocato,0);

  -- FIFO allocates oldest debt first without a client-side checkbox.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000004');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-04-01','2025-04-30');
  PERFORM pg_temp.assert_num('fifo allocated',s.incassato_allocato,80);
  PERFORM pg_temp.assert_num('fifo remaining receivable',s.credito_clienti,52);
  SELECT SUM(signed_amount) INTO v_amount FROM private.financial_effective_allocations_v1 a
    JOIN public.financial_invoice_events_v1 i ON i.id=a.invoice_event_id AND i.studio_id=a.studio_id
    WHERE a.studio_id='10000000-0000-4000-8000-000000000004' AND i.source_id='fifo-old-invoice';
  PERFORM pg_temp.assert_num('fifo oldest first',v_amount,55);

  -- Cancellation is a current-period event and does not rewrite original acceptance.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000005');
  SELECT COALESCE(SUM(amount),0) INTO v_amount FROM public.get_financial_drilldown_v1('2025-05-01','2025-05-10','ACCETTATO');
  PERFORM pg_temp.assert_num('acceptance history retained',v_amount,100);
  SELECT COALESCE(SUM(amount),0) INTO v_amount FROM public.get_financial_drilldown_v1('2025-05-20','2025-05-20','ACCETTATO');
  PERFORM pg_temp.assert_num('cancellation current period',v_amount,-100);
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-05-01','2025-05-31');
  PERFORM pg_temp.assert_num('cancelled portfolio',s.portafoglio_da_eseguire,0);
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-05-15','2025-05-31');
  PERFORM pg_temp.assert_num('portfolio opening',s.portafoglio_da_eseguire_apertura,100);
  PERFORM pg_temp.assert_num('portfolio movement',s.portafoglio_da_eseguire_movimenti,-100);
  PERFORM pg_temp.assert_num('portfolio closing',s.portafoglio_da_eseguire_chiusura,0);
  PERFORM pg_temp.assert_num('portfolio headline is closing',s.portafoglio_da_eseguire,s.portafoglio_da_eseguire_chiusura);

  -- Refund is negative cash and negative explicit allocation; invoice remains unchanged.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000006');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-06-01','2025-06-30');
  PERFORM pg_temp.assert_num('refund cash',s.incassato,90);
  PERFORM pg_temp.assert_num('refund allocated cash',s.incassato_allocato,90);
  PERFORM pg_temp.assert_num('refund receivable',s.credito_clienti,20);

  -- Unallocated refund stays negative unallocated cash and never auto-reopens an invoice.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000003');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-07-01','2025-07-31');
  PERFORM pg_temp.assert_num('unallocated refund cash movement',s.incassato,-10);
  PERFORM pg_temp.assert_num('unallocated refund allocated movement',s.incassato_allocato,0);
  PERFORM pg_temp.assert_num('receivable opening',s.credito_clienti_apertura,70);
  PERFORM pg_temp.assert_num('receivable movement',s.credito_clienti_movimenti,0);
  PERFORM pg_temp.assert_num('receivable closing',s.credito_clienti_chiusura,70);
  PERFORM pg_temp.assert_num('unallocated cash opening',s.saldo_incassi_non_allocato_apertura,0);
  PERFORM pg_temp.assert_num('unallocated refund movement',s.saldo_incassi_non_allocato_movimenti,-10);
  PERFORM pg_temp.assert_num('unallocated cash closing',s.saldo_incassi_non_allocato_chiusura,-10);
  PERFORM pg_temp.assert_num('unallocated headline is closing',s.saldo_incassi_non_allocato,s.saldo_incassi_non_allocato_chiusura);

  -- Credit note and production reversal affect only their respective ledgers.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000007');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-07-01','2025-07-31');
  PERFORM pg_temp.assert_num('production reversal',s.prodotto,80);
  PERFORM pg_temp.assert_num('credit note net invoice',s.fatturato_netto_iva,70);
  PERFORM pg_temp.assert_num('credit note gross invoice',s.fatturato_lordo,77);
  PERFORM pg_temp.assert_num('produced not invoiced',s.prodotto_da_fatturare,10);
  PERFORM pg_temp.assert_num('credit note receivable',s.credito_clienti,77);

  -- External cash is canonical only after reconciliation.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000008');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-08-01','2025-08-31');
  PERFORM pg_temp.assert_num('external reconciled only',s.incassato,60);
  PERFORM pg_temp.assert_num('external unallocated balance',s.saldo_incassi_non_allocato,60);

  -- Three distinct stock metrics; break-even compares production; hour denominators are separate.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000009');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-09-01','2025-09-30');
  PERFORM pg_temp.assert_num('portfolio to execute',s.portafoglio_da_eseguire,100);
  PERFORM pg_temp.assert_num('produced to invoice',s.prodotto_da_fatturare,20);
  PERFORM pg_temp.assert_num('customer receivable',s.credito_clienti,38);
  PERFORM pg_temp.assert_num('portfolio stock reconciliation',s.portafoglio_da_eseguire_apertura+s.portafoglio_da_eseguire_movimenti,s.portafoglio_da_eseguire_chiusura);
  PERFORM pg_temp.assert_num('produced-to-invoice stock reconciliation',s.prodotto_da_fatturare_apertura+s.prodotto_da_fatturare_movimenti,s.prodotto_da_fatturare_chiusura);
  PERFORM pg_temp.assert_num('receivable stock reconciliation',s.credito_clienti_apertura+s.credito_clienti_movimenti,s.credito_clienti_chiusura);
  PERFORM pg_temp.assert_num('unallocated-cash stock reconciliation',s.saldo_incassi_non_allocato_apertura+s.saldo_incassi_non_allocato_movimenti,s.saldo_incassi_non_allocato_chiusura);
  PERFORM pg_temp.assert_num('variable costs',s.costi_variabili,20);
  PERFORM pg_temp.assert_num('fixed operating costs',s.costi_fissi_operativi,50);
  PERFORM pg_temp.assert_num('contribution margin',s.margine_contribuzione,80);
  PERFORM pg_temp.assert_num('management EBITDA excludes depreciation',s.ebitda_operativo_gestionale,30);
  PERFORM pg_temp.assert_num('break even',s.break_even,62.5);
  IF s.break_even_raggiunto IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL break-even must compare with production'; END IF;
  PERFORM pg_temp.assert_num('available hours',s.ore_produttive_disponibili,50);
  PERFORM pg_temp.assert_num('worked hours',s.ore_effettivamente_lavorate,20);
  PERFORM pg_temp.assert_num('structure hourly cost includes base payroll but excludes direct variable and depreciation',s.costo_orario_struttura,1);
  PERFORM pg_temp.assert_num('production per worked hour',s.produzione_ora,5);
  PERFORM pg_temp.assert_num('cash per worked hour',s.incasso_ora,2.5);
  SELECT COALESCE(SUM(amount),0) INTO v_amount
  FROM public.get_financial_drilldown_v1('2025-09-01','2025-09-30','PRODOTTO');
  PERFORM pg_temp.assert_num('snapshot product reconciles to drilldown',v_amount,s.prodotto);
  SELECT COALESCE(SUM(amount),0) INTO v_amount
  FROM public.get_financial_drilldown_v1('2025-09-01','2025-09-30','CREDITO_CLIENTI');
  PERFORM pg_temp.assert_num('snapshot receivable reconciles to drilldown',v_amount,s.credito_clienti);

  -- Two-tenant isolation.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000010');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31');
  PERFORM pg_temp.assert_num('tenant A product',s.prodotto,100);
  SELECT count(*) INTO v_count FROM public.financial_contracts_v1;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL tenant A RLS count %',v_count; END IF;
  PERFORM pg_temp.set_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','20000000-0000-4000-8000-000000000010');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31');
  PERFORM pg_temp.assert_num('tenant B product',s.prodotto,999);
  SELECT count(*) INTO v_count FROM public.financial_contracts_v1;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL tenant B RLS count %',v_count; END IF;

  -- Zero denominators remain NULL.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000011');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-11-01','2025-11-30');
  PERFORM pg_temp.assert_null('zero break even',s.break_even);
  PERFORM pg_temp.assert_null('zero structure hourly cost',s.costo_orario_struttura);
  PERFORM pg_temp.assert_null('zero production hour',s.produzione_ora);
  PERFORM pg_temp.assert_null('zero cash hour',s.incasso_ora);

  -- POL-003A fix: AUTHORIZED OWNER/ADMIN, JWT app_metadata.studio_id
  -- MISSING, explicit p_studio_id supplied and backed by a real active
  -- studio_users row -> canonical financial access is ALLOWED, and the RLS
  -- override stays scoped to exactly that one studio (no cross-tenant leak).
  PERFORM pg_temp.set_claim_no_studio('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31','10000000-0000-4000-8000-000000000010');
  PERFORM pg_temp.assert_num('POL-003A fix: authorized owner, no JWT claim, explicit p_studio_id',s.prodotto,100);
  SELECT count(*) INTO v_count FROM public.financial_contracts_v1;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL POL-003A fix RLS override count %',v_count; END IF;

  -- POL-003A fix: UNAUTHORIZED USER (no studio_users row at all) explicitly
  -- naming a real studio's p_studio_id -> canonical financial access stays
  -- DENIED. Proves the new p_studio_id path cannot be used to bypass the
  -- studio_users membership boundary.
  PERFORM pg_temp.set_claim_no_studio('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  BEGIN
    SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31','10000000-0000-4000-8000-000000000010');
    RAISE EXCEPTION 'FAIL POL-003A fix: unauthorized user was NOT denied';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-003A: access denied%' THEN RAISE; END IF;
  END;

  -- POL-003A fix: old 2-arg call path (no p_studio_id) with JWT claim still
  -- missing stays DENIED exactly as before -> the fix does not silently
  -- widen the pre-existing call path, only the new explicit-studio one.
  PERFORM pg_temp.set_claim_no_studio('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  BEGIN
    SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31');
    RAISE EXCEPTION 'FAIL POL-003A fix: legacy 2-arg call unexpectedly succeeded without a JWT claim';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-003A: access denied%' THEN RAISE; END IF;
  END;
END
$tests$;

RESET ROLE;

DO $security$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname='public'
    AND tablename LIKE 'financial_%_v1' AND cmd='SELECT' AND 'authenticated'=ANY(roles);
  IF v_count<>8 THEN RAISE EXCEPTION 'FAIL expected 8 tenant SELECT policies, got %',v_count; END IF;
  IF has_table_privilege('authenticated','public.financial_contracts_v1','INSERT') THEN
    RAISE EXCEPTION 'FAIL authenticated direct write';
  END IF;
  IF has_function_privilege('anon','public.get_financial_snapshot_v1(date,date,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL anon snapshot execute';
  END IF;
  IF NOT has_function_privilege('authenticated','public.get_financial_snapshot_v1(date,date,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL authenticated snapshot execute';
  END IF;
  IF to_regprocedure('public.get_financial_snapshot_v1(date,date,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL ambiguous quote/credit basis signature remains';
  END IF;
  IF to_regprocedure('public.get_financial_snapshot_v1(date,date)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL old 2-arg snapshot signature was not replaced by the POL-003A fix';
  END IF;
  IF has_function_privilege('anon','private.financial_verified_studio_membership_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL anon verified-studio-membership execute';
  END IF;
  IF NOT has_function_privilege('authenticated','private.financial_verified_studio_membership_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL authenticated verified-studio-membership execute';
  END IF;
END
$security$;

ROLLBACK;
