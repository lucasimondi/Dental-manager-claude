-- POL-003F aggregate-only shadow reconciliation. Read-only by construction.
-- Usage: psql ... -v studio_id='uuid' -v date_from='YYYY-MM-01' -v date_to='YYYY-MM-DD' -f this-file
BEGIN TRANSACTION READ ONLY;

WITH params AS (
  SELECT :'studio_id'::uuid studio_id, :'date_from'::date date_from,
         LEAST(:'date_to'::date,
           (date_trunc('month',CURRENT_DATE)+interval '1 month'-interval '1 day')::date) date_to
), expense_months AS (
  SELECT s.id,s.tipo_costo,s.importo,s.ricorrente,s.data,
         private.pol_003f_frequency_months_v1(s.frequenza) frequency_months,
         p.date_from,p.date_to
  FROM public.spese s JOIN params p ON p.studio_id=s.studio_id
  WHERE s.data IS NOT NULL AND s.importo>=0
    AND lower(s.tipo_costo) IN ('fisso','variabile')
    AND (NOT s.ricorrente OR private.pol_003f_frequency_months_v1(s.frequenza) IS NOT NULL)
), legacy_expenses AS (
  SELECT lower(tipo_costo) kind, importo amount
  FROM expense_months WHERE NOT ricorrente AND data BETWEEN date_from AND date_to
  UNION ALL
  SELECT lower(e.tipo_costo),e.importo/e.frequency_months
  FROM expense_months e
  CROSS JOIN LATERAL generate_series(
    date_trunc('month',GREATEST(e.data,e.date_from)),
    date_trunc('month',LEAST(COALESCE((SELECT data_fine FROM public.spese WHERE id=e.id),e.date_to),e.date_to)),
    interval '1 month') m
  WHERE e.ricorrente
), legacy_personnel AS (
  SELECT COALESCE(sum(p.costo_mensile),0) amount
  FROM public.personale p JOIN params q ON q.studio_id=p.studio_id
  CROSS JOIN LATERAL generate_series(
    date_trunc('month',GREATEST(p.data_inizio,q.date_from)),
    date_trunc('month',q.date_to),interval '1 month') m
  WHERE p.attivo AND p.data_inizio IS NOT NULL AND p.costo_mensile>=0
), legacy_hours AS (
  SELECT CASE WHEN jsonb_typeof(si.config_orario)='object'
      AND (si.config_orario->>'giorni_settimana') ~ '^([0-9]+)([.][0-9]+)?$'
      AND (si.config_orario->>'ore_al_giorno') ~ '^([0-9]+)([.][0-9]+)?$'
      AND (si.config_orario->>'num_postazioni') ~ '^([0-9]+)([.][0-9]+)?$'
    THEN (si.config_orario->>'giorni_settimana')::numeric
       * (si.config_orario->>'ore_al_giorno')::numeric
       * (si.config_orario->>'num_postazioni')::numeric * 4.33
       * (SELECT count(*) FROM generate_series(date_trunc('month',p.date_from),date_trunc('month',p.date_to),interval '1 month'))
    ELSE 0 END amount
  FROM public.studio_info si JOIN params p ON p.studio_id=si.studio_id
), canonical AS (
  SELECT
    COALESCE(sum(amount) FILTER(WHERE source_table='spese' AND classification='FISSO_OPERATIVO'),0) fixed_expense,
    COALESCE(sum(amount) FILTER(WHERE source_table='personale'),0) personnel,
    COALESCE(sum(amount) FILTER(WHERE classification='VARIABILE_ATTRIBUIBILE'),0) variable
  FROM public.financial_cost_events_v1 c JOIN params p ON p.studio_id=c.studio_id
  WHERE c.event_date BETWEEN p.date_from AND p.date_to
    AND c.source_table IN ('spese','personale')
), canonical_hours AS (
  SELECT COALESCE(sum(hours) FILTER(WHERE hour_kind='AVAILABLE'),0) available,
         COALESCE(sum(hours) FILTER(WHERE hour_kind='WORKED'),0) worked
  FROM public.financial_hours_v1 h JOIN params p ON p.studio_id=h.studio_id
  WHERE h.event_date BETWEEN p.date_from AND p.date_to
    AND h.source_table='studio_info_config_orario'
), values_to_compare AS (
  SELECT 'COSTI_FISSI_SPESE' metric,
    COALESCE((SELECT sum(amount) FROM legacy_expenses WHERE kind='fisso'),0) legacy_value,
    (SELECT fixed_expense FROM canonical) canonical_value,'EXACT' note
  UNION ALL SELECT 'COSTI_PERSONALE',(SELECT amount FROM legacy_personnel),(SELECT personnel FROM canonical),'EXACT'
  UNION ALL SELECT 'COSTI_FISSI_OPERATIVI',
    COALESCE((SELECT sum(amount) FROM legacy_expenses WHERE kind='fisso'),0)+(SELECT amount FROM legacy_personnel),
    (SELECT fixed_expense+personnel FROM canonical),'EXACT'
  UNION ALL SELECT 'COSTI_VARIABILI',COALESCE((SELECT sum(amount) FROM legacy_expenses WHERE kind='variabile'),0),(SELECT variable FROM canonical),'EXACT'
  UNION ALL SELECT 'ORE_DISPONIBILI',COALESCE((SELECT amount FROM legacy_hours),0),(SELECT available FROM canonical_hours),'EXACT'
  UNION ALL SELECT 'ORE_EFFETTIVE',NULL,(SELECT worked FROM canonical_hours),'APPROXIMATION_NOT_ALLOWED'
  UNION ALL SELECT 'MACCHINARI_AMMORTAMENTO_BLOCKED',
    (SELECT count(*) FROM public.macchinari m JOIN params p ON p.studio_id=m.studio_id WHERE m.attivo),0,'BLOCKED_BY_PO_SEMANTICS'
  UNION ALL SELECT 'APPOINTMENTS_WORKED_HOURS_BLOCKED',
    (SELECT count(*) FROM public.appointments a JOIN params p ON p.studio_id=a.studio_id WHERE lower(COALESCE(a.stato,''))='confermato' AND a.data BETWEEN p.date_from AND p.date_to),0,'BLOCKED_BY_PO_SEMANTICS'
)
SELECT metric,legacy_value,canonical_value,note,
  CASE WHEN note='EXACT' AND round(legacy_value,6)=round(canonical_value,6) THEN 'MATCH'
       WHEN note<>'EXACT' THEN 'SEMANTIC_EXPECTED_NOT_ADAPTED'
       ELSE 'REVIEW_REQUIRED' END classification
FROM values_to_compare
ORDER BY metric;
ROLLBACK;
