-- POL-FIN-007: a plan's residual balance only counts as "Da incassare"
-- once it is explicitly accettato. Product Owner direction (verbatim):
-- "il nome del piano poi deve avere i tasti cancella, modifica, accetta,
-- il tasto incassato ..., non accetta (se non accettato non andrà a
-- costituire un incasso da avere)".
--
-- Confirmed explicitly with the Product Owner which of two readings to
-- implement, given the real production data distribution at the time
-- (Studio Simondi: 4 plans stato=accettato, 6 attivo/pending, 5 concluso):
-- a STRICT gate (only stato='accettato' counts) was chosen over a
-- permissive one (stato<>'rifiutato' counts) — Product Owner accepted that
-- this immediately drops "Da incassare" from the already-verified €10.997
-- (POL-FIN-005) down to whatever sum only the explicitly-accepted plans
-- account for, until plans are (re)accepted through the new UI buttons.
--
-- plans.stato is a plain existing text column (already used client-side
-- for the accettato/rifiutato/attivo badge) — no new column needed.
--
-- IMPORTANT companion fix (client-side, same PR): today the client
-- (Piani.jsx/SchedaPaz.jsx/treatmentPlanService.js) auto-overwrites
-- stato to 'concluso' the moment every voce is marked eseguita, silently
-- discarding whatever accettato/rifiutato decision was recorded before —
-- under this new gate that would make a fully-executed, previously
-- accepted plan silently drop out of "Da incassare" the instant it's
-- finished. That clobbering is removed from the client in this same
-- change; "concluso"/"terminato" becomes a purely computed display label
-- (percentage of voci eseguite) never stored back into plans.stato, so it
-- can never again overwrite an explicit acceptance decision. See the
-- component diffs, not this migration, for that part.
--
-- Scope, additive and reversible: only the two RPCs' own SELECT logic
-- changes. No table/column/RLS/policy change, no new grant. Both RPCs keep
-- every POL-FIN-006 access-control check (financial_verified_studio_
-- membership_v1, live tenant context, financial_live_data_quality_v1
-- PLAN_BALANCE gate) byte-for-byte unchanged — only the receivable
-- calculation itself is now conditioned on plan.stato.
--
-- get_saldo_piano: still returns one row per plan (so callers that check
-- "did every plan id resolve" — e.g. SchedaPaz.jsx's saldiCaricati — never
-- hang waiting on a row that will never come); saldo_piano/
-- eseguito_non_pagato are zeroed for a non-accettato plan, everything else
-- (totale_piano/totale_eseguito/totale_pagato/acconto) stays truthful —
-- acconto in particular is real money already collected and must never be
-- hidden just because the plan itself was never (yet) accepted.
--
-- get_saldi_aperti_studio: adds "AND plan.stato = 'accettato'" to its
-- existing WHERE, alongside the pre-existing saldo>0.005 filter — a
-- non-accettato plan with a real residual simply never appears in the
-- open-balances list at all (same shape change as any other filtered-out
-- fully-settled plan today).
--
-- Verified in rolled-back transactions against production before applying
-- (idklxdqebfceplrualgh), simulating a real authenticated call exactly
-- like every prior POL-FIN round this session: with the strict gate,
-- get_saldi_aperti_studio's sum dropped from the already-verified €10.997
-- to €1.500 (Studio Simondi's 4 currently-accettato plans) — the expected,
-- Product-Owner-confirmed shape of this change, not a bug; a concluso
-- plan with real historical acconto (plan 4: totale_pagato 588 vs
-- totale_piano 294, an overpayment) correctly returns saldo_piano=0
-- instead of the previous negative -294, while acconto (294) stays
-- visible and truthful.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_saldo_piano(p_piano_id bigint)
 RETURNS TABLE(piano_id bigint, totale_piano numeric, totale_eseguito numeric, totale_pagato numeric, saldo_piano numeric, eseguito_non_pagato numeric, acconto numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_studio_id uuid;
  v_stato text;
BEGIN
  SELECT p.studio_id, p.stato INTO v_studio_id, v_stato
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
    CASE WHEN v_stato = 'accettato' THEN s.totale_piano - s.totale_pagato_piano ELSE 0 END,
    CASE WHEN v_stato = 'accettato' THEN GREATEST(0, s.totale_eseguito - s.totale_pagato_piano) ELSE 0 END,
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito)
  FROM private.incassi_plan_saldo_v1 s
  WHERE s.piano_id = p_piano_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_saldi_aperti_studio(p_studio_id uuid)
 RETURNS TABLE(piano_id bigint, paziente_id bigint, data date, titolo text, totale_piano numeric, totale_eseguito numeric, totale_pagato numeric, saldo_piano numeric, eseguito_non_pagato numeric, acconto numeric, giorni_apertura integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
    AND plan.stato = 'accettato'
    AND s.totale_piano - s.totale_pagato_piano > 0.005
  ORDER BY s.totale_piano - s.totale_pagato_piano DESC;
END;
$function$;

COMMIT;
