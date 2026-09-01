-- POL-FIN-006 — live Prodotto/Incassato and plan-level reconciliation.
-- Code-only migration: this file is not applied remotely by this session.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.plans') IS NULL OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plans'
      AND column_name IN ('id','studio_id','paziente_id','data','created_at','titolo','voci','sconto','sconto_tipo')
    GROUP BY table_schema, table_name
    HAVING count(*) = 9
  ) THEN
    RAISE EXCEPTION 'POL-FIN-006 preflight: required public.plans columns are missing';
  END IF;

  IF to_regclass('public.payments') IS NULL OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name IN ('id','studio_id','paziente_id','piano_id','data','importo','stato')
    GROUP BY table_schema, table_name
    HAVING count(*) = 7
  ) THEN
    RAISE EXCEPTION 'POL-FIN-006 preflight: required public.payments columns are missing';
  END IF;

  IF to_regprocedure('private.financial_verified_studio_membership_v1(uuid)') IS NULL
    OR to_regprocedure('private.financial_current_studio_v1()') IS NULL
    OR to_regprocedure('private.financial_has_tenant_access_v1(uuid)') IS NULL
    OR to_regprocedure('public.has_studio_capability_v1(uuid,text)') IS NULL
    OR to_regprocedure('public.get_financial_drilldown_v1(date,date,text,uuid)') IS NULL
    OR to_regprocedure('public.get_financial_snapshot_v1(date,date,uuid)') IS NULL
  THEN
    RAISE EXCEPTION 'POL-FIN-006 preflight: canonical finance/RBAC functions are missing';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION private.financial_try_iso_date_v1(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF p_value IS NULL OR p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::date;
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_prodotto_reconciliation_v1(
  p_data_inizio date,
  p_data_fine date,
  p_studio_id uuid
) RETURNS TABLE (
  group_kind text,
  group_key text,
  plan_id bigint,
  patient_id bigint,
  plan_title text,
  prodotto_periodo numeric,
  incassato_periodo numeric,
  scostamento_periodo numeric,
  prodotto_al_periodo numeric,
  incassato_al_periodo numeric,
  posizione_al_periodo numeric,
  allocation_state text,
  executed_items jsonb,
  payment_rows jsonb,
  quality_issues jsonb,
  data_quality_status text,
  formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_product_blocked boolean;
  v_product_cumulative_blocked boolean;
  v_cash_blocked boolean;
  v_cash_cumulative_blocked boolean;
  v_reconciliation_blocked boolean;
  v_quality_status text;
  v_quality_issues jsonb;
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio > p_data_fine THEN
    RAISE EXCEPTION 'POL-FIN-006: invalid period';
  END IF;
  IF p_studio_id IS NULL
    OR NOT private.financial_verified_studio_membership_v1(p_studio_id)
    OR NOT public.has_studio_capability_v1(p_studio_id, 'finance.management.read')
  THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;

  -- This RPC reads plans/payments under their existing RLS. A membership
  -- override must never turn a missing/stale JWT tenant into empty live data.
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') <> p_studio_id::text THEN
    RAISE EXCEPTION 'POL-FIN-006: live tenant context unavailable';
  END IF;

  PERFORM set_config('request.financial_studio_override_v1', p_studio_id::text, true);
  IF NOT private.financial_has_tenant_access_v1(p_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND q.blocking_metric = 'PRODOTTO'
      AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
  ) INTO v_product_blocked;

  SELECT EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND q.blocking_metric = 'PRODOTTO'
      AND (q.event_date IS NULL OR q.event_date <= p_data_fine)
  ) INTO v_product_cumulative_blocked;

  SELECT EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND q.blocking_metric = 'INCASSATO'
      AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
  ) INTO v_cash_blocked;

  SELECT EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND q.blocking_metric = 'INCASSATO'
      AND (q.event_date IS NULL OR q.event_date <= p_data_fine)
  ) INTO v_cash_cumulative_blocked;

  SELECT EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND q.blocking_metric = 'RECONCILIATION'
      AND (q.event_date IS NULL OR q.event_date <= p_data_fine)
  ) INTO v_reconciliation_blocked;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'metric', grouped.blocking_metric,
        'code', grouped.issue_code,
        'count', grouped.issue_count
      )
      ORDER BY grouped.blocking_metric, grouped.issue_code
    ),
    '[]'::jsonb
  )
  INTO v_quality_issues
  FROM (
    SELECT q.blocking_metric, q.issue_code, count(*) AS issue_count
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = p_studio_id
      AND (q.event_date IS NULL OR q.event_date <= p_data_fine)
    GROUP BY q.blocking_metric, q.issue_code
  ) grouped;

  v_quality_status := CASE
    WHEN v_product_blocked AND v_cash_blocked THEN 'LIVE_PRODOTTO_INCASSATO_INCOMPLETE'
    WHEN v_product_blocked THEN 'LIVE_PRODOTTO_INCOMPLETE'
    WHEN v_cash_blocked THEN 'LIVE_INCASSATO_INCOMPLETE'
    WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked OR v_reconciliation_blocked THEN 'LIVE_KPI_COMPLETE_RECONCILIATION_INCOMPLETE'
    ELSE 'LIVE_PRODOTTO_INCASSATO_COMPLETE'
  END;

  RETURN QUERY
  WITH totals AS (
    SELECT
      COALESCE((
        SELECT sum(d.amount)
        FROM public.get_financial_drilldown_v1(
          p_data_inizio, p_data_fine, 'PRODOTTO', p_studio_id
        ) d
      ), 0) AS prodotto_periodo,
      COALESCE((
        SELECT sum(d.amount)
        FROM public.get_financial_drilldown_v1(
          DATE '0001-01-01', p_data_fine, 'PRODOTTO', p_studio_id
        ) d
      ), 0) AS prodotto_al_periodo
  ),
  cash AS (
    SELECT
      COALESCE((
        SELECT sum(d.amount)
        FROM public.get_financial_drilldown_v1(
          p_data_inizio, p_data_fine, 'INCASSATO', p_studio_id
        ) d
      ), 0) AS incassato_periodo,
      COALESCE((
        SELECT sum(d.amount)
        FROM public.get_financial_drilldown_v1(
          DATE '0001-01-01', p_data_fine, 'INCASSATO', p_studio_id
        ) d
      ), 0) AS incassato_al_periodo
  )
  SELECT
    'SUMMARY'::text,
    'summary'::text,
    NULL::bigint,
    NULL::bigint,
    NULL::text,
    CASE WHEN v_product_blocked THEN NULL ELSE totals.prodotto_periodo END,
    CASE WHEN v_cash_blocked THEN NULL ELSE cash.incassato_periodo END,
    CASE
      WHEN v_product_blocked OR v_cash_blocked THEN NULL
      ELSE totals.prodotto_periodo - cash.incassato_periodo
    END,
    CASE WHEN v_product_cumulative_blocked THEN NULL ELSE totals.prodotto_al_periodo END,
    CASE WHEN v_cash_cumulative_blocked THEN NULL ELSE cash.incassato_al_periodo END,
    CASE
      WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked THEN NULL
      ELSE totals.prodotto_al_periodo - cash.incassato_al_periodo
    END,
    'PERIOD_TIMING_GAP'::text,
    '[]'::jsonb,
    '[]'::jsonb,
    v_quality_issues,
    v_quality_status,
    'POL-FIN-006-v1'
  FROM totals CROSS JOIN cash;

  RETURN QUERY
  WITH valid_linked_payments AS (
    SELECT pay.*
    FROM private.financial_live_payment_values_v1 pay
    JOIN public.plans p
      ON p.id = pay.plan_id
      AND p.studio_id = pay.studio_id
      AND p.paziente_id = pay.patient_id
    WHERE pay.studio_id = p_studio_id
  ),
  plan_keys AS (
    SELECT DISTINCT v.plan_id
    FROM private.financial_live_plan_line_values_v1 v
    WHERE v.studio_id = p_studio_id
      AND v.executed
      AND v.execution_date BETWEEN p_data_inizio AND p_data_fine
    UNION
    SELECT DISTINCT p.plan_id
    FROM valid_linked_payments p
    WHERE p.event_date BETWEEN p_data_inizio AND p_data_fine
  ),
  plan_rollup AS (
    SELECT
      p.id AS plan_id,
      p.paziente_id AS patient_id,
      p.titolo AS plan_title,
      COALESCE((
        SELECT sum(v.sold_amount)
        FROM private.financial_live_plan_line_values_v1 v
        WHERE v.studio_id = p_studio_id
          AND v.plan_id = p.id
          AND v.executed
          AND v.execution_date BETWEEN p_data_inizio AND p_data_fine
      ), 0) AS prodotto_periodo,
      COALESCE((
        SELECT sum(pay.amount)
        FROM valid_linked_payments pay
        WHERE pay.plan_id = p.id
          AND pay.event_date BETWEEN p_data_inizio AND p_data_fine
      ), 0) AS incassato_periodo,
      COALESCE((
        SELECT sum(v.sold_amount)
        FROM private.financial_live_plan_line_values_v1 v
        WHERE v.studio_id = p_studio_id
          AND v.plan_id = p.id
          AND v.executed
          AND v.execution_date <= p_data_fine
      ), 0) AS prodotto_al_periodo,
      COALESCE((
        SELECT sum(pay.amount)
        FROM valid_linked_payments pay
        WHERE pay.plan_id = p.id
          AND pay.event_date <= p_data_fine
      ), 0) AS incassato_al_periodo,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'sourceLineId', v.source_line_id,
            'prestazione', v.service_ref,
            'dente', v.tooth_ref,
            'executionDate', v.execution_date,
            'originalAmount', v.original_amount,
            'originalAmountRaw', v.original_amount_raw,
            'allocatedDiscount', v.allocated_discount,
            'soldAmount', v.sold_amount,
            'periodRelation', CASE
              WHEN v.execution_date < p_data_inizio THEN 'BEFORE'
              WHEN v.execution_date > p_data_fine THEN 'AFTER'
              ELSE 'IN'
            END
          )
          ORDER BY v.execution_date, v.line_ordinal
        )
        FROM private.financial_live_plan_line_values_v1 v
        WHERE v.studio_id = p_studio_id
          AND v.plan_id = p.id
          AND v.executed
      ), '[]'::jsonb) AS executed_items,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', pay.payment_id,
            'paymentDate', pay.event_date,
            'amount', pay.amount,
            'periodRelation', CASE
              WHEN pay.event_date < p_data_inizio THEN 'BEFORE'
              WHEN pay.event_date > p_data_fine THEN 'AFTER'
              ELSE 'IN'
            END,
            'linkage', 'PLAN'
          )
          ORDER BY pay.event_date, pay.payment_id
        )
        FROM valid_linked_payments pay
        WHERE pay.plan_id = p.id
      ), '[]'::jsonb) AS payment_rows
    FROM public.plans p
    JOIN plan_keys keys ON keys.plan_id = p.id
    WHERE p.studio_id = p_studio_id
  )
  SELECT
    'PLAN'::text,
    'plan:' || r.plan_id::text,
    r.plan_id,
    r.patient_id,
    r.plan_title,
    CASE WHEN v_product_blocked THEN NULL ELSE r.prodotto_periodo END,
    CASE WHEN v_cash_blocked THEN NULL ELSE r.incassato_periodo END,
    CASE
      WHEN v_product_blocked OR v_cash_blocked THEN NULL
      ELSE r.prodotto_periodo - r.incassato_periodo
    END,
    CASE WHEN v_product_cumulative_blocked THEN NULL ELSE r.prodotto_al_periodo END,
    CASE WHEN v_cash_cumulative_blocked THEN NULL ELSE r.incassato_al_periodo END,
    CASE
      WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked THEN NULL
      ELSE r.prodotto_al_periodo - r.incassato_al_periodo
    END,
    CASE
      WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked THEN 'INCOMPLETE'
      WHEN r.prodotto_al_periodo - r.incassato_al_periodo > 0 THEN 'RESIDUAL'
      WHEN r.prodotto_al_periodo - r.incassato_al_periodo < 0 THEN 'OVERCOLLECTED'
      ELSE 'RECONCILED'
    END,
    r.executed_items,
    r.payment_rows,
    '[]'::jsonb,
    v_quality_status,
    'POL-FIN-006-v1'
  FROM plan_rollup r
  ORDER BY r.patient_id, r.plan_id;

  -- Preserve reconciliation if future canonical producers add explicit
  -- reversals/refunds or other non-legacy events.
  RETURN QUERY
  WITH canonical_product AS (
    SELECT
      v.patient_id,
      e.source_id,
      e.source_line_id,
      e.event_date,
      v.net_amount * e.fraction * e.direction AS amount
    FROM public.financial_line_events_v1 e
    JOIN private.financial_line_values_v1 v
      ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
    WHERE e.studio_id = p_studio_id
      AND e.stage = 'PRODOTTO'
      AND e.source_table <> 'plans'
  ),
  canonical_cash AS (
    SELECT
      e.patient_id,
      e.source_id,
      e.event_date,
      e.amount * e.direction AS amount
    FROM public.financial_payment_events_v1 e
    WHERE e.studio_id = p_studio_id
      AND e.source_table <> 'payments'
      AND (e.event_kind <> 'EXTERNAL_PAYMENT' OR e.reconciled)
  ),
  patient_keys AS (
    SELECT DISTINCT p.patient_id
    FROM canonical_product p
    WHERE p.event_date BETWEEN p_data_inizio AND p_data_fine
    UNION
    SELECT DISTINCT c.patient_id
    FROM canonical_cash c
    WHERE c.event_date BETWEEN p_data_inizio AND p_data_fine
  ),
  canonical_rollup AS (
    SELECT
      keys.patient_id,
      COALESCE((
        SELECT sum(p.amount)
        FROM canonical_product p
        WHERE p.patient_id IS NOT DISTINCT FROM keys.patient_id
          AND p.event_date BETWEEN p_data_inizio AND p_data_fine
      ), 0) AS prodotto_periodo,
      COALESCE((
        SELECT sum(c.amount)
        FROM canonical_cash c
        WHERE c.patient_id IS NOT DISTINCT FROM keys.patient_id
          AND c.event_date BETWEEN p_data_inizio AND p_data_fine
      ), 0) AS incassato_periodo,
      COALESCE((
        SELECT sum(p.amount)
        FROM canonical_product p
        WHERE p.patient_id IS NOT DISTINCT FROM keys.patient_id
          AND p.event_date <= p_data_fine
      ), 0) AS prodotto_al_periodo,
      COALESCE((
        SELECT sum(c.amount)
        FROM canonical_cash c
        WHERE c.patient_id IS NOT DISTINCT FROM keys.patient_id
          AND c.event_date <= p_data_fine
      ), 0) AS incassato_al_periodo,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'sourceLineId', COALESCE(p.source_line_id, p.source_id),
            'prestazione', 'Evento prodotto canonico',
            'executionDate', p.event_date,
            'originalAmount', NULL,
            'originalAmountRaw', NULL,
            'allocatedDiscount', 0,
            'soldAmount', p.amount,
            'periodRelation', CASE
              WHEN p.event_date < p_data_inizio THEN 'BEFORE'
              WHEN p.event_date > p_data_fine THEN 'AFTER'
              ELSE 'IN'
            END
          )
          ORDER BY p.event_date, p.source_id
        )
        FROM canonical_product p
        WHERE p.patient_id IS NOT DISTINCT FROM keys.patient_id
      ), '[]'::jsonb) AS executed_items,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', c.source_id,
            'paymentDate', c.event_date,
            'amount', c.amount,
            'periodRelation', CASE
              WHEN c.event_date < p_data_inizio THEN 'BEFORE'
              WHEN c.event_date > p_data_fine THEN 'AFTER'
              ELSE 'IN'
            END,
            'linkage', 'CANONICAL_EVENT'
          )
          ORDER BY c.event_date, c.source_id
        )
        FROM canonical_cash c
        WHERE c.patient_id IS NOT DISTINCT FROM keys.patient_id
      ), '[]'::jsonb) AS payment_rows
    FROM patient_keys keys
  )
  SELECT
    'CANONICAL'::text,
    'patient:' || COALESCE(r.patient_id::text, 'unknown') || ':canonical',
    NULL::bigint,
    r.patient_id,
    'Altri eventi canonici'::text,
    CASE WHEN v_product_blocked THEN NULL ELSE r.prodotto_periodo END,
    CASE WHEN v_cash_blocked THEN NULL ELSE r.incassato_periodo END,
    CASE
      WHEN v_product_blocked OR v_cash_blocked THEN NULL
      ELSE r.prodotto_periodo - r.incassato_periodo
    END,
    CASE WHEN v_product_cumulative_blocked THEN NULL ELSE r.prodotto_al_periodo END,
    CASE WHEN v_cash_cumulative_blocked THEN NULL ELSE r.incassato_al_periodo END,
    CASE
      WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked THEN NULL
      ELSE r.prodotto_al_periodo - r.incassato_al_periodo
    END,
    CASE
      WHEN v_product_cumulative_blocked OR v_cash_cumulative_blocked THEN 'INCOMPLETE'
      WHEN r.prodotto_al_periodo - r.incassato_al_periodo > 0 THEN 'RESIDUAL'
      WHEN r.prodotto_al_periodo - r.incassato_al_periodo < 0 THEN 'OVERCOLLECTED'
      ELSE 'RECONCILED'
    END,
    r.executed_items,
    r.payment_rows,
    '[]'::jsonb,
    v_quality_status,
    'POL-FIN-006-v1'
  FROM canonical_rollup r
  ORDER BY r.patient_id;

  RETURN QUERY
  WITH valid_unallocated AS (
    SELECT pay.*
    FROM private.financial_live_payment_values_v1 pay
    LEFT JOIN public.plans p
      ON p.id = pay.plan_id
      AND p.studio_id = pay.studio_id
      AND p.paziente_id = pay.patient_id
    WHERE pay.studio_id = p_studio_id
      AND (pay.plan_id IS NULL OR p.id IS NULL)
  ),
  patient_keys AS (
    SELECT DISTINCT pay.patient_id
    FROM valid_unallocated pay
    WHERE pay.event_date BETWEEN p_data_inizio AND p_data_fine
  )
  SELECT
    'UNALLOCATED'::text,
    'patient:' || COALESCE(keys.patient_id::text, 'unknown') || ':unallocated',
    NULL::bigint,
    keys.patient_id,
    NULL::text,
    CASE WHEN v_product_blocked THEN NULL ELSE 0::numeric END,
    CASE WHEN v_cash_blocked THEN NULL ELSE COALESCE(sum(pay.amount) FILTER (
      WHERE pay.event_date BETWEEN p_data_inizio AND p_data_fine
    ), 0) END,
    CASE
      WHEN v_product_blocked OR v_cash_blocked THEN NULL
      ELSE -COALESCE(sum(pay.amount) FILTER (
        WHERE pay.event_date BETWEEN p_data_inizio AND p_data_fine
      ), 0)
    END,
    CASE WHEN v_product_blocked THEN NULL ELSE 0::numeric END,
    CASE WHEN v_cash_blocked THEN NULL ELSE COALESCE(sum(pay.amount) FILTER (
      WHERE pay.event_date <= p_data_fine
    ), 0) END,
    CASE
      WHEN v_product_blocked OR v_cash_blocked THEN NULL
      ELSE -COALESCE(sum(pay.amount) FILTER (WHERE pay.event_date <= p_data_fine), 0)
    END,
    'UNALLOCATED'::text,
    '[]'::jsonb,
    jsonb_agg(
      jsonb_build_object(
        'paymentId', pay.payment_id,
        'paymentDate', pay.event_date,
        'amount', pay.amount,
        'periodRelation', CASE
          WHEN pay.event_date < p_data_inizio THEN 'BEFORE'
          WHEN pay.event_date > p_data_fine THEN 'AFTER'
          ELSE 'IN'
        END,
        'linkage', 'PATIENT_UNALLOCATED'
      )
      ORDER BY pay.event_date, pay.payment_id
    ),
    '[]'::jsonb,
    v_quality_status,
    'POL-FIN-006-v1'
  FROM patient_keys keys
  JOIN valid_unallocated pay ON pay.patient_id IS NOT DISTINCT FROM keys.patient_id
  GROUP BY keys.patient_id
  ORDER BY keys.patient_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financial_snapshot_v1(
  p_data_inizio date,
  p_data_fine date,
  p_studio_id uuid DEFAULT NULL
) RETURNS TABLE (
  preventivato numeric,
  preventivato_lordo numeric,
  sconto numeric,
  accettato numeric,
  prodotto numeric,
  fatturato_netto_iva numeric,
  fatturato_iva numeric,
  fatturato_lordo numeric,
  incassato numeric,
  incassato_allocato numeric,
  portafoglio_da_eseguire numeric,
  prodotto_da_fatturare numeric,
  credito_clienti numeric,
  saldo_incassi_non_allocato numeric,
  portafoglio_da_eseguire_apertura numeric,
  portafoglio_da_eseguire_movimenti numeric,
  portafoglio_da_eseguire_chiusura numeric,
  prodotto_da_fatturare_apertura numeric,
  prodotto_da_fatturare_movimenti numeric,
  prodotto_da_fatturare_chiusura numeric,
  credito_clienti_apertura numeric,
  credito_clienti_movimenti numeric,
  credito_clienti_chiusura numeric,
  saldo_incassi_non_allocato_apertura numeric,
  saldo_incassi_non_allocato_movimenti numeric,
  saldo_incassi_non_allocato_chiusura numeric,
  costi_previsti numeric,
  costi_impegnati numeric,
  costi_fissi_operativi numeric,
  costi_variabili numeric,
  margine_contribuzione numeric,
  margine_contribuzione_pct numeric,
  ebitda_operativo_gestionale numeric,
  break_even numeric,
  break_even_raggiunto boolean,
  ore_produttive_disponibili numeric,
  ore_effettivamente_lavorate numeric,
  costo_orario_struttura numeric,
  produzione_ora numeric,
  incasso_ora numeric,
  data_quality_status text,
  formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_studio_id uuid;
  v_preventivato numeric;
  v_lordo numeric;
  v_sconto numeric;
  v_accettato numeric;
  v_prodotto numeric;
  v_fatt_net numeric;
  v_fatt_iva numeric;
  v_fatt_lordo numeric;
  v_incassato numeric;
  v_allocato numeric;
  v_portafoglio numeric;
  v_da_fatturare numeric;
  v_credito numeric;
  v_non_allocato numeric;
  v_portafoglio_apertura numeric;
  v_portafoglio_movimenti numeric;
  v_da_fatturare_apertura numeric;
  v_da_fatturare_movimenti numeric;
  v_credito_apertura numeric;
  v_credito_movimenti numeric;
  v_non_allocato_apertura numeric;
  v_non_allocato_movimenti numeric;
  v_previsti numeric;
  v_impegnati numeric;
  v_fissi numeric;
  v_variabili numeric;
  v_margine numeric;
  v_ebitda numeric;
  v_costi_struttura numeric;
  v_ore_disponibili numeric;
  v_ore_effettive numeric;
  v_product_blocked boolean := false;
  v_cash_blocked boolean := false;
  v_reconciliation_blocked boolean := false;
  v_live_context_ready boolean := false;
  v_quality_status text;
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio > p_data_fine THEN
    RAISE EXCEPTION 'POL-FIN-006: invalid period';
  END IF;

  IF p_studio_id IS NOT NULL THEN
    IF NOT private.financial_verified_studio_membership_v1(p_studio_id) THEN
      RAISE EXCEPTION 'POL-FIN-006: access denied';
    END IF;
    PERFORM set_config('request.financial_studio_override_v1', p_studio_id::text, true);
  ELSE
    PERFORM set_config('request.financial_studio_override_v1', '', true);
  END IF;

  v_studio_id := private.financial_current_studio_v1();
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;
  IF NOT public.has_studio_capability_v1(v_studio_id, 'finance.management.read') THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;

  -- plans/payments RLS is JWT-studio scoped. If the explicit RPC studio is
  -- not the same live source context, never turn invisible rows into a zero.
  v_live_context_ready :=
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') = v_studio_id::text;

  IF v_live_context_ready THEN
    SELECT EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'PRODOTTO'
        AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
    ) INTO v_product_blocked;

    SELECT EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'INCASSATO'
        AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
    ) INTO v_cash_blocked;

    SELECT EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'RECONCILIATION'
        AND (q.event_date IS NULL OR q.event_date <= p_data_fine)
    ) INTO v_reconciliation_blocked;
  ELSE
    v_product_blocked := true;
    v_cash_blocked := true;
    v_reconciliation_blocked := true;
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_preventivato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PREVENTIVATO', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_lordo
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PREVENTIVATO_LORDO', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_sconto
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'SCONTO', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_accettato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ACCETTATO', v_studio_id);
  IF v_live_context_ready THEN
    SELECT COALESCE(sum(amount), 0) INTO v_prodotto
    FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PRODOTTO', v_studio_id);
  ELSE
    v_prodotto := 0;
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_fatt_net
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'FATTURATO_NETTO_IVA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_fatt_iva
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'FATTURATO_IVA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_fatt_lordo
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'FATTURATO_LORDO', v_studio_id);
  IF v_live_context_ready THEN
    SELECT COALESCE(sum(amount), 0) INTO v_incassato
    FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'INCASSATO', v_studio_id);
  ELSE
    v_incassato := 0;
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_allocato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'INCASSATO_ALLOCATO', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_portafoglio_apertura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PORTAFOGLIO_DA_ESEGUIRE_APERTURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_portafoglio_movimenti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PORTAFOGLIO_DA_ESEGUIRE_MOVIMENTI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_portafoglio
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PORTAFOGLIO_DA_ESEGUIRE_CHIUSURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_da_fatturare_apertura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PRODOTTO_DA_FATTURARE_APERTURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_da_fatturare_movimenti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PRODOTTO_DA_FATTURARE_MOVIMENTI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_da_fatturare
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PRODOTTO_DA_FATTURARE_CHIUSURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_credito_apertura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'CREDITO_CLIENTI_APERTURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_credito_movimenti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'CREDITO_CLIENTI_MOVIMENTI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_credito
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'CREDITO_CLIENTI_CHIUSURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_non_allocato_apertura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'SALDO_INCASSI_NON_ALLOCATO_APERTURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_non_allocato_movimenti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'SALDO_INCASSI_NON_ALLOCATO_MOVIMENTI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_non_allocato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'SALDO_INCASSI_NON_ALLOCATO_CHIUSURA', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_previsti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_PREVISTI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_impegnati
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_IMPEGNATI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_fissi
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_FISSI_OPERATIVI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_variabili
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_VARIABILI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_costi_struttura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_STRUTTURA_OPERATIVI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_ore_disponibili
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ORE_DISPONIBILI', v_studio_id);
  SELECT COALESCE(sum(amount), 0) INTO v_ore_effettive
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ORE_EFFETTIVE', v_studio_id);

  IF v_product_blocked THEN
    v_prodotto := NULL;
    v_margine := NULL;
    v_ebitda := NULL;
  ELSE
    v_margine := v_prodotto - v_variabili;
    v_ebitda := v_margine - v_fissi;
  END IF;

  IF v_cash_blocked THEN
    v_incassato := NULL;
  END IF;

  v_quality_status := CASE
    WHEN v_product_blocked AND v_cash_blocked THEN 'LIVE_PRODOTTO_INCASSATO_INCOMPLETE'
    WHEN v_product_blocked THEN 'LIVE_PRODOTTO_INCOMPLETE'
    WHEN v_cash_blocked THEN 'LIVE_INCASSATO_INCOMPLETE'
    WHEN v_reconciliation_blocked THEN 'LIVE_KPI_COMPLETE_RECONCILIATION_INCOMPLETE'
    ELSE 'LIVE_PRODOTTO_INCASSATO_COMPLETE_OTHER_LIFECYCLE_PARTIAL'
  END;

  RETURN QUERY
  SELECT
    v_preventivato,
    v_lordo,
    v_sconto,
    v_accettato,
    v_prodotto,
    v_fatt_net,
    v_fatt_iva,
    v_fatt_lordo,
    v_incassato,
    v_allocato,
    v_portafoglio,
    v_da_fatturare,
    v_credito,
    v_non_allocato,
    v_portafoglio_apertura,
    v_portafoglio_movimenti,
    v_portafoglio,
    v_da_fatturare_apertura,
    v_da_fatturare_movimenti,
    v_da_fatturare,
    v_credito_apertura,
    v_credito_movimenti,
    v_credito,
    v_non_allocato_apertura,
    v_non_allocato_movimenti,
    v_non_allocato,
    v_previsti,
    v_impegnati,
    v_fissi,
    v_variabili,
    v_margine,
    CASE WHEN v_prodotto IS NULL OR v_prodotto = 0 THEN NULL ELSE v_margine / v_prodotto * 100 END,
    v_ebitda,
    CASE
      WHEN v_prodotto > 0 AND v_margine > 0 THEN v_fissi / (v_margine / v_prodotto)
      ELSE NULL
    END,
    CASE
      WHEN v_prodotto > 0 AND v_margine > 0 THEN v_prodotto >= v_fissi / (v_margine / v_prodotto)
      ELSE NULL
    END,
    v_ore_disponibili,
    v_ore_effettive,
    CASE WHEN v_ore_disponibili = 0 THEN NULL ELSE v_costi_struttura / v_ore_disponibili END,
    CASE WHEN v_prodotto IS NULL OR v_ore_effettive = 0 THEN NULL ELSE v_prodotto / v_ore_effettive END,
    CASE WHEN v_incassato IS NULL OR v_ore_effettive = 0 THEN NULL ELSE v_incassato / v_ore_effettive END,
    v_quality_status,
    'POL-FIN-006-v1';
