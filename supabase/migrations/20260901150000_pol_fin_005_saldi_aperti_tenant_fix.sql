-- POL-FIN-005 fix: "Da incassare" always empty for a studio whose
-- app_metadata.studio_id claim doesn't match the strict UUID-version/
-- variant regex private.financial_current_studio_v1() requires (e.g. the
-- legacy '00000000-0000-0000-0000-000000000001' studio id — version
-- nibble '0', not 1-5, so the regex added by 20260821120000_pol_003a_
-- tenant_access_fix.sql rejects it outright).
--
-- Root cause: public.get_saldi_aperti_studio(p_studio_id) already receives
-- a caller-supplied p_studio_id (Incassi.jsx passes the session's own
-- studio_id), but calls private.financial_has_tenant_access_v1(p_studio_id)
-- directly. That function's own body re-derives the "current studio"
-- purely from the JWT via private.financial_current_studio_v1() and
-- compares it to p_studio_id — so it never actually trusts the value this
-- RPC was given; it only trusts what it can independently extract from the
-- JWT through the regex-gated path. When that regex rejects the claim
-- (this studio, always), the comparison can never succeed, so the RPC
-- silently returns zero rows for every caller regardless of real
-- membership or real open balances (confirmed directly against
-- private.incassi_plan_saldo_v1: ~11,000€ in genuinely open balances for
-- this studio today).
--
-- This is the exact class of bug 20260821120000_pol_003a_tenant_access_fix
-- already solved for get_financial_drilldown_v1/get_financial_snapshot_v1
-- — which is why Controllo di gestione's other figures (Prodotto,
-- Incassato, EBITDA...) were unaffected: those two RPCs already verify a
-- caller-supplied p_studio_id independently (via
-- private.financial_verified_studio_membership_v1, a plain studio_users
-- active-membership check with no JWT/regex dependency) and set a
-- transaction-local override that financial_current_studio_v1() prefers
-- over the regex path. get_saldi_aperti_studio (POL-FIN-002/003) predates
-- that fix and was never updated to use the same mechanism.
--
-- Fix: give get_saldi_aperti_studio the identical verify-then-override
-- pattern, reusing private.financial_verified_studio_membership_v1
-- unchanged (no new authorization surface, no regex touched, no RLS
-- policy touched — zero blast radius on tenant isolation, which is the
-- same reasoning 20260821120000 already applied and got right).
BEGIN;

CREATE OR REPLACE FUNCTION public.get_saldi_aperti_studio(p_studio_id uuid)
RETURNS TABLE(
  piano_id bigint, paziente_id bigint, data date, titolo text,
  totale_piano numeric, totale_eseguito numeric, totale_pagato numeric,
  saldo_piano numeric, eseguito_non_pagato numeric, acconto numeric,
  giorni_apertura integer
)
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_studio_id uuid;
BEGIN
  IF p_studio_id IS NOT NULL THEN
    IF NOT private.financial_verified_studio_membership_v1(p_studio_id) THEN
      RAISE EXCEPTION 'POL-FIN-005: access denied';
    END IF;
    PERFORM set_config('request.financial_studio_override_v1', p_studio_id::text, true);
  ELSE
    PERFORM set_config('request.financial_studio_override_v1', '', true);
  END IF;
  v_studio_id := private.financial_current_studio_v1();
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-FIN-005: access denied';
  END IF;

  RETURN QUERY
  SELECT s.piano_id, s.paziente_id, s.data, pl.titolo,
    s.totale_piano, s.totale_eseguito, s.totale_pagato_piano,
    s.totale_piano - s.totale_pagato_piano AS saldo_piano,
    GREATEST(0, s.totale_eseguito - s.totale_pagato_piano) AS eseguito_non_pagato,
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito) AS acconto,
    GREATEST(0, (CURRENT_DATE - s.data))::integer AS giorni_apertura
  FROM private.incassi_plan_saldo_v1 s
  JOIN public.plans pl ON pl.id = s.piano_id
  WHERE s.studio_id = v_studio_id
    AND (s.totale_piano - s.totale_pagato_piano) > 0.005
  ORDER BY (s.totale_piano - s.totale_pagato_piano) DESC;
END;
$function$;

COMMENT ON FUNCTION public.get_saldi_aperti_studio(uuid) IS
  'POL-FIN-002/003, tenant-access fixed by POL-FIN-005: one row per plan with saldo_piano > 0 for the given, independently-verified studio. Verifies p_studio_id via private.financial_verified_studio_membership_v1 (real studio_users membership, no JWT/regex dependency) before trusting it — same pattern as get_financial_drilldown_v1/get_financial_snapshot_v1 (20260821120000_pol_003a_tenant_access_fix.sql). Powers the Incassi open-balance worklist.';

COMMIT;
