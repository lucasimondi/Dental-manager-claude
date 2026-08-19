-- POL-003B synthetic-only regression suite. All changes roll back.
BEGIN;
CREATE TABLE IF NOT EXISTS public.plans (id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,voci jsonb DEFAULT '[]',stato text,sconto numeric DEFAULT 0,sconto_tipo text DEFAULT 'pct');
CREATE TABLE IF NOT EXISTS public.payments (id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,importo numeric,stato text DEFAULT 'pagato');
CREATE TABLE IF NOT EXISTS public.documenti_fiscali (id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,tipo text,importo numeric);
CREATE TABLE IF NOT EXISTS public.pagamenti_esterni (id bigint PRIMARY KEY,studio_id uuid,data date,importo numeric);
CREATE TABLE IF NOT EXISTS public.spese (id bigint PRIMARY KEY,studio_id uuid,data date,importo numeric,tipo_costo text);

INSERT INTO public.plans VALUES
(3101,'31000000-0000-4000-8000-000000000001',31001,'2025-01-02','[{"prestazione":"A","prezzo":100,"eseguita":true,"dataEsec":"2025-01-10","operatoreId":"op-a"},{"prestazione":"B","prezzo":200,"eseguita":false,"incassata":true,"operatoreId":"op-b"}]','accettato',10,'pct'),
(3102,'31000000-0000-4000-8000-000000000001',31002,'2025-01-03','[{"prestazione":"C","prezzo":100,"eseguita":true,"dataEsec":null}]','concluso',20,'fixed'),
(3103,'31000000-0000-4000-8000-000000000001',31003,'2025-01-04','[{"prestazione":"D","prezzo":"invalid","eseguita":false}]','attivo',0,'pct'),
(3104,'31000000-0000-4000-8000-000000000001',31004,'2025-01-05','[{"prestazione":"Cancelled","prezzo":50,"eseguita":false}]','annullato',0,'pct'),
(3201,'32000000-0000-4000-8000-000000000001',32001,'2025-01-02','[{"prestazione":"Tenant B","prezzo":999,"eseguita":true,"dataEsec":"2025-01-11"}]','attivo',0,'pct');
INSERT INTO public.payments VALUES
(3111,'31000000-0000-4000-8000-000000000001',31001,'2025-01-12',150,'pagato'),
(3112,'31000000-0000-4000-8000-000000000001',31001,'2025-01-13',50,'pending'),
(3113,'31000000-0000-4000-8000-000000000001',31001,'2025-01-14',-20,'pagato'),
(3211,'32000000-0000-4000-8000-000000000001',32001,'2025-01-12',999,'pagato');
INSERT INTO public.documenti_fiscali VALUES (1,'31000000-0000-4000-8000-000000000001',31001,'2025-01-15','rimborso',10),(2,'31000000-0000-4000-8000-000000000001',31001,'2025-01-16','fattura',100);
INSERT INTO public.pagamenti_esterni VALUES (1,'31000000-0000-4000-8000-000000000001','2025-01-15',45),(2,'32000000-0000-4000-8000-000000000001','2025-01-15',55);
INSERT INTO public.spese VALUES (1,'31000000-0000-4000-8000-000000000001','2025-01-15',25,'variabile');

DO $test$
DECLARE r record;r2 record;n bigint;amount numeric;
BEGIN
  SELECT * INTO r FROM private.run_pol_003b_legacy_adapter_v1('31000000-0000-4000-8000-000000000001');
  IF (r.contracts_inserted,r.lines_inserted,r.produced_inserted,r.payments_inserted) IS DISTINCT FROM (3::bigint,4::bigint,1::bigint,1::bigint) THEN RAISE EXCEPTION 'FAIL safe inserts: %',row_to_json(r); END IF;
  IF (r.plans_skipped,r.lines_skipped,r.produced_skipped,r.payments_skipped) IS DISTINCT FROM (1::bigint,1::bigint,1::bigint,2::bigint) THEN RAISE EXCEPTION 'FAIL skip counters: %',row_to_json(r); END IF;
  IF (r.fiscal_documents_blocked,r.external_payments_blocked,r.costs_blocked) IS DISTINCT FROM (2::bigint,1::bigint,1::bigint) THEN RAISE EXCEPTION 'FAIL blocked counters: %',row_to_json(r); END IF;
  SELECT * INTO r2 FROM private.run_pol_003b_legacy_adapter_v1('31000000-0000-4000-8000-000000000001');
  IF (r2.contracts_inserted,r2.lines_inserted,r2.produced_inserted,r2.payments_inserted) IS DISTINCT FROM (0::bigint,0::bigint,0::bigint,0::bigint) THEN RAISE EXCEPTION 'FAIL idempotency: %',row_to_json(r2); END IF;
  SELECT count(*) INTO n FROM public.financial_line_events_v1 WHERE stage='ACCETTATO' AND source_table='plans'; IF n<>0 THEN RAISE EXCEPTION 'FAIL acceptance date invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_line_events_v1 WHERE event_kind='CANCELLATION' AND source_table='plans'; IF n<>0 THEN RAISE EXCEPTION 'FAIL cancellation date invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_invoice_events_v1 WHERE source_table='documenti_fiscali'; IF n<>0 THEN RAISE EXCEPTION 'FAIL fiscal semantics invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_payment_events_v1 WHERE source_table='pagamenti_esterni'; IF n<>0 THEN RAISE EXCEPTION 'FAIL external reconciliation invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_cost_events_v1 WHERE source_table='spese'; IF n<>0 THEN RAISE EXCEPTION 'FAIL cost history invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_payment_allocations_v1 WHERE source_table IN ('payments','plans'); IF n<>0 THEN RAISE EXCEPTION 'FAIL allocation invented'; END IF;
  SELECT count(*) INTO n FROM public.financial_contract_lines_v1 WHERE studio_id='31000000-0000-4000-8000-000000000001' AND operator_ref IS NOT NULL; IF n<>0 THEN RAISE EXCEPTION 'FAIL unverified multi-operator mapping invented'; END IF;
  SELECT sum(v.net_amount) INTO amount FROM private.financial_line_values_v1 v WHERE v.studio_id='31000000-0000-4000-8000-000000000001'; IF amount IS DISTINCT FROM 400::numeric THEN RAISE EXCEPTION 'FAIL discounts: %',amount; END IF;
  SELECT sum(v.net_amount*e.fraction*e.direction) INTO amount FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id WHERE e.studio_id='31000000-0000-4000-8000-000000000001' AND e.stage='PRODOTTO'; IF amount IS DISTINCT FROM 90::numeric THEN RAISE EXCEPTION 'FAIL produced discount: %',amount; END IF;
  PERFORM private.run_pol_003b_legacy_adapter_v1('32000000-0000-4000-8000-000000000001');
  SELECT count(*) INTO n FROM public.financial_contracts_v1 WHERE studio_id='32000000-0000-4000-8000-000000000001' AND source_table='plans'; IF n<>1 THEN RAISE EXCEPTION 'FAIL tenant B'; END IF;
  SELECT count(*) INTO n FROM public.financial_contracts_v1 WHERE studio_id='31000000-0000-4000-8000-000000000001' AND source_table='plans'; IF n<>3 THEN RAISE EXCEPTION 'FAIL tenant A changed'; END IF;
END $test$;
ROLLBACK;
