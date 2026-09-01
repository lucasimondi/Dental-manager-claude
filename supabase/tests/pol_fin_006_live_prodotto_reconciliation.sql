-- POL-FIN-006 synthetic regression suite. All fixture writes roll back.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_num(p_label text, p_actual numeric, p_expected numeric)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_text(p_label text, p_actual text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.set_claim(p_user uuid, p_studio uuid)
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
END;
$function$;

INSERT INTO public.studio_users(user_id, studio_id, stato, ruolo) VALUES
  ('a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','attivo','admin'),
  ('b6000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002','attivo','admin'),
  ('c6000000-0000-4000-8000-000000000003','a6000000-0000-4000-8000-000000000001','attivo','utente')
ON CONFLICT DO NOTHING;

INSERT INTO public.studio_user_capabilities(studio_id, user_id, capability, granted_by) VALUES
  ('a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','finance.management.read','a6000000-0000-4000-8000-000000000001'),
  ('b6000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002','finance.management.read','b6000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.plans(
  id, studio_id, paziente_id, data, created_at, titolo, voci, sconto, sconto_tipo
) VALUES
  (
    6001,
    'a6000000-0000-4000-8000-000000000001',
    6101,
    '2026-01-01',
    '2026-01-01T08:00:00Z',
    'Heterogeneous',
    '[
      {"prestazione":"A","prezzo":100,"eseguita":true,"dataEsec":"2026-01-10"},
      {"prestazione":"B","prezzo":900,"eseguita":true,"dataEsec":"2026-02-10"}
    ]',
    100,
    'eur'
  ),
  (
    6002,
    'a6000000-0000-4000-8000-000000000001',
    6102,
    '2026-01-02',
    '2026-01-02T08:00:00Z',
    'Rounding',
    '[
      {"prestazione":"R1","prezzo":1,"eseguita":true,"dataEsec":"2026-01-11"},
      {"prestazione":"R2","prezzo":1,"eseguita":true,"dataEsec":"2026-01-12"},
      {"prestazione":"R3","prezzo":1,"eseguita":true,"dataEsec":"2026-01-13"}
    ]',
    1,
    'eur'
  ),
  (
    6003,
    'a6000000-0000-4000-8000-000000000001',
    6103,
    '2026-01-03',
    '2026-01-03T08:00:00Z',
    'Zero',
    '[{"prestazione":"Zero","prezzo":0,"eseguita":true,"dataEsec":"2026-01-14"}]',
    0,
    'pct'
  ),
  (
    6004,
    'a6000000-0000-4000-8000-000000000001',
    6104,
    '2026-01-04',
    '2026-01-04T08:00:00Z',
    'Partial execution',
    '[
      {"prestazione":"Done","prezzo":100,"eseguita":true,"dataEsec":"2026-01-15"},
      {"prestazione":"Pending","prezzo":100,"eseguita":false}
    ]',
    10,
    'pct'
  ),
  (
    6999,
    'b6000000-0000-4000-8000-000000000002',
    6199,
    '2026-01-01',
    '2026-01-01T08:00:00Z',
    'Tenant B',
    '[{"prestazione":"Other tenant","prezzo":999,"eseguita":true,"dataEsec":"2026-01-10"}]',
    0,
    'pct'
  );

INSERT INTO public.payments(
  id, studio_id, paziente_id, piano_id, data, importo, stato
) VALUES
  (6201,'a6000000-0000-4000-8000-000000000001',6101,6001,'2026-01-05',50,'pagato'),
  (6202,'a6000000-0000-4000-8000-000000000001',6101,6001,'2026-01-20',40,'pagato'),
  (6203,'a6000000-0000-4000-8000-000000000001',6101,6001,'2026-02-20',30,'pagato'),
  (6204,'a6000000-0000-4000-8000-000000000001',6102,6002,'2026-01-25',2,'pagato'),
  (6205,'a6000000-0000-4000-8000-000000000001',6104,NULL,'2026-01-26',25,'pagato'),
  (6206,'a6000000-0000-4000-8000-000000000001',6104,6004,'2026-01-27',999,'sospeso'),
  (6299,'b6000000-0000-4000-8000-000000000002',6199,6999,'2026-01-20',999,'pagato');

SET LOCAL ROLE authenticated;

DO $tests$
DECLARE
  v_value numeric;
  v_value_2 numeric;
  v_count integer;
  v_snapshot record;
  v_row record;
  v_json jsonb;
