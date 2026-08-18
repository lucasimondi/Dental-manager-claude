-- POL-003 canonical financial engine regression suite.
-- Run only in a disposable local Supabase/PostgreSQL 17 database.
BEGIN;

CREATE FUNCTION pg_temp.assert_num(p_label text, p_actual numeric, p_expected numeric)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_actual IS NULL OR abs(p_actual - p_expected) > 0.0001 THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  END IF;
END
$function$;

CREATE FUNCTION pg_temp.assert_null(p_label text, p_actual numeric)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_actual IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL %: expected NULL, got %', p_label, p_actual;
  END IF;
END
$function$;

CREATE FUNCTION pg_temp.set_claim(p_user uuid, p_studio uuid)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('studio_id', p_studio::text)
    )::text,
    true
  );
END
$function$;

-- Scenario contracts. Each scenario has an isolated synthetic tenant so
-- as-of credit balances never bleed into another scenario.
INSERT INTO public.financial_contracts_v1
  (studio_id, patient_id, proposal_date, discount_kind, discount_value, source_table, source_id)
VALUES
  ('10000000-0000-4000-8000-000000000001', 101, '2025-01-01', 'NONE', 0, 'synthetic_contracts', 'advance'),
  ('10000000-0000-4000-8000-000000000002', 102, '2025-02-01', 'NONE', 0, 'synthetic_contracts', 'partial-payment'),
  ('10000000-0000-4000-8000-000000000003', 103, '2025-03-01', 'FIXED', 30, 'synthetic_contracts', 'discount'),
  ('10000000-0000-4000-8000-000000000004', 104, '2025-04-01', 'NONE', 0, 'synthetic_contracts', 'partial-execution'),
  ('10000000-0000-4000-8000-000000000005', 105, '2025-05-01', 'NONE', 0, 'synthetic_contracts', 'cancellation'),
  ('10000000-0000-4000-8000-000000000006', 106, '2025-06-01', 'NONE', 0, 'synthetic_contracts', 'refund'),
  ('10000000-0000-4000-8000-000000000007', 107, '2025-07-01', 'NONE', 0, 'synthetic_contracts', 'external'),
  ('10000000-0000-4000-8000-000000000008', 108, '2025-08-01', 'NONE', 0, 'synthetic_contracts', 'cross-period'),
  ('10000000-0000-4000-8000-000000000009', 109, '2025-10-01', 'NONE', 0, 'synthetic_contracts', 'historic-oct'),
  ('10000000-0000-4000-8000-000000000009', 109, '2025-11-01', 'NONE', 0, 'synthetic_contracts', 'historic-nov'),
  ('10000000-0000-4000-8000-000000000010', 110, '2025-12-01', 'NONE', 0, 'synthetic_contracts', 'tenant-a'),
  ('20000000-0000-4000-8000-000000000010', 210, '2025-12-01', 'NONE', 0, 'synthetic_contracts', 'tenant-b'),
  ('10000000-0000-4000-8000-000000000011', 111, '2026-01-01', 'NONE', 0, 'synthetic_contracts', 'multi-operator');

INSERT INTO public.financial_contract_lines_v1
  (studio_id, contract_id, patient_id, service_ref, operator_ref, gross_amount,
   source_table, source_id, source_line_id)
SELECT c.studio_id, c.id, c.patient_id, v.service_ref, v.operator_ref, v.gross_amount,
       'synthetic_lines', c.source_id, v.line_id
FROM public.financial_contracts_v1 c
JOIN (VALUES
  ('advance', '1', 'service', 'op-a', 100::numeric),
  ('partial-payment', '1', 'service', 'op-a', 100::numeric),
  ('discount', '1', 'service-a', 'op-a', 100::numeric),
  ('discount', '2', 'service-b', 'op-b', 200::numeric),
  ('partial-execution', '1', 'service-a', 'op-a', 100::numeric),
  ('partial-execution', '2', 'service-b', 'op-b', 100::numeric),
  ('cancellation', '1', 'service', 'op-a', 100::numeric),
  ('refund', '1', 'service', 'op-a', 100::numeric),
  ('external', '1', 'service', 'op-a', 100::numeric),
  ('cross-period', '1', 'service', 'op-a', 100::numeric),
  ('historic-oct', '1', 'service', 'op-a', 200::numeric),
  ('historic-nov', '1', 'service', 'op-a', 200::numeric),
  ('tenant-a', '1', 'service', 'op-a', 100::numeric),
  ('tenant-b', '1', 'service', 'op-b', 999::numeric),
  ('multi-operator', '1', 'service-a', 'op-a', 100::numeric),
  ('multi-operator', '2', 'service-b', 'op-b', 200::numeric)
) AS v(contract_source, line_id, service_ref, operator_ref, gross_amount)
  ON v.contract_source = c.source_id;