END;
$function$;

REVOKE ALL ON FUNCTION private.financial_try_iso_date_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.financial_try_iso_date_v1(text) TO authenticated;

-- Canonical plan-line calculation. Values are allocated in cents so every
-- line sum equals the plan net exactly. Largest fractional remainder wins;
-- JSON ordinality is the deterministic tie-break.
CREATE OR REPLACE VIEW private.financial_live_plan_line_values_v1
WITH (security_invoker = true)
AS
WITH expanded AS (
  SELECT
    p.id AS plan_id,
    p.studio_id,
    p.paziente_id AS patient_id,
    p.data AS plan_date,
    p.created_at,
    p.titolo AS plan_title,
    COALESCE(p.sconto, 0) AS discount_value,
    lower(COALESCE(p.sconto_tipo, '')) AS discount_kind,
    line.item,
    line.ordinality::bigint AS line_ordinal,
    COALESCE(line.item ->> 'prezzo', '') ~ '^[0-9]+([.][0-9]+)?$' AS price_valid
  FROM public.plans p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.voci) = 'array' THEN p.voci ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS line(item, ordinality)
),
parsed AS (
  SELECT
    e.*,
    CASE WHEN e.price_valid THEN (e.item ->> 'prezzo')::numeric END AS original_amount_raw,
    CASE WHEN e.price_valid THEN round((e.item ->> 'prezzo')::numeric * 100)::bigint END AS original_cents,
    lower(COALESCE(e.item ->> 'eseguita', 'false')) = 'true' AS executed,
    private.financial_try_iso_date_v1(e.item ->> 'dataEsec') AS execution_date
  FROM expanded e
),
plan_totals AS (
  SELECT
    plan_id,
    studio_id,
    patient_id,
    plan_date,
    created_at,
    plan_title,
    discount_value,
    discount_kind,
    sum(original_cents)::bigint AS original_total_cents
  FROM parsed
  GROUP BY plan_id, studio_id, patient_id, plan_date, created_at, plan_title, discount_value, discount_kind
  HAVING bool_and(price_valid)
    AND discount_value >= 0
    AND (
      discount_value = 0
      OR discount_kind IN ('pct','percent','fixed','fisso','eur')
    )
    AND (
      discount_kind NOT IN ('pct','percent')
      OR discount_value <= 100
    )
),
net_totals AS (
  SELECT
    t.*,
    CASE
      WHEN original_total_cents = 0 THEN 0::bigint
      WHEN discount_value = 0 THEN original_total_cents
      WHEN discount_kind IN ('pct','percent') THEN
        original_total_cents - LEAST(
          original_total_cents,
          GREATEST(0::bigint, round(original_total_cents::numeric * discount_value / 100)::bigint)
        )
      ELSE
        original_total_cents - LEAST(
          original_total_cents,
          GREATEST(0::bigint, round(discount_value * 100)::bigint)
        )
    END AS net_total_cents
  FROM plan_totals t
),
shares AS (
  SELECT
    p.*,
    n.original_total_cents,
    n.net_total_cents,
    CASE
      WHEN n.original_total_cents = 0 THEN 0::numeric
      ELSE p.original_cents::numeric * n.net_total_cents::numeric / n.original_total_cents::numeric
    END AS ideal_sold_cents
  FROM parsed p
  JOIN net_totals n
    ON n.plan_id = p.plan_id AND n.studio_id = p.studio_id
),
ranked AS (
  SELECT
    s.*,
    floor(s.ideal_sold_cents)::bigint AS base_sold_cents,
    row_number() OVER (
      PARTITION BY s.studio_id, s.plan_id
      ORDER BY
        (s.ideal_sold_cents - floor(s.ideal_sold_cents)) DESC,
        s.line_ordinal ASC
    ) AS remainder_rank
  FROM shares s
),
allocated AS (
  SELECT
    r.*,
    r.net_total_cents
      - sum(r.base_sold_cents) OVER (PARTITION BY r.studio_id, r.plan_id) AS residual_cents
  FROM ranked r
)
SELECT
  plan_id,
  studio_id,
  patient_id,
  plan_date,
  created_at,
  plan_title,
  line_ordinal,
  line_ordinal::text AS source_line_id,
  NULLIF(item ->> 'prestazione', '') AS service_ref,
  NULLIF(item ->> 'dente', '') AS tooth_ref,
  original_amount_raw,
  original_cents::numeric / 100 AS original_amount,
  original_total_cents::numeric / 100 AS plan_original_total,
  net_total_cents::numeric / 100 AS plan_net_total,
  (
    base_sold_cents
    + CASE WHEN remainder_rank <= residual_cents THEN 1 ELSE 0 END
  )::numeric / 100 AS sold_amount,
  (
    original_cents
    - base_sold_cents
    - CASE WHEN remainder_rank <= residual_cents THEN 1 ELSE 0 END
  )::numeric / 100 AS allocated_discount,
  executed,
  execution_date
