-- POL-003F — restricted legacy adapter for canonical operating costs and
-- structure capacity hours. Installation never executes the adapter.
BEGIN;

CREATE OR REPLACE FUNCTION private.pol_003f_frequency_months_v1(p_frequency text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE p_frequency
    WHEN 'Mensile' THEN 1
    WHEN 'Bimestrale' THEN 2
    WHEN 'Trimestrale' THEN 3
    WHEN 'Semestrale' THEN 6
    WHEN 'Annuale' THEN 12
    ELSE NULL
  END
$function$;

REVOKE ALL ON FUNCTION private.pol_003f_frequency_months_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.run_pol_003f_costs_hours_adapter_v1(
  p_studio_id uuid,
  p_data_inizio date,
  p_data_fine date
)
RETURNS TABLE (
  expense_events_inserted bigint,
  personnel_events_inserted bigint,
  available_hour_events_inserted bigint,
  expenses_skipped bigint,
  personnel_skipped bigint,
  machinery_blocked bigint,
  confirmed_appointments_blocked bigint,
  hour_config_skipped bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_required text[] := ARRAY[
    'spese:id','spese:studio_id','spese:importo','spese:data',
    'spese:data_fine','spese:ricorrente','spese:frequenza','spese:tipo_costo',
    'personale:id','personale:studio_id','personale:costo_mensile',
    'personale:attivo','personale:data_inizio',
    'macchinari:id','macchinari:studio_id','macchinari:attivo',
    'studio_info:studio_id','studio_info:config_orario',
    'appointments:id','appointments:studio_id','appointments:data','appointments:stato'
  ];
  v_missing text[];
  v_effective_end date;
  v_current_month_end date :=
    (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_config jsonb;
  v_days numeric;
  v_hours_day numeric;
  v_stations numeric;
  v_monthly_hours numeric;
BEGIN
  IF p_studio_id IS NULL OR p_data_inizio IS NULL OR p_data_fine IS NULL THEN
    RAISE EXCEPTION 'POL-003F: studio_id and period are required';
  END IF;
  IF p_data_inizio > p_data_fine
     OR p_data_inizio <> date_trunc('month', p_data_inizio)::date THEN
    RAISE EXCEPTION 'POL-003F: period must start on the first calendar day of a month';
  END IF;
  IF p_data_inizio > v_current_month_end THEN
    RAISE EXCEPTION 'POL-003F: future-only periods are not allowed';
  END IF;
  v_effective_end := LEAST(p_data_fine, v_current_month_end);

  SELECT array_agg(required_column ORDER BY required_column)
  INTO v_missing
  FROM unnest(v_required) required_column
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = split_part(required_column, ':', 1)
      AND c.column_name = split_part(required_column, ':', 2)
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'POL-003F preflight: verified legacy columns missing: %', v_missing;
  END IF;

  -- One-off expenses retain their economic date. Recurring expenses become one
  -- month-normalized event for every overlapped calendar month, capped at the
  -- current month and at data_fine. Unknown recurrence encodings fail closed.
  EXECUTE $sql$
    WITH eligible AS (
      SELECT s.*,
        private.pol_003f_frequency_months_v1(s.frequenza) frequency_months
      FROM public.spese s
      WHERE s.studio_id = $1
        AND s.ricorrente IS NOT NULL
        AND s.data IS NOT NULL
        AND s.importo >= 0
        AND lower(s.tipo_costo) IN ('fisso', 'variabile')
        AND (
          NOT s.ricorrente
          OR private.pol_003f_frequency_months_v1(s.frequenza) IS NOT NULL
        )
    ), expanded AS (
      SELECT e.studio_id, e.id,
        gs.month_start::date event_date,
        e.importo / e.frequency_months amount,
        CASE lower(e.tipo_costo)
          WHEN 'fisso' THEN 'FISSO_OPERATIVO'
          ELSE 'VARIABILE_ATTRIBUIBILE'
        END classification,
        e.id::text || ':' || to_char(gs.month_start, 'YYYY-MM') source_id
      FROM eligible e
      CROSS JOIN LATERAL generate_series(
        date_trunc('month', GREATEST(e.data, $2))::date,
        date_trunc('month', LEAST(COALESCE(e.data_fine, $3), $3))::date,
        interval '1 month'
      ) gs(month_start)
      WHERE e.ricorrente

      UNION ALL

      SELECT e.studio_id, e.id, e.data, e.importo,
        CASE lower(e.tipo_costo)
          WHEN 'fisso' THEN 'FISSO_OPERATIVO'
          ELSE 'VARIABILE_ATTRIBUIBILE'
        END,
        e.id::text || ':ONE_OFF'
      FROM eligible e
      WHERE NOT e.ricorrente
        AND e.data BETWEEN $2 AND $3
    )
    INSERT INTO public.financial_cost_events_v1(
      studio_id, stage, classification, cost_scope, event_date, direction,
      amount, patient_id, service_ref, operator_ref, cost_version_ref,
      source_table, source_id
    )
    SELECT studio_id, 'SOSTENUTO', classification, 'STRUCTURE', event_date, 1,
      amount, NULL, NULL, NULL, 'legacy-spese-v1:' || id::text,
      'spese', source_id
    FROM expanded
    ON CONFLICT (studio_id, source_table, source_id) DO NOTHING
  $sql$ USING p_studio_id, p_data_inizio, v_effective_end;
  GET DIAGNOSTICS expense_events_inserted = ROW_COUNT;

  -- The PO-authorized personnel mapping snapshots the current monthly base cost
  -- from data_inizio forward while the source is active. No end date is invented.
  EXECUTE $sql$
    WITH eligible AS (
      SELECT p.*
      FROM public.personale p
      WHERE p.studio_id = $1
        AND p.attivo
        AND p.data_inizio IS NOT NULL
        AND p.costo_mensile >= 0
    ), expanded AS (
      SELECT p.studio_id, p.id, gs.month_start::date event_date,
        p.costo_mensile amount,
        p.id::text || ':' || to_char(gs.month_start, 'YYYY-MM') source_id
      FROM eligible p
      CROSS JOIN LATERAL generate_series(
        date_trunc('month', GREATEST(p.data_inizio, $2))::date,
        date_trunc('month', $3)::date,
        interval '1 month'
      ) gs(month_start)
    )
    INSERT INTO public.financial_cost_events_v1(
      studio_id, stage, classification, cost_scope, event_date, direction,
      amount, patient_id, service_ref, operator_ref, cost_version_ref,
      source_table, source_id
    )
    SELECT studio_id, 'SOSTENUTO', 'FISSO_OPERATIVO', 'STRUCTURE',
      event_date, 1, amount, NULL, NULL, NULL,
      'legacy-personale-v1:' || id::text, 'personale', source_id
    FROM expanded
    ON CONFLICT (studio_id, source_table, source_id) DO NOTHING
  $sql$ USING p_studio_id, p_data_inizio, v_effective_end;
  GET DIAGNOSTICS personnel_events_inserted = ROW_COUNT;

  -- Missing or malformed config_orario is not defaulted. Capacity is monthly
  -- normalized with the verified 4.33 weeks convention; WORKED is never written.
  EXECUTE 'SELECT config_orario FROM public.studio_info WHERE studio_id = $1 LIMIT 1'
    INTO v_config USING p_studio_id;

  IF jsonb_typeof(v_config) = 'object'
     AND COALESCE(v_config ->> 'giorni_settimana', '') ~ '^([0-9]+)([.][0-9]+)?$'
     AND COALESCE(v_config ->> 'ore_al_giorno', '') ~ '^([0-9]+)([.][0-9]+)?$'
     AND COALESCE(v_config ->> 'num_postazioni', '') ~ '^([0-9]+)([.][0-9]+)?$' THEN
    v_days := (v_config ->> 'giorni_settimana')::numeric;
    v_hours_day := (v_config ->> 'ore_al_giorno')::numeric;
    v_stations := (v_config ->> 'num_postazioni')::numeric;
  END IF;

  IF v_days > 0 AND v_days <= 7
     AND v_hours_day > 0 AND v_hours_day <= 24
     AND v_stations > 0 THEN
    v_monthly_hours := v_days * v_hours_day * v_stations * 4.33;
    EXECUTE $sql$
      INSERT INTO public.financial_hours_v1(
        studio_id, event_date, scope, hour_kind, operator_ref, hours,
        source_table, source_id
      )
      SELECT $1, gs.month_start::date, 'STRUCTURE', 'AVAILABLE', NULL, $4,
        'studio_info_config_orario',
        'AVAILABLE:' || to_char(gs.month_start, 'YYYY-MM')
      FROM generate_series(
        date_trunc('month', $2)::date,
        date_trunc('month', $3)::date,
        interval '1 month'
      ) gs(month_start)
      ON CONFLICT (studio_id, source_table, source_id) DO NOTHING
    $sql$ USING p_studio_id, p_data_inizio, v_effective_end, v_monthly_hours;
    GET DIAGNOSTICS available_hour_events_inserted = ROW_COUNT;
    hour_config_skipped := 0;
  ELSE
    available_hour_events_inserted := 0;
    hour_config_skipped := 1;
  END IF;

  EXECUTE $sql$
    SELECT count(*)
    FROM public.spese s
    WHERE s.studio_id = $1
      AND NOT (
        s.ricorrente IS NOT NULL
        AND s.data IS NOT NULL
        AND s.importo >= 0
        AND lower(s.tipo_costo) IN ('fisso', 'variabile')
        AND (
          NOT s.ricorrente
          OR private.pol_003f_frequency_months_v1(s.frequenza) IS NOT NULL
        )
      )
  $sql$ INTO expenses_skipped USING p_studio_id;

  EXECUTE $sql$
    SELECT count(*)
    FROM public.personale p
    WHERE p.studio_id = $1
      AND p.attivo
      AND (p.data_inizio IS NULL OR p.costo_mensile < 0)
  $sql$ INTO personnel_skipped USING p_studio_id;

  EXECUTE 'SELECT count(*) FROM public.macchinari WHERE studio_id = $1 AND attivo'
    INTO machinery_blocked USING p_studio_id;

  EXECUTE $sql$
    SELECT count(*)
    FROM public.appointments a
    WHERE a.studio_id = $1
      AND lower(COALESCE(a.stato, '')) = 'confermato'
      AND a.data BETWEEN $2 AND $3
  $sql$ INTO confirmed_appointments_blocked
    USING p_studio_id, p_data_inizio, v_effective_end;

  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date) IS
  'Restricted idempotent POL-003F adapter. Installation never executes it; remote execution requires a separate PO gate.';

REVOKE ALL ON FUNCTION private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- Reversal before execution: drop run_pol_003f_costs_hours_adapter_v1 and
-- pol_003f_frequency_months_v1. After execution, remove only exact provenance
-- rows from spese/personale/studio_info_config_orario under an approved runbook.
