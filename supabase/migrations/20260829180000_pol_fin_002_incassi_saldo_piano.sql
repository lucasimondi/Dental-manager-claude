-- POL-FIN-002 — Modulo Incassi / Da incassare: canonical per-plan balance.
--
-- Additive only. Does NOT touch POL-003 (financial_*_v1 tables/views/RPCs,
-- get_financial_snapshot_v1/get_financial_drilldown_v1): that engine is a
-- studio-period P&L/KPI snapshot (a different granularity — date-range
-- aggregates, invoice-based CREDITO_CLIENTI) and, per repository evidence,
-- its legacy adapter (private.run_pol_003b_legacy_adapter_v1) has never
-- been executed in production, so financial_*_v1 tables are not populated
-- and nothing here reads or writes them. This module instead answers a
-- different, currently-unimplemented question directly from the existing
-- public.plans/public.payments tables: the real outstanding balance per
-- treatment plan that front-desk/patient-record screens need today:
--
--   saldo_piano         = totale_piano - totale_pagato_piano
--   eseguito_non_pagato = GREATEST(0, totale_eseguito_piano - totale_pagato_piano)
--   acconto             = GREATEST(0, totale_pagato_piano - totale_eseguito_piano)
--
-- totale_piano/totale_eseguito reuse Piani.jsx's exact existing discount
-- formula (sub, scontato = pct ? sub*sc/100 : LEAST(sc,sub), finale =
-- GREATEST(0, sub-scontato)) applied both to the plan's full subtotal and,
-- proportionally, to the executed-only subtotal — so these numbers never
-- diverge from what the plan editor itself already shows.
--
-- Design decision (confirmed with the Product Owner in-session): public.
-- payments only carries paziente_id, not a plan/piano FK — a payment is
-- not tied to one specific plan. When a patient has more than one plan,
-- that patient's paid total (payments.stato='pagato' only — 'sospeso' is
-- an owed-not-collected placeholder per src/lib/domain/paymentService.js)
-- is allocated to their plans FIFO by plan date, oldest first — the same
-- "order by date" convention already used elsewhere in this codebase for
-- plan targeting (src/lib/domain/treatmentPlanService.js). For a patient
-- with a single active plan (the reported case) this reduces exactly to
-- totale_piano - totale_pagato, and the sum of saldo_piano across a
-- patient's plans always reconciles to that patient's aggregate balance —
-- no euro is invented or double-counted.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.plans') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans'
      AND column_name IN ('id','studio_id','paziente_id','data','voci','sconto','sconto_tipo')
    GROUP BY table_schema, table_name HAVING count(*) = 7
  ) THEN
    RAISE EXCEPTION 'POL-FIN-002 preflight: public.plans(id,studio_id,paziente_id,data,voci,sconto,sconto_tipo) is required';
  END IF;
  IF to_regclass('public.payments') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments'
      AND column_name IN ('studio_id','paziente_id','importo','stato')
    GROUP BY table_schema, table_name HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'POL-FIN-002 preflight: public.payments(studio_id,paziente_id,importo,stato) is required';
  END IF;
  IF to_regprocedure('private.financial_has_tenant_access_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'POL-FIN-002 preflight: private.financial_has_tenant_access_v1(uuid) (POL-003A) is required';
  END IF;
END
$preflight$;

CREATE SCHEMA IF NOT EXISTS private;

-- Per-plan gross/discounted/executed totals.
CREATE OR REPLACE VIEW private.incassi_plan_totals_v1 WITH (security_invoker=true) AS
WITH voci AS (
  SELECT pl.id AS piano_id, pl.studio_id, pl.paziente_id, pl.data, pl.created_at,
    pl.sconto, pl.sconto_tipo,
    COALESCE(SUM((v.item->>'prezzo')::numeric) FILTER (
      WHERE coalesce(v.item->>'prezzo','') ~ '^[0-9]+(\.[0-9]+)?$'
    ), 0) AS sub,
    COALESCE(SUM((v.item->>'prezzo')::numeric) FILTER (
      WHERE coalesce(v.item->>'prezzo','') ~ '^[0-9]+(\.[0-9]+)?$'
        AND (v.item->>'eseguita')::boolean IS TRUE
    ), 0) AS sub_eseguito
  FROM public.plans pl
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(pl.voci) = 'array' THEN pl.voci ELSE '[]'::jsonb END
  ) AS v(item) ON true
  GROUP BY pl.id, pl.studio_id, pl.paziente_id, pl.data, pl.created_at, pl.sconto, pl.sconto_tipo
), discounted AS (
  SELECT voci.*,
    CASE lower(coalesce(sconto_tipo,''))
      WHEN 'pct' THEN sub * LEAST(GREATEST(coalesce(sconto,0),0),100) / 100
      ELSE LEAST(GREATEST(coalesce(sconto,0),0), sub)
    END AS scontato
  FROM voci
)
SELECT piano_id, studio_id, paziente_id, data, created_at, sub, sub_eseguito, scontato,
  GREATEST(0, sub - scontato) AS totale_piano,
  GREATEST(0, sub_eseguito - (CASE WHEN sub > 0 THEN sub_eseguito * scontato / sub ELSE 0 END)) AS totale_eseguito
