-- POL-003F corrective migration: current personnel cost must never rewrite history.
BEGIN;

CREATE TABLE public.financial_personnel_cost_versions_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  personnel_id bigint NOT NULL,
  valid_from date NOT NULL CHECK (valid_from=date_trunc('month',valid_from)::date),
  monthly_cost numeric(14,6) NOT NULL CHECK (monthly_cost>=0),
  authority_ref text NOT NULL CHECK (btrim(authority_ref)<>''),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id,personnel_id,valid_from)
);

CREATE INDEX financial_personnel_cost_versions_studio_period_idx
  ON public.financial_personnel_cost_versions_v1(studio_id,valid_from,personnel_id);

ALTER TABLE public.financial_personnel_cost_versions_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_personnel_cost_versions_select_member
ON public.financial_personnel_cost_versions_v1 FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.studio_users su
  WHERE su.user_id=(SELECT auth.uid())
    AND su.studio_id=financial_personnel_cost_versions_v1.studio_id
    AND su.stato='attivo'
));
REVOKE ALL ON public.financial_personnel_cost_versions_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.financial_personnel_cost_versions_v1 TO authenticated;

CREATE OR REPLACE FUNCTION private.pol_003f_personnel_cost_versions_append_only_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
BEGIN
  RAISE EXCEPTION 'POL-003F: personnel cost versions are append-only';
END
$function$;
REVOKE ALL ON FUNCTION private.pol_003f_personnel_cost_versions_append_only_v1()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER financial_personnel_cost_versions_append_only
BEFORE UPDATE OR DELETE ON public.financial_personnel_cost_versions_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_003f_personnel_cost_versions_append_only_v1();