FROM allocated;

CREATE OR REPLACE VIEW private.financial_live_payment_values_v1
WITH (security_invoker = true)
AS
SELECT
  p.id AS payment_id,
  p.studio_id,
  p.paziente_id AS patient_id,
  p.piano_id AS plan_id,
  p.data AS event_date,
  p.importo AS original_amount_raw,
  round(p.importo * 100)::numeric / 100 AS amount
FROM public.payments p
WHERE lower(COALESCE(p.stato, '')) = 'pagato'
  AND p.importo > 0
  AND p.data IS NOT NULL;

-- One row per blocking or reconciliation issue. These rows contain ids only,
-- never patient names or clinical content.
CREATE OR REPLACE VIEW private.financial_live_data_quality_v1
WITH (security_invoker = true)
AS
WITH plan_lines AS (
  SELECT
    p.id AS plan_id,
    p.studio_id,
    p.paziente_id AS patient_id,
    COALESCE(p.sconto, 0) AS discount_value,
    lower(COALESCE(p.sconto_tipo, '')) AS discount_kind,
    COALESCE(jsonb_typeof(p.voci) = 'array', false) AS voci_valid,
    line.item,
    line.ordinality::bigint AS line_ordinal,
    lower(COALESCE(line.item ->> 'eseguita', 'false')) = 'true' AS executed,
    private.financial_try_iso_date_v1(line.item ->> 'dataEsec') AS execution_date,
    COALESCE(line.item ->> 'prezzo', '') ~ '^[0-9]+([.][0-9]+)?$' AS price_valid
  FROM public.plans p
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.voci) = 'array' THEN p.voci ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS line(item, ordinality) ON true
),
plan_eval AS (
  SELECT
    plan_id,
    studio_id,
    patient_id,
    discount_value,
    discount_kind,
    bool_and(voci_valid) AS voci_valid,
    bool_or(executed) AS has_executed,
    bool_and(COALESCE(price_valid, true)) AS prices_valid
  FROM plan_lines
  GROUP BY plan_id, studio_id, patient_id, discount_value, discount_kind
)
SELECT
  'PRODOTTO'::text AS blocking_metric,
  e.studio_id,
  'plans'::text AS source_table,
  e.plan_id::text AS source_id,
  NULL::text AS source_line_id,
  e.patient_id,
  NULL::date AS event_date,
  'PLAN_VOCI_NOT_ARRAY'::text AS issue_code