FROM discounted;

-- Per-patient collected total (only actually-received payments count).
CREATE OR REPLACE VIEW private.incassi_patient_paid_v1 WITH (security_invoker=true) AS
SELECT studio_id, paziente_id, COALESCE(SUM(importo), 0) AS totale_pagato
FROM public.payments
WHERE lower(coalesce(stato, '')) = 'pagato'
GROUP BY studio_id, paziente_id;

-- FIFO-by-plan-date allocation of the patient's paid total across their plans.
CREATE OR REPLACE VIEW private.incassi_plan_saldo_v1 WITH (security_invoker=true) AS
WITH ranges AS (
  SELECT t.*,
    SUM(t.totale_piano) OVER (
      PARTITION BY t.studio_id, t.paziente_id ORDER BY t.data, t.created_at, t.piano_id
    ) - t.totale_piano AS range_start,
    SUM(t.totale_piano) OVER (
      PARTITION BY t.studio_id, t.paziente_id ORDER BY t.data, t.created_at, t.piano_id
    ) AS range_end
  FROM private.incassi_plan_totals_v1 t
)
SELECT r.piano_id, r.studio_id, r.paziente_id, r.data, r.totale_piano, r.totale_eseguito,
  GREATEST(0, LEAST(COALESCE(p.totale_pagato, 0), r.range_end) - r.range_start) AS totale_pagato_piano
FROM ranges r
LEFT JOIN private.incassi_patient_paid_v1 p
  ON p.studio_id = r.studio_id AND p.paziente_id = r.paziente_id;

REVOKE ALL ON TABLE private.incassi_plan_totals_v1, private.incassi_patient_paid_v1, private.incassi_plan_saldo_v1
  FROM PUBLIC, anon;
GRANT SELECT ON TABLE private.incassi_plan_totals_v1, private.incassi_patient_paid_v1, private.incassi_plan_saldo_v1
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_saldo_piano(p_piano_id bigint)
RETURNS TABLE (
  piano_id bigint, totale_piano numeric, totale_eseguito numeric, totale_pagato numeric,
  saldo_piano numeric, eseguito_non_pagato numeric, acconto numeric
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
  SELECT s.piano_id, s.totale_piano, s.totale_eseguito, s.totale_pagato_piano,
    s.totale_piano - s.totale_pagato_piano,
    GREATEST(0, s.totale_eseguito - s.totale_pagato_piano),
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito)
  FROM private.incassi_plan_saldo_v1 s
  WHERE s.piano_id = p_piano_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_saldi_aperti_studio(p_studio_id uuid)
RETURNS TABLE (
  piano_id bigint, paziente_id bigint, data date, titolo text,
  totale_piano numeric, totale_eseguito numeric, totale_pagato numeric,
  saldo_piano numeric, eseguito_non_pagato numeric, acconto numeric, giorni_apertura integer
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
  SELECT s.piano_id, s.paziente_id, s.data, pl.titolo,
    s.totale_piano, s.totale_eseguito, s.totale_pagato_piano,
    s.totale_piano - s.totale_pagato_piano AS saldo_piano,
    GREATEST(0, s.totale_eseguito - s.totale_pagato_piano) AS eseguito_non_pagato,
    GREATEST(0, s.totale_pagato_piano - s.totale_eseguito) AS acconto,
    GREATEST(0, (CURRENT_DATE - s.data))::integer AS giorni_apertura
  FROM private.incassi_plan_saldo_v1 s
  JOIN public.plans pl ON pl.id = s.piano_id
  WHERE s.studio_id = p_studio_id
    AND private.financial_has_tenant_access_v1(p_studio_id)
    AND (s.totale_piano - s.totale_pagato_piano) > 0.005
  ORDER BY (s.totale_piano - s.totale_pagato_piano) DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_saldo_piano(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_saldi_aperti_studio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_saldo_piano(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saldi_aperti_studio(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_saldo_piano(bigint) IS
  'POL-FIN-002: per-plan receivable balance (saldo_piano = totale_piano - totale_pagato_piano, FIFO-by-plan-date allocation of the patient''s payments across their plans). Independent of POL-003''s studio-period get_financial_snapshot_v1.';
COMMENT ON FUNCTION public.get_saldi_aperti_studio(uuid) IS
  'POL-FIN-002: one row per plan with saldo_piano > 0 for the given (caller-authorized) studio — powers the Incassi open-balance worklist.';

COMMIT;

-- Reversal: DROP FUNCTION public.get_saldi_aperti_studio(uuid); DROP FUNCTION
-- public.get_saldo_piano(bigint); DROP VIEW private.incassi_plan_saldo_v1;
-- DROP VIEW private.incassi_patient_paid_v1; DROP VIEW private.incassi_plan_totals_v1;
-- No table was created or altered by this migration.