-- Acceptance originals for every line.
INSERT INTO public.financial_line_events_v1
  (studio_id, contract_line_id, stage, event_date, direction, fraction, event_kind,
   operator_ref, source_table, source_id, source_line_id)
SELECT l.studio_id, l.id, 'ACCETTATO', c.proposal_date + 1, 1, 1, 'ORIGINAL',
       l.operator_ref, 'synthetic_acceptance', c.source_id || '-accept-' || l.source_line_id,
       l.source_line_id
FROM public.financial_contract_lines_v1 l
JOIN public.financial_contracts_v1 c ON c.id = l.contract_id AND c.studio_id = l.studio_id;

-- Production originals, excluding advance, cancellation and the unexecuted
-- second line of the partial-execution scenario.
INSERT INTO public.financial_line_events_v1
  (studio_id, contract_line_id, stage, event_date, direction, fraction, event_kind,
   operator_ref, source_table, source_id, source_line_id)
SELECT l.studio_id, l.id, 'PRODOTTO',
       CASE c.source_id WHEN 'cross-period' THEN '2025-08-20'::date ELSE c.proposal_date + 2 END,
       1, 1, 'ORIGINAL', l.operator_ref,
       'synthetic_production', c.source_id || '-produce-' || l.source_line_id, l.source_line_id
FROM public.financial_contract_lines_v1 l
JOIN public.financial_contracts_v1 c ON c.id = l.contract_id AND c.studio_id = l.studio_id
WHERE c.source_id NOT IN ('advance', 'cancellation')
  AND NOT (c.source_id = 'partial-execution' AND l.source_line_id = '2');

-- Explicit cancellation reverses acceptance in May without inventing a
-- historical restatement or a production reversal.
INSERT INTO public.financial_line_events_v1
  (studio_id, contract_line_id, stage, event_date, direction, fraction, event_kind,
   operator_ref, source_table, source_id, source_line_id)
SELECT l.studio_id, l.id, 'ACCETTATO', '2025-05-10', -1, 1, 'CANCELLATION',
       l.operator_ref, 'synthetic_cancellations', 'cancellation-reversal', l.source_line_id
FROM public.financial_contract_lines_v1 l
JOIN public.financial_contracts_v1 c ON c.id = l.contract_id AND c.studio_id = l.studio_id
WHERE c.source_id = 'cancellation';

INSERT INTO public.financial_invoice_events_v1
  (studio_id, contract_id, patient_id, event_date, direction, amount, event_kind,
   operator_ref, source_table, source_id, source_line_id)
SELECT c.studio_id, c.id, c.patient_id, v.event_date, 1, v.amount, 'INVOICE',
       NULL, 'synthetic_invoices', c.source_id || '-invoice', '1'
FROM public.financial_contracts_v1 c
JOIN (VALUES
  ('partial-payment', '2025-02-05'::date, 100::numeric),
  ('discount', '2025-03-05'::date, 270::numeric),
  ('partial-execution', '2025-04-05'::date, 100::numeric),
  ('refund', '2025-06-05'::date, 100::numeric),
  ('external', '2025-07-05'::date, 100::numeric),
  ('cross-period', '2025-08-21'::date, 100::numeric),
  ('historic-oct', '2025-10-05'::date, 200::numeric),
  ('historic-nov', '2025-11-05'::date, 200::numeric),
  ('tenant-a', '2025-12-05'::date, 100::numeric),
  ('tenant-b', '2025-12-05'::date, 999::numeric),
  ('multi-operator', '2026-01-05'::date, 300::numeric)
) AS v(contract_source, event_date, amount) ON v.contract_source = c.source_id;

INSERT INTO public.financial_payment_events_v1
  (studio_id, contract_id, patient_id, event_date, direction, amount, event_kind,
   reconciled, source_table, source_id)
SELECT c.studio_id, c.id, c.patient_id, v.event_date, v.direction, v.amount,
       v.event_kind, v.reconciled, 'synthetic_payments', v.source_id