FROM plan_eval e
WHERE NOT e.voci_valid
UNION ALL
SELECT
  'PLAN_BALANCE',
  e.studio_id,
  'plans',
  e.plan_id::text,
  NULL::text,
  e.patient_id,
  NULL::date,
  CASE
    WHEN NOT e.voci_valid THEN 'PLAN_VOCI_NOT_ARRAY'
    WHEN NOT e.prices_valid THEN 'PLAN_PRICE_INVALID'
    ELSE 'PLAN_DISCOUNT_INVALID'
  END
FROM plan_eval e
WHERE NOT e.voci_valid
  OR NOT e.prices_valid
  OR e.discount_value < 0
  OR (e.discount_value <> 0 AND e.discount_kind NOT IN ('pct','percent','fixed','fisso','eur'))
  OR (e.discount_kind IN ('pct','percent') AND e.discount_value > 100)
UNION ALL
SELECT
  'PRODOTTO',
  e.studio_id,
  'plans',
  e.plan_id::text,
  l.line_ordinal::text,
  e.patient_id,
  l.execution_date,
  CASE
    WHEN NOT e.prices_valid THEN 'PLAN_PRICE_INVALID'
    WHEN e.patient_id IS NULL THEN 'PLAN_PATIENT_MISSING'
    ELSE 'PLAN_DISCOUNT_INVALID'
  END