BEGIN
  PERFORM pg_temp.set_claim(
    'a6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001'
  );

  SELECT sum(v.sold_amount), sum(v.allocated_discount)
  INTO v_value, v_value_2
  FROM private.financial_live_plan_line_values_v1 v
  WHERE v.plan_id = 6001;
  PERFORM pg_temp.assert_num('100 EUR discount over 1000 EUR plan net', v_value, 900);
  PERFORM pg_temp.assert_num('100 EUR discount allocation', v_value_2, 100);

  SELECT sold_amount INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6001 AND source_line_id = '1';
  PERFORM pg_temp.assert_num('heterogeneous line A sold value', v_value, 90);
  SELECT sold_amount INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6001 AND source_line_id = '2';
  PERFORM pg_temp.assert_num('heterogeneous line B sold value', v_value, 810);

  SELECT sold_amount INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6002 AND source_line_id = '1';
  PERFORM pg_temp.assert_num('rounding ordinal 1', v_value, 0.67);
  SELECT sold_amount INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6002 AND source_line_id = '2';
  PERFORM pg_temp.assert_num('rounding ordinal 2', v_value, 0.67);
  SELECT sold_amount INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6002 AND source_line_id = '3';
  PERFORM pg_temp.assert_num('rounding ordinal 3', v_value, 0.66);

  SELECT count(*) INTO v_count
  FROM (
    SELECT plan_id
    FROM private.financial_live_plan_line_values_v1
    GROUP BY plan_id
    HAVING sum(sold_amount) IS DISTINCT FROM max(plan_net_total)
  ) broken;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL sold-line sum invariant'; END IF;

  SELECT sum(sold_amount) INTO v_value
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6003;
  PERFORM pg_temp.assert_num('zero total', v_value, 0);

  SELECT * INTO v_snapshot
  FROM public.get_financial_snapshot_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  );
  PERFORM pg_temp.assert_num('partial execution and January product', v_snapshot.prodotto, 182);
  PERFORM pg_temp.assert_num('positive paid cash only', v_snapshot.incassato, 117);
  PERFORM pg_temp.assert_text(
    'complete live quality',
    v_snapshot.data_quality_status,
    'LIVE_PRODOTTO_INCASSATO_COMPLETE_OTHER_LIFECYCLE_PARTIAL'
  );

  SELECT sum(amount) INTO v_value
  FROM public.get_financial_drilldown_v1(
    '2026-01-01', '2026-01-31', 'PRODOTTO',
    'a6000000-0000-4000-8000-000000000001'
  );
  PERFORM pg_temp.assert_num('snapshot equals Prodotto drilldown', v_value, v_snapshot.prodotto);
  SELECT sum(amount) INTO v_value
  FROM public.get_financial_drilldown_v1(
    '2026-01-01', '2026-01-31', 'INCASSATO',
    'a6000000-0000-4000-8000-000000000001'
  );
  PERFORM pg_temp.assert_num('snapshot equals Incassato drilldown', v_value, v_snapshot.incassato);

  SELECT prodotto INTO v_value
  FROM public.get_financial_snapshot_v1(
    '2026-01-01', '2026-12-31', 'a6000000-0000-4000-8000-000000000001'
  );
  SELECT jan.prodotto + feb.prodotto INTO v_value_2
  FROM public.get_financial_snapshot_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  ) jan
  CROSS JOIN public.get_financial_snapshot_v1(
    '2026-02-01', '2026-02-28', 'a6000000-0000-4000-8000-000000000001'
  ) feb;
  PERFORM pg_temp.assert_num('annual equals monthly product sum', v_value, v_value_2);

  SELECT * INTO v_row
  FROM public.get_prodotto_reconciliation_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  )
  WHERE group_kind = 'SUMMARY';
  PERFORM pg_temp.assert_num('reconciliation product', v_row.prodotto_periodo, 182);
  PERFORM pg_temp.assert_num('reconciliation cash', v_row.incassato_periodo, 117);
  PERFORM pg_temp.assert_num('timing gap, not debt', v_row.scostamento_periodo, 65);

  SELECT payment_rows INTO v_json
  FROM public.get_prodotto_reconciliation_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  )
  WHERE group_kind = 'PLAN' AND plan_id = 6001;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_json) row
    WHERE row ->> 'periodRelation' = 'AFTER'
  ) THEN
    RAISE EXCEPTION 'FAIL payment after selected period is not explained';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_json) row
    WHERE row ? 'sourceLineId'
  ) THEN
    RAISE EXCEPTION 'FAIL payment was allocated to an item';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_prodotto_reconciliation_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  )
  WHERE group_kind = 'UNALLOCATED'
    AND patient_id = 6104
    AND incassato_periodo = 25
    AND allocation_state = 'UNALLOCATED';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL unallocated patient payment'; END IF;

  -- Tenant B cannot be named by tenant A.
  BEGIN
    PERFORM *
    FROM public.get_prodotto_reconciliation_v1(
      '2026-01-01', '2026-01-31', 'b6000000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'FAIL cross-tenant reconciliation was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: access denied%' THEN RAISE; END IF;
  END;

  -- An active member without finance.management.read cannot use detail RPC.
  PERFORM pg_temp.set_claim(
    'c6000000-0000-4000-8000-000000000003',
    'a6000000-0000-4000-8000-000000000001'
  );
  BEGIN
    PERFORM *
    FROM public.get_prodotto_reconciliation_v1(
      '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'FAIL capability-less reconciliation was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: access denied%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM *
    FROM public.get_financial_snapshot_v1(
      '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'FAIL capability-less snapshot was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: access denied%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM *
    FROM public.get_financial_drilldown_v1(
      '2026-01-01', '2026-01-31', 'PRODOTTO',
      'a6000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'FAIL capability-less drilldown was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: access denied%' THEN RAISE; END IF;
  END;

  -- A stale tenant claim without active membership cannot query a known plan.
  PERFORM pg_temp.set_claim(
    'd6000000-0000-4000-8000-000000000004',
    'a6000000-0000-4000-8000-000000000001'
  );
  BEGIN
    PERFORM * FROM public.get_saldo_piano(6001);
    RAISE EXCEPTION 'FAIL non-member queried known plan balance';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: access denied%' THEN RAISE; END IF;
  END;

  -- Missing/stale JWT tenant context cannot turn RLS-hidden live rows into 0.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', 'a6000000-0000-4000-8000-000000000001',
      'role', 'authenticated',
      'app_metadata', '{}'::jsonb
    )::text,
    true
  );
  SELECT * INTO v_snapshot
  FROM public.get_financial_snapshot_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  );
  IF v_snapshot.prodotto IS NOT NULL OR v_snapshot.incassato IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL missing live tenant context returned false zero totals';
  END IF;
  BEGIN
    PERFORM *
    FROM public.get_financial_drilldown_v1(
      '2026-01-01', '2026-01-31', 'PRODOTTO',
      'a6000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'FAIL drilldown accepted missing live tenant context';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: live tenant context unavailable%' THEN RAISE; END IF;
  END;

END;
$tests$;

RESET ROLE;

-- Subsequent discount changes recalculate effective sold values while the
-- original/pre-discount line price remains untouched.
UPDATE public.plans SET sconto = 200 WHERE id = 6001;
SET LOCAL ROLE authenticated;
DO $discount_edit$
DECLARE
  v_original numeric;
  v_sold numeric;
BEGIN
  PERFORM pg_temp.set_claim(
    'a6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001'
  );
  SELECT original_amount_raw, sold_amount INTO v_original, v_sold
  FROM private.financial_live_plan_line_values_v1
  WHERE plan_id = 6001 AND source_line_id = '1';
  PERFORM pg_temp.assert_num('original agreed price retained', v_original, 100);
  PERFORM pg_temp.assert_num('discount edit recalculates sold line', v_sold, 80);
END;
$discount_edit$;

RESET ROLE;

-- Invalid legacy inputs fail closed rather than returning valid-row partials.
INSERT INTO public.plans(
  id, studio_id, paziente_id, data, created_at, titolo, voci, sconto, sconto_tipo
) VALUES (
  6005,
  'a6000000-0000-4000-8000-000000000001',
  6105,
  '2026-01-05',
  '2026-01-05T08:00:00Z',
  'Incomplete',
  '[{"prestazione":"Missing date","prezzo":50,"eseguita":true}]',
  0,
  'pct'
);
INSERT INTO public.payments(
  id, studio_id, paziente_id, piano_id, data, importo, stato
) VALUES (
  6207,
  'a6000000-0000-4000-8000-000000000001',
  6105,
  6005,
  '2026-01-28',
  10,
  'acconto'
);
INSERT INTO public.plans(
  id, studio_id, paziente_id, data, created_at, titolo, voci, sconto, sconto_tipo
) VALUES (
  6006,
  'a6000000-0000-4000-8000-000000000001',
  6106,
  '2026-01-06',
  '2026-01-06T08:00:00Z',
  'Invalid multi-month plan',
  '[
    {"prestazione":"January","prezzo":100,"eseguita":true,"dataEsec":"2026-01-29"},
    {"prestazione":"February","prezzo":"invalid","eseguita":true,"dataEsec":"2026-02-28"}
  ]',
  0,
  'pct'
);
INSERT INTO public.payments(
  id, studio_id, paziente_id, piano_id, data, importo, stato
) VALUES (
  6208,
  'a6000000-0000-4000-8000-000000000001',
  NULL,
  NULL,
  '2026-02-21',
  5,
  'pagato'
);
INSERT INTO public.payments(
  id, studio_id, paziente_id, piano_id, data, importo, stato
) VALUES (
  6209,
  'a6000000-0000-4000-8000-000000000001',
  9999,
  6001,
  '2026-02-22',
  10,
  'pagato'
);
SET LOCAL ROLE authenticated;
DO $incomplete$
DECLARE
  v_snapshot record;
  v_count integer;
BEGIN
  PERFORM pg_temp.set_claim(
    'a6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001'
  );
  SELECT * INTO v_snapshot
  FROM public.get_financial_snapshot_v1(
    '2026-01-01', '2026-01-31', 'a6000000-0000-4000-8000-000000000001'
  );
  IF v_snapshot.prodotto IS NOT NULL OR v_snapshot.incassato IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL incomplete legacy rows produced partial-looking totals';
  END IF;
  PERFORM pg_temp.assert_text(
    'incomplete quality status',
    v_snapshot.data_quality_status,
    'LIVE_PRODOTTO_INCASSATO_INCOMPLETE'
  );

  SELECT count(DISTINCT event_date) INTO v_count
  FROM private.financial_live_data_quality_v1
  WHERE source_table = 'plans'
    AND source_id = '6006'
    AND issue_code = 'PLAN_PRICE_INVALID';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL invalid multi-month plan did not block every execution period';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.get_financial_snapshot_v1(
    '2026-02-01', '2026-02-28', 'a6000000-0000-4000-8000-000000000001'
  );
  IF v_snapshot.prodotto IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL later invalid execution month returned partial Prodotto';
  END IF;
  PERFORM pg_temp.assert_num('cash without patient or valid plan link is retained', v_snapshot.incassato, 45);

  SELECT count(*) INTO v_count
  FROM public.get_financial_drilldown_v1(
    '2026-02-01', '2026-02-28', 'PRODOTTO',
    'a6000000-0000-4000-8000-000000000001'
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL direct Prodotto drilldown exposed valid-row partials';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_financial_drilldown_v1(
    '2026-02-01', '2026-02-28', 'MARGINE_CONTRIBUZIONE',
    'a6000000-0000-4000-8000-000000000001'
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL derived margin drilldown exposed cost-only partials';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_prodotto_reconciliation_v1(
    '2026-02-01', '2026-02-28', 'a6000000-0000-4000-8000-000000000001'
  )
  WHERE group_kind = 'UNALLOCATED'
    AND patient_id IS NULL
    AND incassato_periodo = 5;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL unidentified cash was not exposed as unallocated';
  END IF;

  SELECT * INTO v_snapshot FROM public.get_saldo_piano(6001);
  PERFORM pg_temp.assert_num(
    'mismatched patient payment does not reduce plan balance',
    v_snapshot.totale_pagato,
    120
  );

  BEGIN
    PERFORM *
    FROM public.get_saldi_aperti_studio('a6000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL invalid plan silently disappeared from open balances';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'POL-FIN-006: open balances unavailable%' THEN RAISE; END IF;
  END;
END;
$incomplete$;

RESET ROLE;

DO $security$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.get_prodotto_reconciliation_v1(date,date,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL anon reconciliation execute';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.get_prodotto_reconciliation_v1(date,date,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL authenticated reconciliation execute missing';
  END IF;
  IF has_table_privilege(
    'authenticated',
    'public.financial_line_events_v1',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'FAIL authenticated canonical direct write';
  END IF;
END;
$security$;

ROLLBACK;