FROM public.financial_contracts_v1 c
JOIN (VALUES
  ('advance', '2025-01-03'::date, 1::smallint, 100::numeric, 'PAYMENT', true, 'advance-pay'),
  ('partial-payment', '2025-02-06'::date, 1::smallint, 40::numeric, 'PAYMENT', true, 'partial-pay'),
  ('discount', '2025-03-06'::date, 1::smallint, 270::numeric, 'PAYMENT', true, 'discount-pay'),
  ('partial-execution', '2025-04-06'::date, 1::smallint, 50::numeric, 'PAYMENT', true, 'partial-exec-pay'),
  ('refund', '2025-06-06'::date, 1::smallint, 100::numeric, 'PAYMENT', true, 'refund-pay'),
  ('refund', '2025-06-20'::date, -1::smallint, 20::numeric, 'REFUND', true, 'refund-reversal'),
  ('external', '2025-07-06'::date, 1::smallint, 70::numeric, 'EXTERNAL_PAYMENT', true, 'external-reconciled'),
  ('external', '2025-07-07'::date, 1::smallint, 30::numeric, 'EXTERNAL_PAYMENT', false, 'external-unreconciled'),
  ('cross-period', '2025-09-05'::date, 1::smallint, 100::numeric, 'PAYMENT', true, 'cross-pay'),
  ('historic-oct', '2025-10-06'::date, 1::smallint, 200::numeric, 'PAYMENT', true, 'historic-oct-pay'),
  ('historic-nov', '2025-11-06'::date, 1::smallint, 200::numeric, 'PAYMENT', true, 'historic-nov-pay'),
  ('tenant-a', '2025-12-06'::date, 1::smallint, 100::numeric, 'PAYMENT', true, 'tenant-a-pay'),
  ('tenant-b', '2025-12-06'::date, 1::smallint, 999::numeric, 'PAYMENT', true, 'tenant-b-pay'),
  ('multi-operator', '2026-01-06'::date, 1::smallint, 300::numeric, 'PAYMENT', true, 'multi-pay')
) AS v(contract_source, event_date, direction, amount, event_kind, reconciled, source_id)
  ON v.contract_source = c.source_id;

INSERT INTO public.financial_cost_events_v1
  (studio_id, stage, classification, event_date, direction, amount, operator_ref,
   cost_version_ref, source_table, source_id)
VALUES
  ('10000000-0000-4000-8000-000000000003', 'SOSTENUTO', 'VARIABILE', '2025-03-10', 1, 70, NULL, 'discount-cost-v1', 'synthetic_costs', 'discount-cost'),
  ('10000000-0000-4000-8000-000000000004', 'SOSTENUTO', 'VARIABILE', '2025-04-10', 1, 20, NULL, 'partial-cost-v1', 'synthetic_costs', 'partial-cost'),
  ('10000000-0000-4000-8000-000000000009', 'SOSTENUTO', 'VARIABILE', '2025-10-10', 1, 30, NULL, 'material-cost-v1', 'synthetic_costs', 'historic-old'),
  ('10000000-0000-4000-8000-000000000009', 'SOSTENUTO', 'VARIABILE', '2025-11-10', 1, 50, NULL, 'material-cost-v2', 'synthetic_costs', 'historic-new'),
  ('10000000-0000-4000-8000-000000000011', 'SOSTENUTO', 'VARIABILE', '2026-01-10', 1, 20, 'op-a', 'operator-a-v1', 'synthetic_costs', 'operator-a-cost'),
  ('10000000-0000-4000-8000-000000000011', 'SOSTENUTO', 'VARIABILE', '2026-01-10', 1, 50, 'op-b', 'operator-b-v1', 'synthetic_costs', 'operator-b-cost'),
  ('10000000-0000-4000-8000-000000000012', 'PREVISTO', 'FISSO', '2026-02-01', 1, 120, NULL, 'fixed-v1', 'synthetic_costs', 'zero-predicted'),
  ('10000000-0000-4000-8000-000000000012', 'IMPEGNATO', 'FISSO', '2026-02-01', 1, 110, NULL, 'fixed-v1', 'synthetic_costs', 'zero-committed'),
  ('10000000-0000-4000-8000-000000000012', 'SOSTENUTO', 'FISSO', '2026-02-01', 1, 100, NULL, 'fixed-v1', 'synthetic_costs', 'zero-sustained');

