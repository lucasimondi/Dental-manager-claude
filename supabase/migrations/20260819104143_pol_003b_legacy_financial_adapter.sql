-- POL-003B — deterministic, deliberately partial legacy adapter.
-- This migration only installs a restricted adapter. It never runs it.
-- Production execution requires a separate Product Owner gate.
BEGIN;

CREATE OR REPLACE FUNCTION private.run_pol_003b_legacy_adapter_v1(p_studio_id uuid)
RETURNS TABLE (
  contracts_inserted bigint, lines_inserted bigint, produced_inserted bigint,
  payments_inserted bigint, plans_skipped bigint, lines_skipped bigint,
  produced_skipped bigint, payments_skipped bigint,
  fiscal_documents_blocked bigint, external_payments_blocked bigint, costs_blocked bigint
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_required text[] := ARRAY[
    'plans:id','plans:studio_id','plans:paziente_id','plans:data','plans:voci',
    'plans:sconto','plans:sconto_tipo','payments:id','payments:studio_id',
    'payments:paziente_id','payments:data','payments:importo','payments:stato'
  ];
  v_missing text[];
BEGIN
  IF p_studio_id IS NULL THEN RAISE EXCEPTION 'POL-003B: studio_id is required'; END IF;
  SELECT array_agg(required_column ORDER BY required_column) INTO v_missing
  FROM unnest(v_required) required_column WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
      AND c.table_name=split_part(required_column,':',1)
      AND c.column_name=split_part(required_column,':',2));
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'POL-003B preflight: verified legacy columns missing: %',v_missing;
  END IF;

  -- Invalid dates, discounts and line sets fail closed rather than being repaired.
  EXECUTE $sql$
    INSERT INTO public.financial_contracts_v1(
      studio_id,patient_id,proposal_date,discount_kind,discount_value,source_table,source_id)
    SELECT p.studio_id,p.paziente_id,p.data,
      CASE lower(coalesce(p.sconto_tipo,''))
        WHEN 'pct' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'PERCENT' END
        WHEN 'percent' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'PERCENT' END
        WHEN 'fixed' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'FIXED' END
        WHEN 'fisso' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'FIXED' END
        ELSE CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE NULL END END,
      coalesce(p.sconto,0),'plans',p.id::text
    FROM public.plans p
    WHERE p.studio_id=$1 AND p.data IS NOT NULL AND p.paziente_id IS NOT NULL
      AND jsonb_typeof(p.voci)='array' AND jsonb_array_length(p.voci)>0
      AND coalesce(p.sconto,0)>=0
      AND (coalesce(p.sconto,0)=0 OR lower(coalesce(p.sconto_tipo,'')) IN ('pct','percent','fixed','fisso'))
      AND (lower(coalesce(p.sconto_tipo,'')) NOT IN ('pct','percent') OR coalesce(p.sconto,0)<=100)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.voci) v
        WHERE coalesce(v->>'prezzo','') ~ '^([0-9]+)([.][0-9]+)?$')
    ON CONFLICT (studio_id,source_table,source_id) DO NOTHING
  $sql$ USING p_studio_id;
  GET DIAGNOSTICS contracts_inserted=ROW_COUNT;

  EXECUTE $sql$
    INSERT INTO public.financial_contract_lines_v1(
      studio_id,contract_id,patient_id,service_ref,operator_ref,gross_amount,
      source_table,source_id,source_line_id)
    SELECT p.studio_id,c.id,p.paziente_id,nullif(v.item->>'prestazione',''),NULL,
      (v.item->>'prezzo')::numeric,'plans',p.id::text,v.ordinality::text
    FROM public.plans p
    JOIN public.financial_contracts_v1 c ON c.studio_id=p.studio_id
      AND c.source_table='plans' AND c.source_id=p.id::text
    CROSS JOIN LATERAL jsonb_array_elements(p.voci) WITH ORDINALITY v(item,ordinality)
    WHERE p.studio_id=$1 AND coalesce(v.item->>'prezzo','') ~ '^([0-9]+)([.][0-9]+)?$'
    ON CONFLICT (studio_id,source_table,source_id,source_line_id) DO NOTHING
  $sql$ USING p_studio_id;
  GET DIAGNOSTICS lines_inserted=ROW_COUNT;

  -- Only executed lines with a valid execution date become PRODOTTO.
  EXECUTE $sql$
    INSERT INTO public.financial_line_events_v1(
      studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,
      operator_ref,source_table,source_id,source_line_id)
    SELECT p.studio_id,l.id,'PRODOTTO',(v.item->>'dataEsec')::date,1,1,'ORIGINAL',
      NULL,'plans',p.id::text||':produced:'||v.ordinality::text,v.ordinality::text
    FROM public.plans p
    CROSS JOIN LATERAL jsonb_array_elements(p.voci) WITH ORDINALITY v(item,ordinality)
    JOIN public.financial_contract_lines_v1 l ON l.studio_id=p.studio_id
      AND l.source_table='plans' AND l.source_id=p.id::text AND l.source_line_id=v.ordinality::text
    WHERE p.studio_id=$1 AND coalesce((v.item->>'eseguita')::boolean,false)
      AND coalesce(v.item->>'dataEsec','') ~ '^([0-9]{4})-([0-9]{2})-([0-9]{2})$'
      AND (v.item->>'dataEsec')::date::text=v.item->>'dataEsec'
    ON CONFLICT (studio_id,source_table,source_id) DO NOTHING
  $sql$ USING p_studio_id;
  GET DIAGNOSTICS produced_inserted=ROW_COUNT;

  -- No invoice/plan allocation is invented; FIFO applies only to invoice debt.
  EXECUTE $sql$
    INSERT INTO public.financial_payment_events_v1(
      studio_id,contract_id,patient_id,event_date,direction,amount,event_kind,
      reconciled,operator_ref,source_table,source_id)
    SELECT p.studio_id,NULL,p.paziente_id,p.data,1,p.importo,'PAYMENT',true,NULL,'payments',p.id::text
    FROM public.payments p WHERE p.studio_id=$1 AND lower(coalesce(p.stato,''))='pagato'
      AND p.paziente_id IS NOT NULL AND p.data IS NOT NULL AND p.importo>0
    ON CONFLICT (studio_id,source_table,source_id) DO NOTHING
  $sql$ USING p_studio_id;
  GET DIAGNOSTICS payments_inserted=ROW_COUNT;

  EXECUTE $sql$ SELECT count(*) FROM public.plans p WHERE p.studio_id=$1 AND NOT (
    p.data IS NOT NULL AND p.paziente_id IS NOT NULL AND jsonb_typeof(p.voci)='array'
    AND jsonb_array_length(p.voci)>0 AND coalesce(p.sconto,0)>=0
    AND (coalesce(p.sconto,0)=0 OR lower(coalesce(p.sconto_tipo,'')) IN ('pct','percent','fixed','fisso'))
    AND (lower(coalesce(p.sconto_tipo,'')) NOT IN ('pct','percent') OR coalesce(p.sconto,0)<=100)
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.voci) v
      WHERE coalesce(v->>'prezzo','') ~ '^([0-9]+)([.][0-9]+)?$'))
  $sql$ INTO plans_skipped USING p_studio_id;
  EXECUTE $sql$ SELECT count(*) FROM public.plans p CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.voci)='array' THEN p.voci ELSE '[]'::jsonb END) v(item)
    WHERE p.studio_id=$1 AND coalesce(v.item->>'prezzo','') !~ '^([0-9]+)([.][0-9]+)?$'
  $sql$ INTO lines_skipped USING p_studio_id;
  EXECUTE $sql$ SELECT count(*) FROM public.plans p CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.voci)='array' THEN p.voci ELSE '[]'::jsonb END) v(item)
    WHERE p.studio_id=$1 AND coalesce((v.item->>'eseguita')::boolean,false)
      AND coalesce(v.item->>'dataEsec','') !~ '^([0-9]{4})-([0-9]{2})-([0-9]{2})$'
  $sql$ INTO produced_skipped USING p_studio_id;
  EXECUTE $sql$ SELECT count(*) FROM public.payments p WHERE p.studio_id=$1 AND NOT (
    lower(coalesce(p.stato,''))='pagato' AND p.paziente_id IS NOT NULL
    AND p.data IS NOT NULL AND p.importo>0)
  $sql$ INTO payments_skipped USING p_studio_id;

  IF to_regclass('public.documenti_fiscali') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.documenti_fiscali WHERE studio_id=$1'
      INTO fiscal_documents_blocked USING p_studio_id;
  ELSE fiscal_documents_blocked:=0; END IF;
  IF to_regclass('public.pagamenti_esterni') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.pagamenti_esterni WHERE studio_id=$1'
      INTO external_payments_blocked USING p_studio_id;
  ELSE external_payments_blocked:=0; END IF;
  IF to_regclass('public.spese') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.spese WHERE studio_id=$1'
      INTO costs_blocked USING p_studio_id;
  ELSE costs_blocked:=0; END IF;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION private.run_pol_003b_legacy_adapter_v1(uuid) IS
  'Restricted idempotent adapter. Installation does not execute it; production execution requires PO approval.';
REVOKE ALL ON FUNCTION private.run_pol_003b_legacy_adapter_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