FROM plan_eval e
JOIN plan_lines l
  ON l.plan_id = e.plan_id AND l.studio_id = e.studio_id
WHERE e.has_executed
  AND l.executed
  AND (
    NOT e.prices_valid
    OR e.patient_id IS NULL
    OR e.discount_value < 0
    OR (e.discount_value <> 0 AND e.discount_kind NOT IN ('pct','percent','fixed','fisso','eur'))
    OR (e.discount_kind IN ('pct','percent') AND e.discount_value > 100)
  )
UNION ALL
SELECT
  'PRODOTTO',
  l.studio_id,
  'plans',
  l.plan_id::text,
  l.line_ordinal::text,
  l.patient_id,
  NULL::date,
  'EXECUTION_DATE_INVALID'
FROM plan_lines l
WHERE l.executed AND l.execution_date IS NULL
UNION ALL
SELECT
  'INCASSATO',
  p.studio_id,
  'payments',
  p.id::text,
  NULL::text,
  p.paziente_id,
  p.data,
  CASE
    WHEN lower(COALESCE(p.stato, '')) NOT IN ('pagato','sospeso') THEN 'PAYMENT_STATUS_AMBIGUOUS'
    WHEN p.importo IS NULL OR p.importo <= 0 THEN 'PAYMENT_AMOUNT_INVALID'
    ELSE 'PAYMENT_DATE_INVALID'
  END
