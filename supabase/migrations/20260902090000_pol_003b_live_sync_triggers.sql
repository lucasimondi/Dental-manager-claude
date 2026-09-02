-- POL-003B live sync: keep the canonical financial engine's PRODOTTO and
-- PAYMENT events up to date automatically, instead of only via a manually
-- gated batch backfill (private.run_pol_003b_legacy_adapter_v1, applied
-- once in production on 2026-08-19 and re-run for catch-up immediately
-- before this migration — see docs/coordination/handoffs.md for the
-- reconciliation evidence of that catch-up run).
--
-- Reuses the EXACT same eligibility/mapping rules as that already-reviewed,
-- already-locally-validated adapter (docs/architecture/pol-003b-*.md),
-- scoped to one row (NEW.id) instead of a whole studio, and relying on the
-- SAME idempotent ON CONFLICT DO NOTHING keys — so calling this on every
-- plans/payments write is safe: it only ever inserts rows that don't exist
-- yet, exactly like re-running the batch adapter would.
--
-- Deliberately out of scope, unchanged from the existing lock:
-- - ACCETTATO: still not backfilled/derived here (historical acceptance
--   dates remain APPROXIMATION_NOT_ALLOWED per pol-003b-legacy-source-
--   mapping.md; capturing a true "accepted today" event going forward is a
--   separate, new semantic decision not made yet, not invented here).
-- - FATTURATO/invoice events, external payments (pagamenti_esterni),
--   historical costs/hours/operator attribution: all remain blocked, same
--   as the batch adapter and the same reasons already documented.
-- - No reversal/negative-event logic: if eseguita flips back to false or a
--   price/date is edited after the event was recorded, the original event
--   is left untouched (ON CONFLICT DO NOTHING) — POL-003A's own semantics
--   require reversals to be explicit new negative events in their own
--   period, never a silent rewrite of a prior event; that is future work,
--   not attempted here.
--
-- Verified before and after applying to production (idklxdqebfceplrualgh):
-- tested inside a rolled-back transaction (contract/line/produced-event/
-- payment-event all created correctly; a second UPDATE on the same plan
-- created no duplicates; an ineligible zero-voci plan was skipped without
-- error); after applying for real, re-ran the batch adapter and it found
-- zero new rows to insert (the triggers already cover everything);
-- get_advisors(security) unchanged at 54 findings (52 WARN + 2 INFO),
-- zero new, nothing mentioning these functions.
BEGIN;

