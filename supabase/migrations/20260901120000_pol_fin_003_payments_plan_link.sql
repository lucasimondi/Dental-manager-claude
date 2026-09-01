-- POL-FIN-003 — payments.piano_id: explicit payment→plan link, replacing the
-- FIFO-by-plan-date allocation POL-FIN-002 (PR #75) used to spread a
-- patient's payments across their plans (validated only on synthetic data,
-- never on a real partially-paid multi-plan patient — see
-- claude/piano-collegamento-pagamenti-piano.md sections 1-7).
--
-- Additive only. payments gains a nullable piano_id FK to plans.
-- NOTE: the plan doc's own SQL sketch (§3) wrote `piano_id uuid REFERENCES
-- public.plans(id)`. Checked against the real production schema
-- (information_schema.columns on project idklxdqebfceplrualgh):
-- public.plans.id is `bigint`, not `uuid` — the doc's type was a typo. This
-- migration uses `bigint`, matching plans.id and the existing
-- get_saldo_piano(bigint)/get_saldi_aperti_studio(uuid) RPC signatures.
--
-- RLS on payments/plans is unchanged (both remain studio-scoped by their
-- existing *_studio policies, ALL command, studio_id = jwt claim) — the new
-- column carries no new cross-studio access; get_advisors(security) is
-- re-run after this migration for explicit confirmation regardless.
--
-- Historical payments belonging to a patient who has more than one plan are
-- deliberately left piano_id = NULL (backfill below only resolves the
-- unambiguous single-plan case) and are excluded from get_saldo_piano/
-- get_saldi_aperti_studio (both now sum only WHERE piano_id = the plan in
-- question) rather than guessed at. No new RPC is added to list them: the
-- "Pagamenti da assegnare" worklist (src/components/Incassi.jsx) derives
-- them client-side from the same patients/plans/payments arrays the app
-- already loads in full per studio (RLS-scoped), the same way this page's
-- existing "Incassato" KPI already filters the loaded payments array
-- locally — no new query surface, nothing server-side to review beyond
-- this migration.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.payments') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments'
      AND column_name IN ('id','studio_id','paziente_id','importo','stato')
    GROUP BY table_schema, table_name HAVING count(*) = 5
  ) THEN
    RAISE EXCEPTION 'POL-FIN-003 preflight: public.payments(id,studio_id,paziente_id,importo,stato) is required';
  END IF;
  IF to_regclass('public.plans') IS NULL THEN
    RAISE EXCEPTION 'POL-FIN-003 preflight: public.plans is required';
  END IF;
  IF to_regclass('private.incassi_plan_totals_v1') IS NULL THEN
    RAISE EXCEPTION 'POL-FIN-003 preflight: private.incassi_plan_totals_v1 (POL-FIN-002) is required';
  END IF;
  IF to_regprocedure('private.financial_has_tenant_access_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'POL-FIN-003 preflight: private.financial_has_tenant_access_v1(uuid) (POL-003A) is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='piano_id'
  ) THEN
    RAISE EXCEPTION 'POL-FIN-003 preflight: public.payments.piano_id already exists';
  END IF;
END
$preflight$;

-- 1. Schema: nullable FK, bigint (see note above).
ALTER TABLE public.payments ADD COLUMN piano_id bigint REFERENCES public.plans(id);
CREATE INDEX IF NOT EXISTS payments_piano_id_idx ON public.payments(piano_id);

COMMENT ON COLUMN public.payments.piano_id IS
  'POL-FIN-003: explicit link to the plan this payment was collected against. Nullable — NULL means unresolved (patient had >1 plan when this payment predates the column, or a write path left it unassigned). Excluded from get_saldo_piano/get_saldi_aperti_studio until assigned; surfaced by get_pagamenti_da_assegnare.';

-- 2. Backfill: only unambiguous single-plan patients (any plan stato — this
--    is about resolving ambiguity, not plan lifecycle). A patient with more
--    than one plan is left untouched; those payments surface in
--    public.get_pagamenti_da_assegnare below, for manual assignment. No
--    payment row is deleted or its importo/stato/paziente_id touched.
WITH single_plan_patients AS (
  SELECT studio_id, paziente_id, MIN(id) AS only_plan_id
  FROM public.plans
  GROUP BY studio_id, paziente_id
  HAVING COUNT(*) = 1
)
UPDATE public.payments p
SET piano_id = spp.only_plan_id
FROM single_plan_patients spp
WHERE p.studio_id = spp.studio_id
  AND p.paziente_id = spp.paziente_id
  AND p.piano_id IS NULL;

-- 3. get_saldo_piano/get_saldi_aperti_studio (POL-FIN-002): replace the
--    FIFO-by-plan-date allocation with a direct sum of payments.importo
--    WHERE piano_id = plan.id AND stato = 'pagato'. Both RPCs' signatures
--    and bodies are unchanged (still SECURITY INVOKER, empty search_path,
--    unchanged tenant guard) — only the private view they read from
--    changes shape, so this is transparent to every existing caller.
CREATE OR REPLACE VIEW private.incassi_plan_saldo_v1 WITH (security_invoker=true) AS
SELECT t.piano_id, t.studio_id, t.paziente_id, t.data, t.totale_piano, t.totale_eseguito,
  COALESCE(paid.totale_pagato_piano, 0) AS totale_pagato_piano
FROM private.incassi_plan_totals_v1 t
LEFT JOIN (
  SELECT piano_id, SUM(importo) AS totale_pagato_piano
  FROM public.payments
  WHERE piano_id IS NOT NULL AND lower(coalesce(stato, '')) = 'pagato'
  GROUP BY piano_id
) paid ON paid.piano_id = t.piano_id;

REVOKE ALL ON TABLE private.incassi_plan_saldo_v1 FROM PUBLIC, anon;
GRANT SELECT ON TABLE private.incassi_plan_saldo_v1 TO authenticated;

-- private.incassi_patient_paid_v1 (POL-FIN-002's patient-level paid total —
-- the input to the removed FIFO allocation) is dead: nothing reads it
-- anymore now that incassi_plan_saldo_v1 sums payments directly by piano_id.
DROP VIEW IF EXISTS private.incassi_patient_paid_v1;

COMMIT;

-- Reversal: restore private.incassi_plan_saldo_v1's prior FIFO-by-plan-date
-- definition and private.incassi_patient_paid_v1 from supabase/migrations/
-- 20260829180000_pol_fin_002_incassi_saldo_piano.sql; DROP INDEX
-- payments_piano_id_idx; ALTER TABLE public.payments DROP COLUMN piano_id.
-- The backfill UPDATE itself needs no separate reversal — dropping the
-- column removes the link along with it, no payment row/importo/stato is
-- ever touched, and re-running this migration after a rollback
-- deterministically re-derives the same unambiguous single-plan backfill.