CREATE OR REPLACE FUNCTION private.run_pol_003f_costs_hours_adapter_v1(
  p_studio_id uuid,p_data_inizio date,p_data_fine date
)
RETURNS TABLE (
  expense_events_inserted bigint,personnel_events_inserted bigint,
  available_hour_events_inserted bigint,expenses_skipped bigint,
  personnel_skipped bigint,machinery_blocked bigint,
  confirmed_appointments_blocked bigint,hour_config_skipped bigint
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_required text[] := ARRAY[
    'spese:id','spese:studio_id','spese:importo','spese:data','spese:data_fine',
    'spese:ricorrente','spese:frequenza','spese:tipo_costo',
    'personale:id','personale:studio_id','personale:attivo','personale:data_inizio',
    'macchinari:id','macchinari:studio_id','macchinari:attivo',
    'studio_info:studio_id','studio_info:config_orario',
    'appointments:id','appointments:studio_id','appointments:data','appointments:stato',
    'financial_personnel_cost_versions_v1:id',
    'financial_personnel_cost_versions_v1:studio_id',
    'financial_personnel_cost_versions_v1:personnel_id',
    'financial_personnel_cost_versions_v1:valid_from',
    'financial_personnel_cost_versions_v1:monthly_cost'
  ];
  v_missing text[]; v_effective_end date;
  v_current_month_end date := (date_trunc('month',CURRENT_DATE)+interval '1 month'-interval '1 day')::date;
  v_config jsonb; v_days numeric; v_hours_day numeric; v_stations numeric; v_monthly_hours numeric;
BEGIN
  IF p_studio_id IS NULL OR p_data_inizio IS NULL OR p_data_fine IS NULL THEN
    RAISE EXCEPTION 'POL-003F: studio_id and period are required';
  END IF;
  IF p_data_inizio>p_data_fine OR p_data_inizio<>date_trunc('month',p_data_inizio)::date THEN
    RAISE EXCEPTION 'POL-003F: period must start on the first calendar day of a month';
  END IF;
  IF p_data_inizio>v_current_month_end THEN RAISE EXCEPTION 'POL-003F: future-only periods are not allowed'; END IF;
  v_effective_end:=LEAST(p_data_fine,v_current_month_end);

  SELECT array_agg(required_column ORDER BY required_column) INTO v_missing
  FROM unnest(v_required) required_column WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
      AND c.table_name=split_part(required_column,':',1)
      AND c.column_name=split_part(required_column,':',2));
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'POL-003F preflight: verified columns missing: %',v_missing; END IF;

  EXECUTE $sql$
    WITH eligible AS (
      SELECT s.*,private.pol_003f_frequency_months_v1(s.frequenza) frequency_months
      FROM public.spese s WHERE s.studio_id=$1 AND s.ricorrente IS NOT NULL
        AND s.data IS NOT NULL AND s.importo>=0 AND lower(s.tipo_costo) IN('fisso','variabile')
        AND (NOT s.ricorrente OR private.pol_003f_frequency_months_v1(s.frequenza) IS NOT NULL)
    ),expanded AS (
      SELECT e.studio_id,e.id,gs.month_start::date event_date,e.importo/e.frequency_months amount,
        CASE lower(e.tipo_costo) WHEN 'fisso' THEN 'FISSO_OPERATIVO' ELSE 'VARIABILE_ATTRIBUIBILE' END classification,
        e.id::text||':'||to_char(gs.month_start,'YYYY-MM') source_id
      FROM eligible e CROSS JOIN LATERAL generate_series(
        date_trunc('month',GREATEST(e.data,$2))::date,
        date_trunc('month',LEAST(COALESCE(e.data_fine,$3),$3))::date,interval '1 month') gs(month_start)
      WHERE e.ricorrente
      UNION ALL
      SELECT e.studio_id,e.id,e.data,e.importo,
        CASE lower(e.tipo_costo) WHEN 'fisso' THEN 'FISSO_OPERATIVO' ELSE 'VARIABILE_ATTRIBUIBILE' END,
        e.id::text||':ONE_OFF' FROM eligible e WHERE NOT e.ricorrente AND e.data BETWEEN $2 AND $3
    )
    INSERT INTO public.financial_cost_events_v1(
      studio_id,stage,classification,cost_scope,event_date,direction,amount,patient_id,
      service_ref,operator_ref,cost_version_ref,source_table,source_id)
    SELECT studio_id,'SOSTENUTO',classification,'STRUCTURE',event_date,1,amount,NULL,NULL,NULL,
      'legacy-spese-v1:'||id::text,'spese',source_id FROM expanded
    ON CONFLICT(studio_id,source_table,source_id) DO NOTHING
  $sql$ USING p_studio_id,p_data_inizio,v_effective_end;
  GET DIAGNOSTICS expense_events_inserted=ROW_COUNT;

  -- Only explicit append-only versions are authoritative. personale.costo_mensile
  -- is deliberately not read: a present value can never reconstruct prior months.
  EXECUTE $sql$
    WITH versions AS (
      SELECT v.*,lead(v.valid_from) OVER(PARTITION BY v.studio_id,v.personnel_id ORDER BY v.valid_from) next_from
      FROM public.financial_personnel_cost_versions_v1 v
      JOIN public.personale p ON p.id=v.personnel_id AND p.studio_id=v.studio_id
      WHERE v.studio_id=$1 AND v.valid_from<=$3
    ),expanded AS (
      SELECT v.studio_id,v.personnel_id,v.id version_id,gs.month_start::date event_date,
        v.monthly_cost amount,v.id::text||':'||to_char(gs.month_start,'YYYY-MM') source_id
      FROM versions v CROSS JOIN LATERAL generate_series(
        date_trunc('month',GREATEST(v.valid_from,$2))::date,
        date_trunc('month',LEAST(COALESCE(v.next_from-1,$3),$3))::date,interval '1 month') gs(month_start)
    )
    INSERT INTO public.financial_cost_events_v1(
      studio_id,stage,classification,cost_scope,event_date,direction,amount,patient_id,
      service_ref,operator_ref,cost_version_ref,source_table,source_id)
    SELECT studio_id,'SOSTENUTO','FISSO_OPERATIVO','STRUCTURE',event_date,1,amount,NULL,NULL,NULL,
      'personnel-cost-version-v1:'||version_id::text,'financial_personnel_cost_versions_v1',source_id
    FROM expanded ON CONFLICT(studio_id,source_table,source_id) DO NOTHING
  $sql$ USING p_studio_id,p_data_inizio,v_effective_end;
  GET DIAGNOSTICS personnel_events_inserted=ROW_COUNT;

  EXECUTE 'SELECT config_orario FROM public.studio_info WHERE studio_id=$1 LIMIT 1' INTO v_config USING p_studio_id;
  IF jsonb_typeof(v_config)='object'
    AND COALESCE(v_config->>'giorni_settimana','')~'^([0-9]+)([.][0-9]+)?$'
    AND COALESCE(v_config->>'ore_al_giorno','')~'^([0-9]+)([.][0-9]+)?$'
    AND COALESCE(v_config->>'num_postazioni','')~'^([0-9]+)([.][0-9]+)?$' THEN
    v_days:=(v_config->>'giorni_settimana')::numeric;
    v_hours_day:=(v_config->>'ore_al_giorno')::numeric;
    v_stations:=(v_config->>'num_postazioni')::numeric;
  END IF;
  IF v_days>0 AND v_days<=7 AND v_hours_day>0 AND v_hours_day<=24 AND v_stations>0 THEN
    v_monthly_hours:=v_days*v_hours_day*v_stations*4.33;
    EXECUTE $sql$
      INSERT INTO public.financial_hours_v1(studio_id,event_date,scope,hour_kind,operator_ref,hours,source_table,source_id)
      SELECT $1,gs.month_start::date,'STRUCTURE','AVAILABLE',NULL,$4,'studio_info_config_orario',
        'AVAILABLE:'||to_char(gs.month_start,'YYYY-MM')
      FROM generate_series(date_trunc('month',$2)::date,date_trunc('month',$3)::date,interval '1 month') gs(month_start)
      ON CONFLICT(studio_id,source_table,source_id) DO NOTHING
    $sql$ USING p_studio_id,p_data_inizio,v_effective_end,v_monthly_hours;
    GET DIAGNOSTICS available_hour_events_inserted=ROW_COUNT; hour_config_skipped:=0;
  ELSE available_hour_events_inserted:=0; hour_config_skipped:=1; END IF;

  EXECUTE $sql$ SELECT count(*) FROM public.spese s WHERE s.studio_id=$1 AND NOT(
    s.ricorrente IS NOT NULL AND s.data IS NOT NULL AND s.importo>=0
    AND lower(s.tipo_costo) IN('fisso','variabile') AND (NOT s.ricorrente OR private.pol_003f_frequency_months_v1(s.frequenza) IS NOT NULL))
  $sql$ INTO expenses_skipped USING p_studio_id;

  -- Count uncovered active personnel-months, not guessed people or amounts.
  EXECUTE $sql$
    WITH expected AS (
      SELECT p.id,gs.month_start::date month_start FROM public.personale p
      CROSS JOIN LATERAL generate_series(
        date_trunc('month',GREATEST(COALESCE(p.data_inizio,$2),$2))::date,
        date_trunc('month',$3)::date,interval '1 month') gs(month_start)
      WHERE p.studio_id=$1 AND p.attivo AND COALESCE(p.data_inizio,$2)<=$3
    )
    SELECT count(*) FROM expected e WHERE NOT EXISTS(
      SELECT 1 FROM public.financial_personnel_cost_versions_v1 v
      WHERE v.studio_id=$1 AND v.personnel_id=e.id AND v.valid_from<=e.month_start)
  $sql$ INTO personnel_skipped USING p_studio_id,p_data_inizio,v_effective_end;

  EXECUTE 'SELECT count(*) FROM public.macchinari WHERE studio_id=$1 AND attivo'
    INTO machinery_blocked USING p_studio_id;
  EXECUTE $sql$ SELECT count(*) FROM public.appointments a WHERE a.studio_id=$1
    AND lower(COALESCE(a.stato,''))='confermato' AND a.data BETWEEN $2 AND $3
  $sql$ INTO confirmed_appointments_blocked USING p_studio_id,p_data_inizio,v_effective_end;
  RETURN NEXT;
END
$function$;

COMMENT ON TABLE public.financial_personnel_cost_versions_v1 IS
  'Append-only authoritative monthly personnel cost versions. A version applies from valid_from until the next version.';
COMMENT ON FUNCTION private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date) IS
  'Restricted idempotent POL-003F adapter. Personnel history uses only explicit append-only versions; current personnel cost is never backfilled.';
REVOKE ALL ON FUNCTION private.run_pol_003f_costs_hours_adapter_v1(uuid,date,date)
  FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
