-- POL-003A fix: "access denied" false negative for authorized owner/admin users.
--
-- Root cause: private.financial_current_studio_v1() resolves the tenant
-- EXCLUSIVELY from the caller's JWT app_metadata.studio_id claim, with no
-- fallback. get_financial_drilldown_v1/get_financial_snapshot_v1 derive
-- v_studio_id from that function alone, so when the claim is missing or
-- stale for an otherwise-active studio_users member (a gap the rest of the
-- app already tolerates — see src/lib/supabase.js's client-side studio_id
-- fallback), the RPCs raise 'POL-003A: access denied' even for a
-- legitimate owner/admin.
--
-- First attempt (superseded by this file, never shipped): loosen
-- private.financial_has_tenant_access_v1 itself to drop the JWT match and
-- rely on studio_users membership alone. That function also backs the RLS
-- SELECT policies on the eight financial_*_v1 tables, called per-row as
-- financial_has_tenant_access_v1(row.studio_id) with no caller-supplied
-- "intended studio" signal — the JWT claim is the ONLY thing that scopes an
-- unscoped `SELECT * FROM financial_contracts_v1` to one tenant for a
-- multi-studio staff member. Loosening it there let such a user see rows
-- from every studio they belong to at once, confirmed by a real regression
-- in supabase/tests/pol_003_financial_engine.sql's two-tenant isolation
-- assertion (unscoped SELECT count(*) FROM financial_contracts_v1 must
-- return exactly 1, scoped to the session's current studio). Rejected.
--
-- Actual fix: leave private.financial_has_tenant_access_v1 and every RLS
-- policy byte-for-byte unchanged (zero blast radius on existing tenant
-- isolation). Instead, let the two RPCs accept an optional, caller-supplied
-- p_studio_id; once they independently verify (via a new, narrowly-scoped
-- membership check mirroring has_studio_capability_v1's pattern — no JWT
-- dependency) that the caller has active studio_users membership for that
-- exact studio, they set a transaction-local override that
-- financial_current_studio_v1() now also consults. This makes the
-- RPC's own gate AND every RLS-protected table read inside it agree on the
-- SAME, independently-verified studio_id for the lifetime of that one
-- transaction — nothing else on the connection is affected, and callers
-- that never pass p_studio_id see byte-identical JWT-only behavior.
BEGIN;

-- Additive: financial_current_studio_v1 now prefers a transaction-local
-- override (set only by the two RPCs below, only after they've verified
-- real studio_users membership) and falls back to the existing JWT-only
-- resolution when no override is set. No signature change.
CREATE OR REPLACE FUNCTION private.financial_current_studio_v1()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
  SELECT COALESCE(
    NULLIF(current_setting('request.financial_studio_override_v1', true), '')::uuid,
    CASE
      WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (auth.jwt() -> 'app_metadata' ->> 'studio_id')::uuid
      ELSE NULL
    END
  );
$function$;

-- New, narrow authorization check used only to accept a caller-supplied
-- p_studio_id: same fail-closed studio_users active-membership boundary as
-- public.has_studio_capability_v1 (POL-RBAC-001), no JWT dependency. This
-- does NOT replace or weaken financial_has_tenant_access_v1 — it only
-- gates whether a caller is allowed to name their own "current studio" for
-- one RPC call.
CREATE OR REPLACE FUNCTION private.financial_verified_studio_membership_v1(p_studio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT auth.uid() IS NOT NULL
    AND p_studio_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.studio_users su
      WHERE su.user_id = auth.uid() AND su.studio_id = p_studio_id AND su.stato = 'attivo'
    );
$function$;
REVOKE ALL ON FUNCTION private.financial_verified_studio_membership_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.financial_verified_studio_membership_v1(uuid) TO authenticated;

-- Adding p_studio_id changes the declared argument types, so CREATE OR
-- REPLACE would create a second, ambiguous overload instead of replacing
-- the function (Postgres matches by exact arg-type list, not by name +
-- defaults). Drop the old exact signatures first so 2/3-arg callers
-- unambiguously resolve to the new function with its default applied.
DROP FUNCTION IF EXISTS public.get_financial_drilldown_v1(date,date,text);
DROP FUNCTION IF EXISTS public.get_financial_snapshot_v1(date,date);

CREATE FUNCTION public.get_financial_drilldown_v1(
  p_data_inizio date,p_data_fine date,p_metric text,p_studio_id uuid DEFAULT NULL
) RETURNS TABLE (
  metric text,source_kind text,source_table text,source_id text,source_line_id text,
  patient_id bigint,operator_ref text,event_date date,amount numeric,formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_studio_id uuid;
  v_stock_metric text:=regexp_replace(p_metric,'_(APERTURA|MOVIMENTI|CHIUSURA)$','');
  v_stock_mode text:=CASE
    WHEN p_metric LIKE '%_APERTURA' THEN 'APERTURA'
    WHEN p_metric LIKE '%_MOVIMENTI' THEN 'MOVIMENTI'
    ELSE 'CHIUSURA'
  END;
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio>p_data_fine THEN
    RAISE EXCEPTION 'POL-003A: invalid period';
  END IF;

  -- request.financial_studio_override_v1 is a transaction-local (not
  -- call-local) GUC: a bare SET LOCAL made here would otherwise still be
  -- visible to any later, unrelated statement sharing this transaction.
  -- Every call fully determines the override for itself — set it when an
  -- explicit, verified p_studio_id is given, otherwise clear whatever a
  -- prior call in the same transaction may have left behind — so callers
  -- that omit p_studio_id always get pure JWT-only resolution, never a
  -- leaked studio from an earlier explicit call.
  IF p_studio_id IS NOT NULL THEN
    IF NOT private.financial_verified_studio_membership_v1(p_studio_id) THEN
      RAISE EXCEPTION 'POL-003A: access denied';
    END IF;
    PERFORM set_config('request.financial_studio_override_v1',p_studio_id::text,true);
  ELSE
    PERFORM set_config('request.financial_studio_override_v1','',true);
  END IF;
  v_studio_id:=private.financial_current_studio_v1();
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN RAISE EXCEPTION 'POL-003A: access denied'; END IF;

  IF p_metric IN ('PREVENTIVATO','PREVENTIVATO_LORDO','SCONTO') THEN
    RETURN QUERY SELECT p_metric,'CONTRACT_LINE',v.source_table,v.source_id,v.source_line_id,
      v.patient_id,v.operator_ref,v.proposal_date,
      CASE p_metric WHEN 'PREVENTIVATO_LORDO' THEN v.gross_amount WHEN 'SCONTO' THEN v.allocated_discount ELSE v.net_amount END,
      'POL-003A-v1'
    FROM private.financial_line_values_v1 v WHERE v.studio_id=v_studio_id
      AND v.proposal_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('ACCETTATO','PRODOTTO') THEN
    RETURN QUERY SELECT p_metric,'LINE_EVENT',e.source_table,e.source_id,e.source_line_id,v.patient_id,
      COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
    FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
      ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
    WHERE e.studio_id=v_studio_id AND e.stage=p_metric AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('FATTURATO_NETTO_IVA','FATTURATO_IVA','FATTURATO_LORDO') THEN
    RETURN QUERY SELECT p_metric,'INVOICE_EVENT',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
      CASE p_metric WHEN 'FATTURATO_NETTO_IVA' THEN e.taxable_amount WHEN 'FATTURATO_IVA' THEN e.vat_amount ELSE e.gross_document_amount END*e.direction,
      'POL-003A-v1'
    FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric='INCASSATO' THEN
    RETURN QUERY SELECT p_metric,'PAYMENT_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
      e.amount*e.direction,'POL-003A-v1'
    FROM public.financial_payment_events_v1 e WHERE e.studio_id=v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (e.event_kind<>'EXTERNAL_PAYMENT' OR e.reconciled);
  ELSIF p_metric='INCASSATO_ALLOCATO' THEN
    RETURN QUERY SELECT p_metric,'PAYMENT_ALLOCATION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
      a.signed_amount,'POL-003A-v1'
    FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id
      AND a.payment_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF v_stock_metric IN ('PORTAFOGLIO_DA_ESEGUIRE','PRODOTTO_DA_FATTURARE','CREDITO_CLIENTI','SALDO_INCASSI_NON_ALLOCATO') THEN
    IF v_stock_metric='PORTAFOGLIO_DA_ESEGUIRE' THEN
      RETURN QUERY SELECT p_metric,'ACCEPTED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='ACCETTATO' AND (
        (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
      RETURN QUERY SELECT p_metric,'PRODUCED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,-v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='PRODOTTO' AND (
        (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
    ELSIF v_stock_metric='PRODOTTO_DA_FATTURARE' THEN
      RETURN QUERY SELECT p_metric,'PRODUCED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='PRODOTTO' AND (
        (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
      RETURN QUERY SELECT p_metric,'INVOICED_STOCK',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
        -e.taxable_amount*e.direction,'POL-003A-v1'
      FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id AND (
        (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
    ELSIF v_stock_metric='CREDITO_CLIENTI' THEN
      RETURN QUERY SELECT p_metric,'INVOICE_RECEIVABLE',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
        e.gross_document_amount*e.direction,'POL-003A-v1'
      FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id AND (
        (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
      RETURN QUERY SELECT p_metric,'ALLOCATED_COLLECTION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
        -a.signed_amount,'POL-003A-v1'
      FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id AND (
        (v_stock_mode='APERTURA' AND a.payment_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND a.payment_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND a.payment_date<=p_data_fine));
    ELSE
      RETURN QUERY SELECT p_metric,'PAYMENT_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
        e.amount*e.direction,'POL-003A-v1'
      FROM public.financial_payment_events_v1 e WHERE e.studio_id=v_studio_id
        AND (e.event_kind<>'EXTERNAL_PAYMENT' OR e.reconciled) AND (
          (v_stock_mode='APERTURA' AND e.event_date<p_data_inizio)
          OR (v_stock_mode='MOVIMENTI' AND e.event_date BETWEEN p_data_inizio AND p_data_fine)
          OR (v_stock_mode='CHIUSURA' AND e.event_date<=p_data_fine));
      RETURN QUERY SELECT p_metric,'ALLOCATED_COLLECTION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
        -a.signed_amount,'POL-003A-v1'
      FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id AND (
        (v_stock_mode='APERTURA' AND a.payment_date<p_data_inizio)
        OR (v_stock_mode='MOVIMENTI' AND a.payment_date BETWEEN p_data_inizio AND p_data_fine)
        OR (v_stock_mode='CHIUSURA' AND a.payment_date<=p_data_fine));
    END IF;
  ELSIF p_metric IN ('COSTI_PREVISTI','COSTI_IMPEGNATI','COSTI_VARIABILI','COSTI_FISSI_OPERATIVI','COSTI_STRUTTURA_OPERATIVI','COSTI_OPERATORE') THEN
    RETURN QUERY SELECT p_metric,'COST_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
      e.amount*e.direction,'POL-003A-v1'
    FROM public.financial_cost_events_v1 e WHERE e.studio_id=v_studio_id AND e.event_date BETWEEN p_data_inizio AND p_data_fine AND (
      (p_metric='COSTI_PREVISTI' AND e.stage='PREVISTO') OR
      (p_metric='COSTI_IMPEGNATI' AND e.stage='IMPEGNATO') OR
      (p_metric='COSTI_VARIABILI' AND e.stage='SOSTENUTO' AND e.classification='VARIABILE_ATTRIBUIBILE') OR
      (p_metric='COSTI_FISSI_OPERATIVI' AND e.stage='SOSTENUTO' AND e.classification='FISSO_OPERATIVO') OR
      (p_metric='COSTI_STRUTTURA_OPERATIVI' AND e.stage='SOSTENUTO'
        AND e.classification='FISSO_OPERATIVO') OR
      (p_metric='COSTI_OPERATORE' AND e.stage='SOSTENUTO' AND e.cost_scope='OPERATOR'
        AND e.classification IN ('VARIABILE_ATTRIBUIBILE','FISSO_OPERATIVO'))
    );
  ELSIF p_metric IN ('ORE_DISPONIBILI','ORE_EFFETTIVE') THEN
    RETURN QUERY SELECT p_metric,'HOURS',e.source_table,e.source_id,NULL::text,NULL::bigint,e.operator_ref,e.event_date,e.hours,'POL-003A-v1'
    FROM public.financial_hours_v1 e WHERE e.studio_id=v_studio_id AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND ((p_metric='ORE_DISPONIBILI' AND e.hour_kind='AVAILABLE' AND e.scope='STRUCTURE')
        OR (p_metric='ORE_EFFETTIVE' AND e.hour_kind='WORKED'));
  ELSIF p_metric IN ('MARGINE_CONTRIBUZIONE','EBITDA_OPERATIVO_GESTIONALE') THEN
    RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,d.amount,d.formula_version
      FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO',v_studio_id) d;
    RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,-d.amount,d.formula_version
      FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_VARIABILI',v_studio_id) d;
    IF p_metric='EBITDA_OPERATIVO_GESTIONALE' THEN
      RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,-d.amount,d.formula_version
        FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_FISSI_OPERATIVI',v_studio_id) d;
    END IF;
  ELSE RAISE EXCEPTION 'POL-003A: unsupported metric %',p_metric;
  END IF;
END;
$function$;

CREATE FUNCTION public.get_financial_snapshot_v1(p_data_inizio date,p_data_fine date,p_studio_id uuid DEFAULT NULL)
RETURNS TABLE (
  preventivato numeric,preventivato_lordo numeric,sconto numeric,accettato numeric,prodotto numeric,
  fatturato_netto_iva numeric,fatturato_iva numeric,fatturato_lordo numeric,
  incassato numeric,incassato_allocato numeric,portafoglio_da_eseguire numeric,
  prodotto_da_fatturare numeric,credito_clienti numeric,saldo_incassi_non_allocato numeric,
  portafoglio_da_eseguire_apertura numeric,portafoglio_da_eseguire_movimenti numeric,portafoglio_da_eseguire_chiusura numeric,
  prodotto_da_fatturare_apertura numeric,prodotto_da_fatturare_movimenti numeric,prodotto_da_fatturare_chiusura numeric,
  credito_clienti_apertura numeric,credito_clienti_movimenti numeric,credito_clienti_chiusura numeric,
  saldo_incassi_non_allocato_apertura numeric,saldo_incassi_non_allocato_movimenti numeric,saldo_incassi_non_allocato_chiusura numeric,
  costi_previsti numeric,costi_impegnati numeric,costi_fissi_operativi numeric,costi_variabili numeric,
  margine_contribuzione numeric,margine_contribuzione_pct numeric,ebitda_operativo_gestionale numeric,
  break_even numeric,break_even_raggiunto boolean,ore_produttive_disponibili numeric,
  ore_effettivamente_lavorate numeric,costo_orario_struttura numeric,produzione_ora numeric,incasso_ora numeric,
  data_quality_status text,formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_preventivato numeric;v_lordo numeric;v_sconto numeric;v_accettato numeric;v_prodotto numeric;
  v_fatt_net numeric;v_fatt_iva numeric;v_fatt_lordo numeric;v_incassato numeric;v_allocato numeric;
  v_portafoglio numeric;v_da_fatturare numeric;v_credito numeric;v_non_allocato numeric;
  v_portafoglio_apertura numeric;v_portafoglio_movimenti numeric;
  v_da_fatturare_apertura numeric;v_da_fatturare_movimenti numeric;
  v_credito_apertura numeric;v_credito_movimenti numeric;
  v_non_allocato_apertura numeric;v_non_allocato_movimenti numeric;
  v_previsti numeric;v_impegnati numeric;v_fissi numeric;v_variabili numeric;v_margine numeric;v_ebitda numeric;
  v_costi_struttura numeric;v_ore_disponibili numeric;v_ore_effettive numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_preventivato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PREVENTIVATO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_lordo FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PREVENTIVATO_LORDO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_sconto FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SCONTO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_accettato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ACCETTATO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_prodotto FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_net FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_NETTO_IVA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_iva FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_IVA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_lordo FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_LORDO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_incassato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'INCASSATO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_allocato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'INCASSATO_ALLOCATO',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_portafoglio_apertura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PORTAFOGLIO_DA_ESEGUIRE_APERTURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_portafoglio_movimenti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PORTAFOGLIO_DA_ESEGUIRE_MOVIMENTI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_portafoglio FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PORTAFOGLIO_DA_ESEGUIRE_CHIUSURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_da_fatturare_apertura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO_DA_FATTURARE_APERTURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_da_fatturare_movimenti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO_DA_FATTURARE_MOVIMENTI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_da_fatturare FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO_DA_FATTURARE_CHIUSURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_credito_apertura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'CREDITO_CLIENTI_APERTURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_credito_movimenti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'CREDITO_CLIENTI_MOVIMENTI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_credito FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'CREDITO_CLIENTI_CHIUSURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_non_allocato_apertura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SALDO_INCASSI_NON_ALLOCATO_APERTURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_non_allocato_movimenti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SALDO_INCASSI_NON_ALLOCATO_MOVIMENTI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_non_allocato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SALDO_INCASSI_NON_ALLOCATO_CHIUSURA',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_previsti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_PREVISTI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_impegnati FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_IMPEGNATI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_fissi FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_FISSI_OPERATIVI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_variabili FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_VARIABILI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_costi_struttura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_STRUTTURA_OPERATIVI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_ore_disponibili FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ORE_DISPONIBILI',p_studio_id);
  SELECT COALESCE(SUM(amount),0) INTO v_ore_effettive FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ORE_EFFETTIVE',p_studio_id);
  v_margine:=v_prodotto-v_variabili;v_ebitda:=v_margine-v_fissi;
  RETURN QUERY SELECT v_preventivato,v_lordo,v_sconto,v_accettato,v_prodotto,
    v_fatt_net,v_fatt_iva,v_fatt_lordo,v_incassato,v_allocato,v_portafoglio,v_da_fatturare,v_credito,v_non_allocato,
    v_portafoglio_apertura,v_portafoglio_movimenti,v_portafoglio,
    v_da_fatturare_apertura,v_da_fatturare_movimenti,v_da_fatturare,
    v_credito_apertura,v_credito_movimenti,v_credito,
    v_non_allocato_apertura,v_non_allocato_movimenti,v_non_allocato,
    v_previsti,v_impegnati,v_fissi,v_variabili,v_margine,
    CASE WHEN v_prodotto=0 THEN NULL ELSE v_margine/v_prodotto*100 END,v_ebitda,
    CASE WHEN v_prodotto>0 AND v_margine>0 THEN v_fissi/(v_margine/v_prodotto) ELSE NULL END,
    CASE WHEN v_prodotto>0 AND v_margine>0 THEN v_prodotto>=v_fissi/(v_margine/v_prodotto) ELSE NULL END,
    v_ore_disponibili,v_ore_effettive,
    CASE WHEN v_ore_disponibili=0 THEN NULL ELSE v_costi_struttura/v_ore_disponibili END,
    CASE WHEN v_ore_effettive=0 THEN NULL ELSE v_prodotto/v_ore_effettive END,
    CASE WHEN v_ore_effettive=0 THEN NULL ELSE v_incassato/v_ore_effettive END,
    'PO_SEMANTICS_LOCKED_LEGACY_ADAPTER_PENDING','POL-003A-v1';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) TO authenticated;
COMMENT ON FUNCTION public.get_financial_snapshot_v1(date,date,uuid) IS
  'POL-003A-v1 PO-locked canonical snapshot. Stock metrics are cumulative through p_data_fine. p_studio_id is optional (defaults to the JWT app_metadata.studio_id claim) for backward compatibility; callers should pass it explicitly (POL-003A fix) once they have a verified studio_users membership for it.';
COMMENT ON FUNCTION public.get_financial_drilldown_v1(date,date,text,uuid) IS
  'POL-003A-v1 tenant-safe source drilldown; quote_basis and credit_basis were removed. p_studio_id is optional (defaults to the JWT app_metadata.studio_id claim) for backward compatibility; callers should pass it explicitly (POL-003A fix) once they have a verified studio_users membership for it.';

COMMIT;
