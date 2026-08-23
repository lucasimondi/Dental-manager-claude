-- POL-FIN-001 — canonical payment-plan / deadline / allocation schema.
-- ============================================================================
-- MIGRATION GATE (AGENTS.md / repository governance):
-- This migration is AUTHORED for Product Owner review only. It has NOT
-- been applied to any production database, and this repository's sandbox
-- has no live database connection to apply it to even if that were
-- authorized. It has been syntax/RLS-reasoned against the exact template
-- already proven in production by
-- supabase/migrations/20260818000000_physio_schema_dati.sql (see that
-- file's own header: "RLS attiva + singola policy studio-scoped dal
-- template di runbook-rls-nuove-tabelle.md... isolamento confermato").
-- STOP: do not apply this to production without explicit Product Owner
-- approval. See docs/architecture/POL-FIN-001-payment-plans-deadlines.md
-- MIGRATION_DECISION for the full audit this migration is based on.
--
-- ADDITIVE ONLY: three new tables. No existing table (`patients`, `plans`,
-- `payments`, or any POL-003 financial-engine table) is altered, renamed,
-- or has a column added/removed/retyped. Existing payments/plans remain
-- valid and unaffected — a patient with historical payments and no
-- payment plan continues to compute totalDue/totalCollected/
-- totalOutstanding exactly as before; totalScheduledOutstanding is simply
-- 0 and totalUnscheduledOutstanding equals totalOutstanding for that
-- patient, by construction (no rows in these new tables reference them).
--
-- MONEY REPRESENTATION: numeric(18,6), matching the precedent already
-- established by POL-003's own ledger tables
-- (financial_contracts_v1.discount_value, financial_payment_events_v1.
-- amount, etc. — see 20260818190642_pol_003_financial_engine_v1.sql).
-- Not a new representation; the same safe, exact decimal type already in
-- use for money throughout this schema.
--
-- DERIVED VALUES NOT STORED: deadline status (UPCOMING/DUE/
-- PARTIALLY_PAID/PAID/OVERDUE) and remaining amount are computed from
-- `amount_due` and the sum of `payment_allocations` for that deadline —
-- see src/lib/domain/paymentPlanService.js's computeDeadlineStatus /
-- deadlineRemainingAmount. No status/remaining column exists here to
-- avoid a second, potentially-stale source of truth.
-- ============================================================================
BEGIN;

-- 1. PAYMENT PLAN — a patient's agreed schedule (or historical schedule)
--    for collecting an outstanding amount. At most one ACTIVE plan per
--    patient is the intended business rule; enforced in the domain layer
--    (src/lib/domain/patientFinancialSummary.js reports
--    `multipleActivePlans: true` rather than silently picking one if this
--    is ever violated) rather than a database constraint, to keep this
--    migration minimal — a future hardening pass could add a partial
--    unique index if the Product Owner wants DB-level enforcement too.
CREATE TABLE public.payment_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  patient_id bigint NOT NULL REFERENCES public.patients(id),
  plan_type text NOT NULL CHECK (plan_type IN ('INSTALLMENTS','CUSTOM','TREATMENT_PHASES')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  total_amount numeric(18,6) NOT NULL CHECK (total_amount >= 0),
  -- Plan-level link only (plans.id IS a stable id). Deliberately NOT a
  -- per-treatment-item link: plans.voci is a JSONB array whose items have
  -- no stable id of their own (only a positional array index, which
  -- reorders/shifts and is not a safe foreign key) — see the architecture
  -- doc's DEADLINE_MODEL section. TREATMENT_PHASES execution triggers
  -- (e.g. "alla chirurgia" firing automatically when a specific voce is
  -- marked eseguita) are explicitly deferred until plans.voci gains a
  -- stable per-item id; this column only supports plan-level context.
  linked_treatment_plan_id bigint REFERENCES public.plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_plans_studio ON public.payment_plans
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 2. PAYMENT DEADLINE — one scheduled (or phase-triggered) installment
--    within a payment plan. `due_date` is nullable for TREATMENT_PHASES
--    deadlines that are event-triggered rather than date-fixed
--    ("alla chirurgia") — `trigger_description` carries that human
--    description; a deadline always has exactly one or the other
--    meaningfully populated (enforced in the domain layer's construction
--    helpers, not a CHECK constraint, since a phase deadline MAY later
--    gain an agreed date without becoming a different row).
CREATE TABLE public.payment_deadlines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  patient_id bigint NOT NULL REFERENCES public.patients(id),
  payment_plan_id bigint NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  sequence_index integer NOT NULL,
  label text,
  amount_due numeric(18,6) NOT NULL CHECK (amount_due > 0),
  due_date date,
  trigger_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_plan_id, sequence_index)
);

ALTER TABLE public.payment_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_deadlines_studio ON public.payment_deadlines
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- 3. PAYMENT ALLOCATION — links a real `payments` row to either a
--    specific deadline (`payment_deadline_id` set) or the patient's
--    general outstanding balance (`payment_deadline_id` NULL — task §11:
--    "recorded against the patient's general outstanding balance when no
--    deadline applies"). Never invents an allocation: every row here is
--    an explicit, human-confirmed act (a Poliedron Level-2 write or a
--    manual UI action), never inferred silently.
CREATE TABLE public.payment_allocations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  patient_id bigint NOT NULL REFERENCES public.patients(id),
  payment_id bigint NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  payment_deadline_id bigint REFERENCES public.payment_deadlines(id),
  amount numeric(18,6) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_allocations_studio ON public.payment_allocations
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

CREATE INDEX payment_deadlines_plan_idx ON public.payment_deadlines (payment_plan_id);
CREATE INDEX payment_deadlines_patient_idx ON public.payment_deadlines (studio_id, patient_id);
CREATE INDEX payment_plans_patient_idx ON public.payment_plans (studio_id, patient_id);
CREATE INDEX payment_allocations_deadline_idx ON public.payment_allocations (payment_deadline_id);
CREATE INDEX payment_allocations_payment_idx ON public.payment_allocations (payment_id);
CREATE INDEX payment_allocations_patient_idx ON public.payment_allocations (studio_id, patient_id);

COMMIT;