FROM public.payments p
WHERE
  (
    lower(COALESCE(p.stato, '')) NOT IN ('pagato','sospeso')
    AND COALESCE(p.importo, 0) <> 0
  )
  OR (
    lower(COALESCE(p.stato, '')) = 'pagato'
    AND (p.importo IS NULL OR p.importo <= 0 OR p.data IS NULL)
  )
UNION ALL
SELECT
  'RECONCILIATION',
  p.studio_id,
  'payments',
  p.id::text,
  NULL::text,
  p.paziente_id,
  p.data,
  CASE
    WHEN p.paziente_id IS NULL THEN 'PAYMENT_PATIENT_MISSING'
    ELSE 'PAYMENT_PLAN_LINK_MISMATCH'
  END
FROM public.payments p
LEFT JOIN public.plans pl ON pl.id = p.piano_id
WHERE lower(COALESCE(p.stato, '')) = 'pagato'
  AND p.importo > 0
  AND (
    p.paziente_id IS NULL
    OR (
      p.piano_id IS NOT NULL
      AND (
        pl.id IS NULL
        OR pl.studio_id IS DISTINCT FROM p.studio_id
        OR pl.paziente_id IS DISTINCT FROM p.paziente_id
      )
    )
  );

REVOKE ALL ON TABLE
  private.financial_live_plan_line_values_v1,
  private.financial_live_payment_values_v1,
  private.financial_live_data_quality_v1
FROM PUBLIC, anon;
GRANT SELECT ON TABLE
  private.financial_live_plan_line_values_v1,
  private.financial_live_payment_values_v1,
  private.financial_live_data_quality_v1
TO authenticated;

-- POL-FIN-002/003 plan balances now consume the same cent-exact sold values.
CREATE OR REPLACE VIEW private.incassi_plan_totals_v1
WITH (security_invoker = true)
AS
SELECT
  v.plan_id AS piano_id,
  v.studio_id,
  v.patient_id AS paziente_id,
  v.plan_date AS data,
  v.created_at,
  sum(v.original_amount) AS sub,
  COALESCE(sum(v.original_amount) FILTER (WHERE v.executed), 0) AS sub_eseguito,
  sum(v.allocated_discount) AS scontato,
  sum(v.sold_amount) AS totale_piano,
  COALESCE(sum(v.sold_amount) FILTER (WHERE v.executed), 0) AS totale_eseguito
FROM private.financial_live_plan_line_values_v1 v
GROUP BY v.plan_id, v.studio_id, v.patient_id, v.plan_date, v.created_at;

REVOKE ALL ON TABLE private.incassi_plan_totals_v1 FROM PUBLIC, anon;
GRANT SELECT ON TABLE private.incassi_plan_totals_v1 TO authenticated;

CREATE OR REPLACE VIEW private.incassi_plan_saldo_v1
WITH (security_invoker = true)
AS
SELECT
  totals.piano_id,
  totals.studio_id,
  totals.paziente_id,
  totals.data,
  totals.totale_piano,
  totals.totale_eseguito,
  COALESCE(paid.totale_pagato_piano, 0) AS totale_pagato_piano
FROM private.incassi_plan_totals_v1 totals
LEFT JOIN (
  SELECT
    pay.plan_id,
    sum(pay.amount) AS totale_pagato_piano
  FROM private.financial_live_payment_values_v1 pay
  JOIN public.plans plan
    ON plan.id = pay.plan_id
    AND plan.studio_id = pay.studio_id
    AND plan.paziente_id = pay.patient_id
  WHERE pay.plan_id IS NOT NULL
  GROUP BY pay.plan_id
) paid ON paid.plan_id = totals.piano_id;

REVOKE ALL ON TABLE private.incassi_plan_saldo_v1 FROM PUBLIC, anon;
GRANT SELECT ON TABLE private.incassi_plan_saldo_v1 TO authenticated;

CREATE OR REPLACE FUNCTION public.get_saldo_piano(p_piano_id bigint)
RETURNS TABLE (
  piano_id bigint,
  totale_piano numeric,
  totale_eseguito numeric,
  totale_pagato numeric,
  saldo_piano numeric,
  eseguito_non_pagato numeric,
  acconto numeric
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_studio_id uuid;
BEGIN
  SELECT p.studio_id INTO v_studio_id
  FROM public.plans p
  WHERE p.id = p_piano_id;
  IF v_studio_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT private.financial_verified_studio_membership_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.blocking_metric = 'PLAN_BALANCE'
      AND q.source_table = 'plans'
      AND q.source_id = p_piano_id::text
  ) THEN
    RAISE EXCEPTION 'POL-FIN-006: plan balance unavailable due incomplete plan data';
  END IF;

  RETURN QUERY
  SELECT
    s.piano_id,
    s.totale_piano,
    s.totale_eseguito,
    s.totale_pagato_piano,
    s.totale_piano - s.totale_pagato_piano,
    GREATEST(0, s.totale_eseguito - s.totale_pagato_piano),
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito)
  FROM private.incassi_plan_saldo_v1 s
  WHERE s.piano_id = p_piano_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_saldi_aperti_studio(p_studio_id uuid)