CREATE OR REPLACE FUNCTION private.sync_pol_003b_plan_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.financial_contracts_v1(
    studio_id,patient_id,proposal_date,discount_kind,discount_value,source_table,source_id)
  SELECT p.studio_id,p.paziente_id,p.data,
    CASE lower(coalesce(p.sconto_tipo,''))
      WHEN 'pct' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'PERCENT' END
      WHEN 'percent' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'PERCENT' END
      WHEN 'fixed' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'FIXED' END
      WHEN 'fisso' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'FIXED' END
      WHEN 'eur' THEN CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE 'FIXED' END
      ELSE CASE WHEN coalesce(p.sconto,0)=0 THEN 'NONE' ELSE NULL END END,
    coalesce(p.sconto,0),'plans',p.id::text
  FROM public.plans p
  WHERE p.id = NEW.id AND p.data IS NOT NULL AND p.paziente_id IS NOT NULL
    AND jsonb_typeof(p.voci)='array' AND jsonb_array_length(p.voci)>0
    AND coalesce(p.sconto,0)>=0
    AND (coalesce(p.sconto,0)=0 OR lower(coalesce(p.sconto_tipo,'')) IN ('pct','percent','fixed','fisso','eur'))
    AND (lower(coalesce(p.sconto_tipo,'')) NOT IN ('pct','percent') OR coalesce(p.sconto,0)<=100)
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.voci) v
      WHERE coalesce(v->>'prezzo','') ~ '^([0-9]+)([.][0-9]+)?$')
  ON CONFLICT (studio_id,source_table,source_id) DO NOTHING;

  INSERT INTO public.financial_contract_lines_v1(
    studio_id,contract_id,patient_id,service_ref,operator_ref,gross_amount,
    source_table,source_id,source_line_id)
  SELECT p.studio_id,c.id,p.paziente_id,nullif(v.item->>'prestazione',''),NULL,
    (v.item->>'prezzo')::numeric,'plans',p.id::text,v.ordinality::text
  FROM public.plans p
  JOIN public.financial_contracts_v1 c ON c.studio_id=p.studio_id
    AND c.source_table='plans' AND c.source_id=p.id::text
  CROSS JOIN LATERAL jsonb_array_elements(p.voci) WITH ORDINALITY v(item,ordinality)
  WHERE p.id = NEW.id AND coalesce(v.item->>'prezzo','') ~ '^([0-9]+)([.][0-9]+)?$'
  ON CONFLICT (studio_id,source_table,source_id,source_line_id) DO NOTHING;

  INSERT INTO public.financial_line_events_v1(
    studio_id,contract_line_id,stage,event_date,direction,fraction,event_kind,
    operator_ref,source_table,source_id,source_line_id)
  SELECT p.studio_id,l.id,'PRODOTTO',(v.item->>'dataEsec')::date,1,1,'ORIGINAL',
    NULL,'plans',p.id::text||':produced:'||v.ordinality::text,v.ordinality::text
  FROM public.plans p
  CROSS JOIN LATERAL jsonb_array_elements(p.voci) WITH ORDINALITY v(item,ordinality)
  JOIN public.financial_contract_lines_v1 l ON l.studio_id=p.studio_id
    AND l.source_table='plans' AND l.source_id=p.id::text AND l.source_line_id=v.ordinality::text
  WHERE p.id = NEW.id AND coalesce((v.item->>'eseguita')::boolean,false)
    AND coalesce(v.item->>'dataEsec','') ~ '^([0-9]{4})-([0-9]{2})-([0-9]{2})$'
    AND (v.item->>'dataEsec')::date::text=v.item->>'dataEsec'
  ON CONFLICT (studio_id,source_table,source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION private.sync_pol_003b_plan_v1() IS
  'POL-003B live sync: on every plans insert/update, idempotently ensures the canonical contract/lines/PRODOTTO events for that one plan exist, using the exact same eligibility rules as private.run_pol_003b_legacy_adapter_v1. SECURITY DEFINER so it can write financial_*_v1 rows regardless of the acting role''s own grants there; scoped to NEW.id only, no dynamic SQL, no user-controlled search_path.';

DROP TRIGGER IF EXISTS pol_003b_sync_plan_trg ON public.plans;
CREATE TRIGGER pol_003b_sync_plan_trg
AFTER INSERT OR UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION private.sync_pol_003b_plan_v1();

CREATE OR REPLACE FUNCTION private.sync_pol_003b_payment_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.financial_payment_events_v1(
    studio_id,contract_id,patient_id,event_date,direction,amount,event_kind,
    reconciled,operator_ref,source_table,source_id)
  SELECT p.studio_id,NULL,p.paziente_id,p.data,1,p.importo,'PAYMENT',true,NULL,'payments',p.id::text
  FROM public.payments p WHERE p.id = NEW.id AND lower(coalesce(p.stato,''))='pagato'
    AND p.paziente_id IS NOT NULL AND p.data IS NOT NULL AND p.importo>0
  ON CONFLICT (studio_id,source_table,source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION private.sync_pol_003b_payment_v1() IS
  'POL-003B live sync: on every payments insert/update, idempotently ensures a canonical PAYMENT event exists for that one settled (stato=pagato) payment, using the exact same rule as private.run_pol_003b_legacy_adapter_v1. SECURITY DEFINER, scoped to NEW.id only.';

DROP TRIGGER IF EXISTS pol_003b_sync_payment_trg ON public.payments;
CREATE TRIGGER pol_003b_sync_payment_trg
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.sync_pol_003b_payment_v1();

COMMIT;