INSERT INTO public.financial_hours_v1
  (studio_id, event_date, scope, operator_ref, productive_hours, source_table, source_id)
VALUES
  ('10000000-0000-4000-8000-000000000011', '2026-01-31', 'STRUCTURE', NULL, 30, 'synthetic_hours', 'structure-jan'),
  ('10000000-0000-4000-8000-000000000011', '2026-01-31', 'OPERATOR', 'op-a', 10, 'synthetic_hours', 'operator-a-jan'),
  ('10000000-0000-4000-8000-000000000011', '2026-01-31', 'OPERATOR', 'op-b', 20, 'synthetic_hours', 'operator-b-jan');

SET LOCAL ROLE authenticated;

-- Helper invocation requires no caller-supplied studio id; each test changes
-- only trusted JWT claims and active membership is checked server-side.
DO $tests$
DECLARE
  s record;
  v_count integer;
BEGIN
  -- 1. Advance payment before production.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000001');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-01-01','2025-01-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('advance preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('advance accettato', s.accettato, 100);
  PERFORM pg_temp.assert_num('advance prodotto', s.prodotto, 0);
  PERFORM pg_temp.assert_num('advance fatturato', s.fatturato, 0);
  PERFORM pg_temp.assert_num('advance incassato', s.incassato, 100);
  PERFORM pg_temp.assert_num('advance credito prodotto', s.credito_residuo, -100);
  PERFORM pg_temp.assert_num('advance margine', s.margine_contribuzione, 0);

  -- 2. Partial payment.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000002');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-02-01','2025-02-28','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('partial payment preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('partial payment accettato', s.accettato, 100);
  PERFORM pg_temp.assert_num('partial payment prodotto', s.prodotto, 100);
  PERFORM pg_temp.assert_num('partial payment fatturato', s.fatturato, 100);
  PERFORM pg_temp.assert_num('partial payment incassato', s.incassato, 40);
  PERFORM pg_temp.assert_num('partial payment credito', s.credito_residuo, 60);
  PERFORM pg_temp.assert_num('partial payment margine', s.margine_contribuzione, 100);

  -- 3. Fixed discount allocated proportionally across two service lines.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000003');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-03-01','2025-03-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('discount preventivato net', s.preventivato, 270);
  PERFORM pg_temp.assert_num('discount preventivato gross', s.preventivato_lordo, 300);
  PERFORM pg_temp.assert_num('discount accepted', s.accettato, 270);
  PERFORM pg_temp.assert_num('discount produced', s.prodotto, 270);
  PERFORM pg_temp.assert_num('discount invoiced', s.fatturato, 270);
  PERFORM pg_temp.assert_num('discount collected', s.incassato, 270);
  PERFORM pg_temp.assert_num('discount credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('discount variable cost', s.costi_variabili, 70);
  PERFORM pg_temp.assert_num('discount contribution', s.margine_contribuzione, 200);
  PERFORM pg_temp.assert_num('discount EBITDA', s.ebitda_operativo_gestionale, 200);
  SELECT count(*) INTO v_count FROM public.get_financial_drilldown_v1('2025-03-01','2025-03-31','PRODOTTO','NET','PRODOTTO');
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL discount drilldown line count: %', v_count; END IF;

  -- 4. Partial execution.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000004');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-04-01','2025-04-30','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('partial execution preventivato', s.preventivato, 200);
  PERFORM pg_temp.assert_num('partial execution accettato', s.accettato, 200);
  PERFORM pg_temp.assert_num('partial execution prodotto', s.prodotto, 100);
  PERFORM pg_temp.assert_num('partial execution fatturato', s.fatturato, 100);
  PERFORM pg_temp.assert_num('partial execution incassato', s.incassato, 50);
  PERFORM pg_temp.assert_num('partial execution credito', s.credito_residuo, 50);
  PERFORM pg_temp.assert_num('partial execution margin', s.margine_contribuzione, 80);

  -- 5. Cancellation after acceptance is an explicit acceptance reversal.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000005');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-05-01','2025-05-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('cancellation preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('cancellation accepted', s.accettato, 0);
  PERFORM pg_temp.assert_num('cancellation produced', s.prodotto, 0);
  PERFORM pg_temp.assert_num('cancellation invoiced', s.fatturato, 0);
  PERFORM pg_temp.assert_num('cancellation collected', s.incassato, 0);
  PERFORM pg_temp.assert_num('cancellation credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('cancellation margin', s.margine_contribuzione, 0);

  -- 6. Refund reduces cash and increases residual credit.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000006');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-06-01','2025-06-30','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('refund preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('refund accepted', s.accettato, 100);
  PERFORM pg_temp.assert_num('refund produced', s.prodotto, 100);
  PERFORM pg_temp.assert_num('refund invoiced', s.fatturato, 100);
  PERFORM pg_temp.assert_num('refund collected', s.incassato, 80);
  PERFORM pg_temp.assert_num('refund credit', s.credito_residuo, 20);
  PERFORM pg_temp.assert_num('refund margin', s.margine_contribuzione, 100);

  -- 7. External payment counts only after reconciliation.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000007');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-07-01','2025-07-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('external preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('external accepted', s.accettato, 100);
  PERFORM pg_temp.assert_num('external produced', s.prodotto, 100);
  PERFORM pg_temp.assert_num('external invoiced', s.fatturato, 100);
  PERFORM pg_temp.assert_num('external collected', s.incassato, 70);
  PERFORM pg_temp.assert_num('external credit', s.credito_residuo, 30);
  PERFORM pg_temp.assert_num('external margin', s.margine_contribuzione, 100);

  -- 8. Production and cash in different months; credit is an as-of balance.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000008');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-08-01','2025-08-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('cross August preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('cross August accepted', s.accettato, 100);
  PERFORM pg_temp.assert_num('cross August produced', s.prodotto, 100);
  PERFORM pg_temp.assert_num('cross August invoiced', s.fatturato, 100);
  PERFORM pg_temp.assert_num('cross August collected', s.incassato, 0);
  PERFORM pg_temp.assert_num('cross August credit', s.credito_residuo, 100);
  PERFORM pg_temp.assert_num('cross August margin', s.margine_contribuzione, 100);
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-09-01','2025-09-30','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('cross September preventivato', s.preventivato, 0);
  PERFORM pg_temp.assert_num('cross September accepted', s.accettato, 0);
  PERFORM pg_temp.assert_num('cross September produced', s.prodotto, 0);
  PERFORM pg_temp.assert_num('cross September invoiced', s.fatturato, 0);
  PERFORM pg_temp.assert_num('cross September collected', s.incassato, 100);
  PERFORM pg_temp.assert_num('cross September credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('cross September margin', s.margine_contribuzione, 0);

  -- 9. Historical costs remain effective-dated and versioned.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000009');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-10-01','2025-10-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('historic October preventivato', s.preventivato, 200);
  PERFORM pg_temp.assert_num('historic October accepted', s.accettato, 200);
  PERFORM pg_temp.assert_num('historic October produced', s.prodotto, 200);
  PERFORM pg_temp.assert_num('historic October invoiced', s.fatturato, 200);
  PERFORM pg_temp.assert_num('historic October collected', s.incassato, 200);
  PERFORM pg_temp.assert_num('historic October credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('historic October margin', s.margine_contribuzione, 170);
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-11-01','2025-11-30','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('historic November preventivato', s.preventivato, 200);
  PERFORM pg_temp.assert_num('historic November accepted', s.accettato, 200);
  PERFORM pg_temp.assert_num('historic November produced', s.prodotto, 200);
  PERFORM pg_temp.assert_num('historic November invoiced', s.fatturato, 200);
  PERFORM pg_temp.assert_num('historic November collected', s.incassato, 200);
  PERFORM pg_temp.assert_num('historic November credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('historic November margin', s.margine_contribuzione, 150);

  -- 10. Two-studio isolation.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000010');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-12-01','2025-12-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('tenant A preventivato', s.preventivato, 100);
  PERFORM pg_temp.assert_num('tenant A accepted', s.accettato, 100);
  PERFORM pg_temp.assert_num('tenant A produced', s.prodotto, 100);
  PERFORM pg_temp.assert_num('tenant A invoiced', s.fatturato, 100);
  PERFORM pg_temp.assert_num('tenant A collected', s.incassato, 100);
  PERFORM pg_temp.assert_num('tenant A credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('tenant A margin', s.margine_contribuzione, 100);
  SELECT count(*) INTO v_count FROM public.financial_contracts_v1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL tenant A RLS count: %', v_count; END IF;
  PERFORM pg_temp.set_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '20000000-0000-4000-8000-000000000010');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2025-12-01','2025-12-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('tenant B preventivato', s.preventivato, 999);
  PERFORM pg_temp.assert_num('tenant B accepted', s.accettato, 999);
  PERFORM pg_temp.assert_num('tenant B produced', s.prodotto, 999);
  PERFORM pg_temp.assert_num('tenant B invoiced', s.fatturato, 999);
  PERFORM pg_temp.assert_num('tenant B collected', s.incassato, 999);
  PERFORM pg_temp.assert_num('tenant B credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('tenant B margin', s.margine_contribuzione, 999);

  -- 11. Multiple operators and hourly denominators.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000011');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2026-01-01','2026-01-31','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('operators preventivato', s.preventivato, 300);
  PERFORM pg_temp.assert_num('operators accepted', s.accettato, 300);
  PERFORM pg_temp.assert_num('operators produced', s.prodotto, 300);
  PERFORM pg_temp.assert_num('operators invoiced', s.fatturato, 300);
  PERFORM pg_temp.assert_num('operators collected', s.incassato, 300);
  PERFORM pg_temp.assert_num('operators credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('operators margin', s.margine_contribuzione, 230);
  PERFORM pg_temp.assert_num('operators structure hourly cost', s.costo_orario_struttura, 70.0 / 30.0);
  PERFORM pg_temp.assert_num('operators operator hourly cost', s.costo_orario_operatore, 70.0 / 30.0);
  PERFORM pg_temp.assert_num('operators production hour', s.produzione_ora, 10);
  PERFORM pg_temp.assert_num('operators collection hour', s.incasso_ora, 10);
  SELECT count(DISTINCT operator_ref) INTO v_count
  FROM public.get_financial_drilldown_v1('2026-01-01','2026-01-31','PRODOTTO','NET','PRODOTTO');
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL multiple operator drilldown: %', v_count; END IF;

  -- 12. Zero denominators remain NULL, never fabricated as zero.
  PERFORM pg_temp.set_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000012');
  SELECT * INTO s FROM public.get_financial_snapshot_v1('2026-02-01','2026-02-28','NET','PRODOTTO');
  PERFORM pg_temp.assert_num('zero preventivato', s.preventivato, 0);
  PERFORM pg_temp.assert_num('zero accepted', s.accettato, 0);
  PERFORM pg_temp.assert_num('zero produced', s.prodotto, 0);
  PERFORM pg_temp.assert_num('zero invoiced', s.fatturato, 0);
  PERFORM pg_temp.assert_num('zero collected', s.incassato, 0);
  PERFORM pg_temp.assert_num('zero credit', s.credito_residuo, 0);
  PERFORM pg_temp.assert_num('zero margin', s.margine_contribuzione, 0);
  PERFORM pg_temp.assert_num('zero EBITDA', s.ebitda_operativo_gestionale, -100);
  PERFORM pg_temp.assert_num('zero predicted cost', s.costi_previsti, 120);
  PERFORM pg_temp.assert_num('zero committed cost', s.costi_impegnati, 110);
  PERFORM pg_temp.assert_null('zero contribution pct', s.margine_contribuzione_pct);
  PERFORM pg_temp.assert_null('zero break even', s.break_even);
  PERFORM pg_temp.assert_null('zero structure hourly cost', s.costo_orario_struttura);
  PERFORM pg_temp.assert_null('zero operator hourly cost', s.costo_orario_operatore);
  PERFORM pg_temp.assert_null('zero production hour', s.produzione_ora);
  PERFORM pg_temp.assert_null('zero collection hour', s.incasso_ora);
END
$tests$;

RESET ROLE;

-- Static privilege and contract assertions.
DO $security$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename LIKE 'financial_%_v1'
    AND cmd = 'SELECT'
    AND 'authenticated' = ANY(roles);
  IF v_policy_count <> 7 THEN
    RAISE EXCEPTION 'FAIL expected 7 tenant SELECT policies, got %', v_policy_count;
  END IF;
  IF has_table_privilege('authenticated', 'public.financial_contracts_v1', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL authenticated must not write canonical source tables directly';
  END IF;
  IF has_function_privilege('anon', 'public.get_financial_snapshot_v1(date,date,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL anon can execute canonical snapshot';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_financial_snapshot_v1(date,date,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL authenticated cannot execute canonical snapshot';
  END IF;
END
$security$;

ROLLBACK;