RETURNS TABLE (
  piano_id bigint,
  paziente_id bigint,
  data date,
  titolo text,
  totale_piano numeric,
  totale_eseguito numeric,
  totale_pagato numeric,
  saldo_piano numeric,
  eseguito_non_pagato numeric,
  acconto numeric,
  giorni_apertura integer
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_studio_id uuid;
BEGIN
  IF NOT private.financial_verified_studio_membership_v1(p_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') <> p_studio_id::text THEN
    RAISE EXCEPTION 'POL-FIN-006: live tenant context unavailable';
  END IF;

  PERFORM set_config('request.financial_studio_override_v1', p_studio_id::text, true);
  v_studio_id := private.financial_current_studio_v1();
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM private.financial_live_data_quality_v1 q
    WHERE q.studio_id = v_studio_id
      AND q.blocking_metric = 'PLAN_BALANCE'
  ) THEN
    RAISE EXCEPTION 'POL-FIN-006: open balances unavailable due incomplete plan data';
  END IF;

  RETURN QUERY
  SELECT
    s.piano_id,
    s.paziente_id,
    s.data,
    plan.titolo,
    s.totale_piano,
    s.totale_eseguito,
    s.totale_pagato_piano,
    s.totale_piano - s.totale_pagato_piano,
    GREATEST(0, s.totale_eseguito - s.totale_pagato_piano),
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito),
    GREATEST(0, CURRENT_DATE - s.data)::integer
  FROM private.incassi_plan_saldo_v1 s
  JOIN public.plans plan ON plan.id = s.piano_id
  WHERE s.studio_id = v_studio_id
    AND s.totale_piano - s.totale_pagato_piano > 0.005
  ORDER BY s.totale_piano - s.totale_pagato_piano DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_saldo_piano(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_saldi_aperti_studio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_saldo_piano(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saldi_aperti_studio(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_financial_drilldown_v1(
  p_data_inizio date,
  p_data_fine date,
  p_metric text,
  p_studio_id uuid DEFAULT NULL
) RETURNS TABLE (
  metric text,
  source_kind text,
  source_table text,
  source_id text,
  source_line_id text,
  patient_id bigint,
  operator_ref text,
  event_date date,
  amount numeric,
  formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_studio_id uuid;
  v_stock_metric text := regexp_replace(p_metric, '_(APERTURA|MOVIMENTI|CHIUSURA)$', '');
  v_stock_mode text := CASE
    WHEN p_metric LIKE '%_APERTURA' THEN 'APERTURA'
    WHEN p_metric LIKE '%_MOVIMENTI' THEN 'MOVIMENTI'
    ELSE 'CHIUSURA'
  END;
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio > p_data_fine THEN
    RAISE EXCEPTION 'POL-FIN-006: invalid period';
  END IF;

  IF p_studio_id IS NOT NULL THEN
    IF NOT private.financial_verified_studio_membership_v1(p_studio_id) THEN
      RAISE EXCEPTION 'POL-FIN-006: access denied';
    END IF;
    PERFORM set_config('request.financial_studio_override_v1', p_studio_id::text, true);
  ELSE
    PERFORM set_config('request.financial_studio_override_v1', '', true);
  END IF;

  v_studio_id := private.financial_current_studio_v1();
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;
  IF NOT public.has_studio_capability_v1(v_studio_id, 'finance.management.read') THEN
    RAISE EXCEPTION 'POL-FIN-006: access denied';
  END IF;
  IF p_metric IN ('PRODOTTO','INCASSATO','MARGINE_CONTRIBUZIONE','EBITDA_OPERATIVO_GESTIONALE')
    AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') <> v_studio_id::text
  THEN
    RAISE EXCEPTION 'POL-FIN-006: live tenant context unavailable';
  END IF;

  IF p_metric IN ('PREVENTIVATO','PREVENTIVATO_LORDO','SCONTO') THEN
    RETURN QUERY
    SELECT
      p_metric,
      'CONTRACT_LINE',
      v.source_table,
      v.source_id,
      v.source_line_id,
      v.patient_id,
      v.operator_ref,
      v.proposal_date,
      CASE p_metric
        WHEN 'PREVENTIVATO_LORDO' THEN v.gross_amount
        WHEN 'SCONTO' THEN v.allocated_discount
        ELSE v.net_amount
      END,
      'POL-FIN-006-v1'
    FROM private.financial_line_values_v1 v
    WHERE v.studio_id = v_studio_id
      AND v.proposal_date BETWEEN p_data_inizio AND p_data_fine;

  ELSIF p_metric = 'ACCETTATO' THEN
    RETURN QUERY
    SELECT
      p_metric,
      'LINE_EVENT',
      e.source_table,
      e.source_id,
      e.source_line_id,
      v.patient_id,
      COALESCE(e.operator_ref, v.operator_ref),
      e.event_date,
      v.net_amount * e.fraction * e.direction,
      'POL-FIN-006-v1'
    FROM public.financial_line_events_v1 e
    JOIN private.financial_line_values_v1 v
      ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
    WHERE e.studio_id = v_studio_id
      AND e.stage = 'ACCETTATO'
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;

  ELSIF p_metric = 'PRODOTTO' THEN
    IF EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'PRODOTTO'
        AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
    ) THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      p_metric,
      'PLAN_EXECUTION',
      'plans',
      v.plan_id::text,
      v.source_line_id,
      v.patient_id,
      NULL::text,
      v.execution_date,
      v.sold_amount,
      'POL-FIN-006-v1'
    FROM private.financial_live_plan_line_values_v1 v
    WHERE v.studio_id = v_studio_id
      AND v.executed
      AND v.execution_date BETWEEN p_data_inizio AND p_data_fine;

    -- Preserve future/non-legacy canonical event producers without counting
    -- the frozen POL-003B plans backfill twice.
    RETURN QUERY
    SELECT
      p_metric,
      'LINE_EVENT',
      e.source_table,
      e.source_id,
      e.source_line_id,
      v.patient_id,
      COALESCE(e.operator_ref, v.operator_ref),
      e.event_date,
      v.net_amount * e.fraction * e.direction,
      'POL-FIN-006-v1'
    FROM public.financial_line_events_v1 e
    JOIN private.financial_line_values_v1 v
      ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
    WHERE e.studio_id = v_studio_id
      AND e.stage = 'PRODOTTO'
      AND e.source_table <> 'plans'
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;

  ELSIF p_metric IN ('FATTURATO_NETTO_IVA','FATTURATO_IVA','FATTURATO_LORDO') THEN
    RETURN QUERY
    SELECT
      p_metric,
      'INVOICE_EVENT',
      e.source_table,
      e.source_id,
      e.source_line_id,
      e.patient_id,
      e.operator_ref,
      e.event_date,
      CASE p_metric
        WHEN 'FATTURATO_NETTO_IVA' THEN e.taxable_amount
        WHEN 'FATTURATO_IVA' THEN e.vat_amount
        ELSE e.gross_document_amount
      END * e.direction,
      'POL-FIN-006-v1'
    FROM public.financial_invoice_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;

  ELSIF p_metric = 'INCASSATO' THEN
    IF EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'INCASSATO'
        AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
    ) THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      p_metric,
      'PAYMENT',
      'payments',
      p.payment_id::text,
      NULL::text,
      p.patient_id,
      NULL::text,
      p.event_date,
      p.amount,
      'POL-FIN-006-v1'
    FROM private.financial_live_payment_values_v1 p
    WHERE p.studio_id = v_studio_id
      AND p.event_date BETWEEN p_data_inizio AND p_data_fine;

    RETURN QUERY
    SELECT
      p_metric,
      'PAYMENT_EVENT',
      e.source_table,
      e.source_id,
      NULL::text,
      e.patient_id,
      e.operator_ref,
      e.event_date,
      e.amount * e.direction,
      'POL-FIN-006-v1'
    FROM public.financial_payment_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.source_table <> 'payments'
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (e.event_kind <> 'EXTERNAL_PAYMENT' OR e.reconciled);

  ELSIF p_metric = 'INCASSATO_ALLOCATO' THEN
    RETURN QUERY
    SELECT
      p_metric,
      'PAYMENT_ALLOCATION',
      a.source_table,
      a.source_id,
      NULL::text,
      a.patient_id,
      NULL::text,
      a.payment_date,
      a.signed_amount,
      'POL-FIN-006-v1'
    FROM private.financial_effective_allocations_v1 a
    WHERE a.studio_id = v_studio_id
      AND a.payment_date BETWEEN p_data_inizio AND p_data_fine;

  ELSIF v_stock_metric IN (
    'PORTAFOGLIO_DA_ESEGUIRE',
    'PRODOTTO_DA_FATTURARE',
    'CREDITO_CLIENTI',
    'SALDO_INCASSI_NON_ALLOCATO'
  ) THEN
    IF v_stock_metric = 'PORTAFOGLIO_DA_ESEGUIRE' THEN
      RETURN QUERY
      SELECT
        p_metric,
        'ACCEPTED_STOCK',
        e.source_table,
        e.source_id,
        e.source_line_id,
        v.patient_id,
        COALESCE(e.operator_ref, v.operator_ref),
        e.event_date,
        v.net_amount * e.fraction * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_line_events_v1 e
      JOIN private.financial_line_values_v1 v
        ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
      WHERE e.studio_id = v_studio_id
        AND e.stage = 'ACCETTATO'
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

      RETURN QUERY
      SELECT
        p_metric,
        'PRODUCED_STOCK',
        e.source_table,
        e.source_id,
        e.source_line_id,
        v.patient_id,
        COALESCE(e.operator_ref, v.operator_ref),
        e.event_date,
        -v.net_amount * e.fraction * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_line_events_v1 e
      JOIN private.financial_line_values_v1 v
        ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
      WHERE e.studio_id = v_studio_id
        AND e.stage = 'PRODOTTO'
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

    ELSIF v_stock_metric = 'PRODOTTO_DA_FATTURARE' THEN
      RETURN QUERY
      SELECT
        p_metric,
        'PRODUCED_STOCK',
        e.source_table,
        e.source_id,
        e.source_line_id,
        v.patient_id,
        COALESCE(e.operator_ref, v.operator_ref),
        e.event_date,
        v.net_amount * e.fraction * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_line_events_v1 e
      JOIN private.financial_line_values_v1 v
        ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
      WHERE e.studio_id = v_studio_id
        AND e.stage = 'PRODOTTO'
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

      RETURN QUERY
      SELECT
        p_metric,
        'INVOICED_STOCK',
        e.source_table,
        e.source_id,
        e.source_line_id,
        e.patient_id,
        e.operator_ref,
        e.event_date,
        -e.taxable_amount * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_invoice_events_v1 e
      WHERE e.studio_id = v_studio_id
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

    ELSIF v_stock_metric = 'CREDITO_CLIENTI' THEN
      RETURN QUERY
      SELECT
        p_metric,
        'INVOICE_RECEIVABLE',
        e.source_table,
        e.source_id,
        e.source_line_id,
        e.patient_id,
        e.operator_ref,
        e.event_date,
        e.gross_document_amount * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_invoice_events_v1 e
      WHERE e.studio_id = v_studio_id
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

      RETURN QUERY
      SELECT
        p_metric,
        'ALLOCATED_COLLECTION',
        a.source_table,
        a.source_id,
        NULL::text,
        a.patient_id,
        NULL::text,
        a.payment_date,
        -a.signed_amount,
        'POL-FIN-006-v1'
      FROM private.financial_effective_allocations_v1 a
      WHERE a.studio_id = v_studio_id
        AND (
          (v_stock_mode = 'APERTURA' AND a.payment_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND a.payment_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND a.payment_date <= p_data_fine)
        );

    ELSE
      RETURN QUERY
      SELECT
        p_metric,
        'PAYMENT_EVENT',
        e.source_table,
        e.source_id,
        NULL::text,
        e.patient_id,
        e.operator_ref,
        e.event_date,
        e.amount * e.direction,
        'POL-FIN-006-v1'
      FROM public.financial_payment_events_v1 e
      WHERE e.studio_id = v_studio_id
        AND (e.event_kind <> 'EXTERNAL_PAYMENT' OR e.reconciled)
        AND (
          (v_stock_mode = 'APERTURA' AND e.event_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND e.event_date <= p_data_fine)
        );

      RETURN QUERY
      SELECT
        p_metric,
        'ALLOCATED_COLLECTION',
        a.source_table,
        a.source_id,
        NULL::text,
        a.patient_id,
        NULL::text,
        a.payment_date,
        -a.signed_amount,
        'POL-FIN-006-v1'
      FROM private.financial_effective_allocations_v1 a
      WHERE a.studio_id = v_studio_id
        AND (
          (v_stock_mode = 'APERTURA' AND a.payment_date < p_data_inizio)
          OR (v_stock_mode = 'MOVIMENTI' AND a.payment_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode = 'CHIUSURA' AND a.payment_date <= p_data_fine)
        );
    END IF;

  ELSIF p_metric IN (
    'COSTI_PREVISTI',
    'COSTI_IMPEGNATI',
    'COSTI_VARIABILI',
    'COSTI_FISSI_OPERATIVI',
    'COSTI_STRUTTURA_OPERATIVI',
    'COSTI_OPERATORE'
  ) THEN
    RETURN QUERY
    SELECT
      p_metric,
      'COST_EVENT',
      e.source_table,
      e.source_id,
      NULL::text,
      e.patient_id,
      e.operator_ref,
      e.event_date,
      e.amount * e.direction,
      'POL-FIN-006-v1'
    FROM public.financial_cost_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (
        (p_metric = 'COSTI_PREVISTI' AND e.stage = 'PREVISTO')
        OR (p_metric = 'COSTI_IMPEGNATI' AND e.stage = 'IMPEGNATO')
        OR (p_metric = 'COSTI_VARIABILI' AND e.stage = 'SOSTENUTO' AND e.classification = 'VARIABILE_ATTRIBUIBILE')
        OR (p_metric = 'COSTI_FISSI_OPERATIVI' AND e.stage = 'SOSTENUTO' AND e.classification = 'FISSO_OPERATIVO')
        OR (
          p_metric = 'COSTI_STRUTTURA_OPERATIVI'
          AND e.stage = 'SOSTENUTO'
          AND e.classification = 'FISSO_OPERATIVO'
        )
        OR (
          p_metric = 'COSTI_OPERATORE'
          AND e.stage = 'SOSTENUTO'
          AND e.cost_scope = 'OPERATOR'
          AND e.classification IN ('VARIABILE_ATTRIBUIBILE','FISSO_OPERATIVO')
        )
      );

  ELSIF p_metric IN ('ORE_DISPONIBILI','ORE_EFFETTIVE') THEN
    RETURN QUERY
    SELECT
      p_metric,
      'HOURS',
      e.source_table,
      e.source_id,
      NULL::text,
      NULL::bigint,
      e.operator_ref,
      e.event_date,
      e.hours,
      'POL-FIN-006-v1'
    FROM public.financial_hours_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (
        (p_metric = 'ORE_DISPONIBILI' AND e.hour_kind = 'AVAILABLE' AND e.scope = 'STRUCTURE')
        OR (p_metric = 'ORE_EFFETTIVE' AND e.hour_kind = 'WORKED')
      );

  ELSIF p_metric IN ('MARGINE_CONTRIBUZIONE','EBITDA_OPERATIVO_GESTIONALE') THEN
    IF EXISTS (
      SELECT 1
      FROM private.financial_live_data_quality_v1 q
      WHERE q.studio_id = v_studio_id
        AND q.blocking_metric = 'PRODOTTO'
        AND (q.event_date IS NULL OR q.event_date BETWEEN p_data_inizio AND p_data_fine)
    ) THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      p_metric,
      d.source_kind,
      d.source_table,
      d.source_id,
      d.source_line_id,
      d.patient_id,
      d.operator_ref,
      d.event_date,
      d.amount,
      'POL-FIN-006-v1'
    FROM public.get_financial_drilldown_v1(
      p_data_inizio, p_data_fine, 'PRODOTTO', v_studio_id
    ) d;

    RETURN QUERY
    SELECT
      p_metric,
      d.source_kind,
      d.source_table,
      d.source_id,
      d.source_line_id,
      d.patient_id,
      d.operator_ref,
      d.event_date,
      -d.amount,
      'POL-FIN-006-v1'
    FROM public.get_financial_drilldown_v1(
      p_data_inizio, p_data_fine, 'COSTI_VARIABILI', v_studio_id
    ) d;

    IF p_metric = 'EBITDA_OPERATIVO_GESTIONALE' THEN
      RETURN QUERY
      SELECT
        p_metric,
        d.source_kind,
        d.source_table,
        d.source_id,
        d.source_line_id,
        d.patient_id,
        d.operator_ref,
        d.event_date,
        -d.amount,
        'POL-FIN-006-v1'
      FROM public.get_financial_drilldown_v1(
        p_data_inizio, p_data_fine, 'COSTI_FISSI_OPERATIVI', v_studio_id
      ) d;
    END IF;
  ELSE
    RAISE EXCEPTION 'POL-FIN-006: unsupported metric %', p_metric;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_prodotto_reconciliation_v1(date,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prodotto_reconciliation_v1(date,date,uuid) TO authenticated;

COMMENT ON VIEW private.financial_live_plan_line_values_v1 IS
  'POL-FIN-006 canonical live plan-line sold values. Preserves plans.voci[].prezzo as original amount and allocates plan discount in cents by largest remainder with JSON ordinal tie-break.';
COMMENT ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) IS
  'POL-FIN-006 canonical snapshot: live Prodotto from executed plan lines on dataEsec and live Incassato from positive settled payments on payment date. Invalid legacy inputs fail closed.';
COMMENT ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) IS
  'POL-FIN-006 canonical drilldown. PRODOTTO and INCASSATO use live plans/payments while preserving non-legacy canonical events.';
COMMENT ON FUNCTION public.get_prodotto_reconciliation_v1(date,date,uuid) IS
  'POL-FIN-006 capability-gated live reconciliation. Payments remain plan-level or patient-unallocated and are never allocated to individual services.';

COMMIT;

-- Reversal before remote execution:
-- 1. Restore get_financial_drilldown_v1/get_financial_snapshot_v1 and
--    private.incassi_plan_totals_v1 from their immediately preceding
--    versioned migrations.
-- 2. DROP FUNCTION public.get_prodotto_reconciliation_v1(date,date,uuid).
-- 3. DROP VIEW private.financial_live_data_quality_v1,
--    private.financial_live_payment_values_v1,
--    private.financial_live_plan_line_values_v1.
-- 4. DROP FUNCTION private.financial_try_iso_date_v1(text).
-- No plans/payments rows are mutated and no backfill is performed.
