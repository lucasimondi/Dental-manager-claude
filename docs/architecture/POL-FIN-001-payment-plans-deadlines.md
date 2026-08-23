# POL-FIN-001 — Canonical Patient Financial Contract, Payment Plans & Deadlines

Branch: `feature/POL-FIN-001-payment-plans-deadlines`, based on `origin/master`
(includes POL-AI-005B, merged as PR #47). Draft PR only — not merged, not
deployed. This document is the audit + design + decision record the task
required before any implementation began.

## CURRENT_FINANCIAL_MODEL

Two independent financial layers already exist in this codebase, and this
task had to reconcile with both without duplicating either.

**1. Studio-wide canonical engine (POL-003).** A real, versioned,
server-side ledger — `financial_contracts_v1` / `financial_contract_lines_v1`
/ `financial_line_events_v1` / `financial_payment_events_v1` /
`financial_payment_allocations_v1` (see
`supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql`), all
money columns `numeric(18,6)`. Exposed to the client only through the
canonical RPC `get_financial_snapshot_v1` (`src/lib/canonicalFinancialSelectors.js`).
This produces **studio-wide aggregate** metrics (fatturato, incassato,
EBITDA, credito clienti, ...), never a per-patient breakdown. Critically,
`supabase/migrations/20260819104143_pol_003b_legacy_financial_adapter.sql`
(POL-003B, a *restricted, not-yet-executed* adapter) defines the
authoritative rule for what counts as a real payment event: only
`payments` rows with `lower(stato) = 'pagato'` become `PAYMENT` events —
`sospeso`/`acconto` rows do not.

**2. Legacy per-patient balance (`Pagamenti.jsx`'s `saldoPaz`).** A plain
client-side calculation, computed directly from `plans`/`payments`, with
no canonical engine behind it:

```js
const dovuto = patPlans.reduce((s, pl) => {
  const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
  const sc = Number(pl.sconto) || 0;
  const scontato = pl.scontoTipo === 'pct' ? sub * (sc/100) : Math.min(sc, sub);
  return s + Math.max(0, sub - scontato);
}, 0);
const pagato = payments.filter(p => p.pazienteId === pazId).reduce((s, p) => s + Number(p.importo), 0);
const residuo = Math.max(0, dovuto - pagato);
```

`pagato` here counts **every** payment row regardless of `stato` — a
previously-documented quirk (see the POL-AI-005A domain audit), not a
canonical rule. `plans`/`payments` themselves predate this repository's
migration history (no `CREATE TABLE` for either exists in
`supabase/migrations/`) — their columns are known only from usage:
`patients.id` / `plans.id` / `payments.id` are `bigint` (confirmed via
`paziente_id bigint NOT NULL REFERENCES public.patients(id)` in
`20260818000000_physio_schema_dati.sql` and `patient_id bigint` throughout
POL-003's own migration); `plans.voci` is a JSONB array of
`{prestazione, dente, prezzo, eseguita, incassata, dataEsec}` with **no
stable per-item id** (only positional array index); `payments.stato ∈
{'pagato', 'acconto', 'sospeso'}` (`Pagamenti.jsx`'s Stato select).

**No canonical patient-level contract existed before this task** — this is
exactly the gap PR #48 (POL-UI-014) flagged: *"An authoritative server-side
patient financial contract is required before numeric financial cockpit
KPIs can be enabled."*

## SCHEMA_DECISION

Neither existing structure can represent payment plans, deadlines, or
partial-payment allocation:
- `plans`/`payments` have no relationship to each other at all beyond a
  shared `paziente_id` — a payment cannot be linked to *which* treatment
  item or *which* agreed installment it settles.
- POL-003's ledger (`financial_payment_events_v1` /
  `financial_payment_allocations_v1`) models payment-to-**invoice**
  allocation for the studio-wide engine, not payment-to-**patient-agreed-
  deadline** allocation, and is a `private`-schema, PO-gated, not-yet-
  executed system — extending it would mean reaching into POL-003's own
  pending activation decision, which is out of this task's scope.

**Decision: additive, minimal new schema.** Three new tables —
`payment_plans`, `payment_deadlines`, `payment_allocations` — reusing the
exact production-proven template from
`supabase/migrations/20260818000000_physio_schema_dati.sql` (`bigint
GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `studio_id uuid NOT NULL
REFERENCES public.studios(id)`, one `FOR ALL` RLS policy checking
`studio_id = (auth.jwt()->'app_metadata'->>'studio_id')::uuid`, per that
migration's own comment: "isolamento confermato"). Money columns are
`numeric(18,6)`, matching POL-003's own precedent exactly — not a new
representation.

## MIGRATION_REQUIRED

**Yes — additive only, authored for review, NOT applied.**
`supabase/migrations/20260824000000_pol_fin_001_payment_plans_deadlines.sql`.

- No existing table is altered, renamed, or has a column added/removed/
  retyped.
- Validated locally (never against production — this sandbox has no live
  database connection at all) using `@electric-sql/pglite` (a real
  Postgres compiled to WASM, the same tool used for POL-RBAC-001A's local
  validation): the migration applies cleanly to a disposable in-memory
  Postgres instance seeded with stand-in `studios`/`patients`/`plans`/
  `payments` tables and a stub `auth.jwt()` function, all three tables and
  their RLS policies create successfully, and insert/select round-trips
  through the exact application shape (plan → deadline → allocation) work
  correctly. **Same caveat as every prior PGlite validation in this
  repository**: PGlite's default connecting role behaves like a Postgres
  superuser, which bypasses RLS by design — this proves the migration's
  SQL is syntactically and referentially sound, not that RLS enforcement
  itself was exercised against a non-superuser role. RLS's actual
  authorization behavior rests on the identical, already-production-proven
  policy expression from `physio_piani`, not on anything new.
- **STOP: do not apply to production without explicit Product Owner
  approval**, per AGENTS.md's migration gate.

## PATIENT_FINANCIAL_CONTRACT

`src/lib/domain/patientFinancialSummary.js` → `computePatientFinancialSummary(sources, patientId, {today})`:

```
PatientFinancialSummary {
  patientId
  totalDue                    // byte-identical to Pagamenti.jsx's `dovuto`
  totalCollected               // sum of payments where stato = 'pagato' ONLY
  totalOutstanding              // max(0, totalDue - totalCollected)
  totalScheduledOutstanding     // sum of remaining amounts on ACTIVE-plan deadlines
  totalUnscheduledOutstanding   // totalOutstanding - totalScheduledOutstanding
  totalOverdue                  // sum of remaining amounts on OVERDUE deadlines
  nextDeadline                  // earliest dated open deadline, or null
  activePaymentPlan             // the patient's one ACTIVE payment_plans row, or null
  multipleActivePlans           // true if the "at most one ACTIVE plan" rule was violated — never silently picks one
}
```

**One deliberate, documented divergence from the legacy Pagamenti.jsx
widget**: `totalCollected` adopts POL-003's own canonical rule
(`stato = 'pagato'` only) instead of `saldoPaz`'s looser
"every payment regardless of status" quirk. `totalDue` is byte-identical
to `saldoPaz`'s `dovuto` — no divergence there. This does **not** change
any number `Pagamenti.jsx` currently displays (that component is untouched
by this task); it means the new canonical contract and the legacy widget
can show different "collected" figures for a patient with `sospeso`
payments until `Pagamenti.jsx` is migrated onto this contract (a follow-up
— see PRODUCT_OWNER_DECISION_REQUIRED below, since AGENTS.md forbids
changing financial semantics of existing, shipped code without a gate).

## PAYMENT_PLAN_MODEL

`src/lib/domain/paymentPlanService.js`. `PLAN_TYPE ∈ {INSTALLMENTS, CUSTOM,
TREATMENT_PHASES}`, `PLAN_STATUS ∈ {ACTIVE, COMPLETED, CANCELLED}`. At most
one ACTIVE plan per patient is the business rule, enforced in the domain/
planner/executor layers (never a silent second plan) rather than a DB
constraint, to keep the migration minimal — `multipleActivePlans` in the
summary surfaces any violation rather than hiding it.

- **INSTALLMENTS**: `buildInstallmentDeadlines({totalAmount, count,
  startDate, intervalMonths=1})` — N equal monthly installments, exact
  total preserved via `money.js`'s integer-cents splitter (deterministic
  remainder distribution, never floating-point drift).
- **CUSTOM**: `buildCustomPlanDeadlines(entries)` — independent
  date/amount pairs, no splitting logic needed.
- **TREATMENT_PHASES**: `buildTreatmentPhasesDeadlines(phases)` —
  event-triggered deadlines (`trigger_description`, e.g. "alla
  chirurgia") with `dueDate` nullable until a real date is agreed.
  `payment_plans.linked_treatment_plan_id` links to `plans.id` (a real,
  stable id) at the **plan level only** — never per-item. `plans.voci`
  items have no stable id of their own (only a positional array index,
  which is not a safe cross-table foreign key), so an execution trigger
  that fires automatically when a *specific treatment item* is marked
  `eseguita` is explicitly **deferred**, not built, per the task's own
  instruction ("design the schema for it and explicitly defer the
  execution trigger").

All three types are fully built and domain-tested. Only **INSTALLMENTS**
has a deterministic Poliedron chat command today (see
POLIEDRON_INTEGRATION) — CUSTOM/TREATMENT_PHASES creation via natural
language is intentionally not wired to a parser pattern yet (task §5: "do
not over-engineer"; multi-date/multi-amount free-text parsing is a much
larger, error-prone surface than the well-specified INSTALLMENTS case).

## DEADLINE_MODEL

`payment_deadlines`: `id, studio_id, patient_id, payment_plan_id,
sequence_index, label, amount_due, due_date, trigger_description,
created_at, updated_at`. Status (`UPCOMING/DUE/PARTIALLY_PAID/PAID/
OVERDUE`) and remaining amount are **derived, never stored**
(`computeDeadlineStatus`/`deadlineRemainingAmount` in
`paymentPlanService.js`), computed from `amount_due` minus the sum of that
deadline's `payment_allocations` — avoiding a second, potentially-stale
source of truth for a value that's cheap to recompute.

## PARTIAL_PAYMENT_MODEL

A deadline's remaining amount is `max(0, amount_due - Σallocations)` —
never negative by construction. Recording €300 against a €500 deadline
yields `remaining: 200`, `status: PARTIALLY_PAID`; a second €200 allocation
brings it to `remaining: 0`, `status: PAID`. Proven by domain tests 10-11
and Poliedron test 30 (the exact "Ha pagato 300 euro della rata di agosto"
example from the task spec).

## ALLOCATION_MODEL

`payment_allocations` links one real `payments` row to either a specific
`payment_deadlines` row (`payment_deadline_id` set) or the patient's
general outstanding balance (`payment_deadline_id` NULL). Never invented:
`planRecordPaymentAgainstDeadline` (`actionPlanner.js`) resolves a
payment-received command against the patient's currently-open deadlines
and — exactly per task §11 — proposes allocation only when **exactly one**
open deadline exists (`SINGLE_MATCH`), asks for clarification when **two
or more** exist (`MULTIPLE_MATCH`, plan `blocked`, zero writes possible),
and falls back to the general-balance offer when **none** exist
(`NO_DEADLINE`, still confirmable — it's a legitimate outcome, not a
dead end). A `deadlineRefText` (e.g. "la rata di agosto") narrows the
candidate pool by month first; if it matches nothing, the full open pool
is used instead of failing outright.

## FINANCIAL_INVARIANTS

All of the following are enforced structurally (by `Math.max(0, ...)`
clamps and the cents-safe `money.js` helpers) and directly tested:

- `totalOutstanding = totalDue - totalCollected` (clamped ≥ 0).
- `totalScheduledOutstanding + totalUnscheduledOutstanding =
  totalOutstanding` (the summary computes `totalScheduledOutstanding` as
  `min(totalOutstanding, Σremaining-on-active-deadlines)`, so this identity
  holds even if a data anomaly would otherwise push the scheduled figure
  above the true outstanding total).
- `totalScheduledOutstanding ≤ totalOutstanding`.
- `deadlineRemaining = max(0, deadlineAmount - Σallocations)` — never
  negative.
- Overpayment is not specially modeled: an allocation exceeding a
  deadline's remaining amount is still recorded (the task does not forbid
  paying ahead), and the clamp simply keeps the *displayed* remaining at
  0 rather than a raw negative number — no invariant is broken, no
  negative balance is ever shown.
- Installment/custom-plan totals sum to the requested total **exactly**,
  verified via `assertDeadlinesPreserveTotal` (cents-based, never a bare
  float `===`).

## POLIEDRON_INTEGRATION

**READ** (`src/lib/poliedron/financialQueryEngine.js`, wired into
`poliedraCore.js`'s `processQuery` immediately after the deterministic
write-command parser): a bounded set of regex-recognized question shapes
— "Quanto deve (ancora) pagare X", "Quanto ha (già) pagato X", "Qual è la
prossima scadenza di X", "Chi deve pagare questa settimana", "Chi ha rate
scadute", "Quanto devo incassare entro fine mese", "Quali pazienti hanno
un residuo senza piano di pagamento" — every one answered directly from
`computePatientFinancialSummary`/`computeStudioFinancialSummaries`, zero
Model Gateway calls (proven by a source-scan test).

**WRITE** (`commandParser.js` → `actionPlanner.js` → `actionExecutor.js`,
the exact same UNDERSTAND → RESOLVE → PLAN → PREVIEW → CONFIRM → RE-
VALIDATE → ACT → VERIFY sequence POL-AI-005B established, never bypassed):
- `CREATE_PAYMENT_PLAN` — "Dividi [i N euro che rimangono | il residuo] in
  N rate [mensili] [da <day> <month>]". Context-resolved patient only (no
  patient name in this command shape, like Workflow G). The amount to
  split is **always** the canonical `totalUnscheduledOutstanding` — a
  stated amount in the text is cross-checked against it and the plan is
  blocked on mismatch, never trusted blindly (Critical Domain Rule: never
  invent a schedule).
- `RECORD_PAYMENT_AGAINST_DEADLINE` — "`<patient>` [oggi] mi ha dato
  `<amount>`" (patient named) or "Ha pagato `<amount>` della rata di
  `<ref>`" (context patient). Resolves per ALLOCATION_MODEL above.
- Both re-validate patient/tenant identity, permissions, and canonical
  financial state **fresh, immediately before writing** (TOCTOU-safe) —
  never trusting the preview's snapshot. `CREATE_PAYMENT_PLAN` in
  particular re-verifies `totalUnscheduledOutstanding` hasn't changed
  since preview before writing a single row.

## PROACTIVE_FINANCIAL_INTELLIGENCE

`src/lib/poliedron/intelligence/paymentFinancialScanner.js`, wired into
the existing `scanPatientOpportunities` per-patient loop
(`patientOpportunityScanner.js`) exactly like `scanTreatmentPlans`/
`scanRecalls` already are — gated by the same `permissions.financial`
flag `scanRecalls` already uses. New signal types (`model.js`):
`PAYMENT_OVERDUE`, `PAYMENT_DUE_SOON` (within 7 days), and
`OUTSTANDING_WITHOUT_PAYMENT_PLAN`. Every signal carries real evidence (an
actual overdue amount + due date, an actual upcoming deadline, an actual
positive unscheduled-outstanding figure) computed from the same canonical
summary every other consumer uses — never a speculative/noisy alert, and
`canReadFinancial: false` yields zero signals, proven by test.

## POL_UI_014_HANDOFF

**The exact consumption contract for the Patient Clinical Cockpit (PR #48)**:

```js
import { computePatientFinancialSummary } from '<repo>/src/lib/domain/patientFinancialSummary.js';

const summary = computePatientFinancialSummary(
  { plans, payments, paymentPlans, paymentDeadlines, paymentAllocations },
  patientId,
  { today: isoDateString },
);
// summary.totalDue / totalCollected / totalOutstanding /
// summary.totalScheduledOutstanding / totalUnscheduledOutstanding /
// summary.totalOverdue / summary.nextDeadline
```

`plans`/`payments`/`paymentPlans`/`paymentDeadlines`/`paymentAllocations`
are the same already-tenant-scoped arrays App.jsx already loads via
`DB.getAll('dm_pl'|'dm_py'|'dm_pp'|'dm_pd'|'dm_pal')` (all four new keys
added to `src/lib/supabase.js`'s `TABLE_MAP` in this task) — POL-UI-014
does **not** need its own fetch, its own aggregation, or any independent
financial formula. It calls this ONE function and renders the result.
This task did **not** modify PR #48's branch or files — POL-UI-014 must
pull this contract in when its own branch rebases onto this one after
Product Owner approval and merge.

## PERMISSIONS

Reused, not reinvented: `permissionEngine.js`'s existing `financial`
capability flag (`activeMember && homePermissions.managementControl ===
true`) — the exact same gate POL-AI-005B's `ENSURE_PENDING_PAYMENT` step
already used. Every new write step (`CREATE_PAYMENT_PLAN`,
`RECORD_PAYMENT_ALLOCATION`) declares `requiredPermissions: ['financial']`
and is checked by the existing generic `checkPreconditions` permission
loop in `actionExecutor.js` — no new permission concept, no Poliedron-
specific privilege. Re-checked fresh immediately before execution
(capability revoked between preview and confirm → `failedStep.type ===
'PERMISSION'`, proven by test).

## RLS

Each new table: `ENABLE ROW LEVEL SECURITY` + one `FOR ALL` policy
(`studio_id = (auth.jwt()->'app_metadata'->>'studio_id')::uuid` for both
USING and WITH CHECK), the identical, already-production-proven template
from `physio_piani`. No table is readable or writable across a
`studio_id` boundary.

## MULTITENANT_SAFETY

Every domain-service I/O function is client-as-parameter (`db` injected,
never the real Supabase singleton — same convention as
`treatmentPlanService.js`/`paymentService.js`). The executor re-derives
`patientId` from a fresh, tenant-scoped `patients` array on every run
(`checkPreconditions`, unchanged from POL-AI-005B) and additionally
re-verifies every payment-plan/deadline write against a **fresh** read
immediately before writing. Tested directly: cross-tenant treatment/
deadline id injection (a tampered `targetDeadlineId` outside the caller's
tenant-scoped `patients` array is rejected, zero writes), stale preview
(a deadline paid off by another actor between preview and confirm is
caught, never silently overwritten), tampered allocation (test 34),
permission revoked after preview (test 33) — all fail closed.

## BACKWARD_COMPATIBILITY

Verified by test (domain test 19, "historical payment compatibility"): a
patient with real historical `plans`/`payments` and **zero** rows in any
of the three new tables computes `totalOutstanding` exactly as before,
`totalScheduledOutstanding = 0`, `totalUnscheduledOutstanding =
totalOutstanding`, `activePaymentPlan = null` — no artificial deadline is
ever generated for old data, and no historical balance is recalculated
differently merely because payment-plan support now exists. `Pagamenti.jsx`
and `SchedaPaz.jsx` are untouched by this task — their existing displayed
numbers do not change.

## MIGRATION_DECISION

**SCHEMA_CHANGE_REQUIRED: yes.** **MIGRATION_PROPOSED:**
`supabase/migrations/20260824000000_pol_fin_001_payment_plans_deadlines.sql`
(additive only — three new tables, no existing table touched).
**RLS_DESIGN:** the exact `physio_piani` template, one `FOR ALL` policy
per table, `studio_id` JWT-claim scoping. **BACKWARD_COMPATIBILITY:** full
— see above. **Not applied to any database, local or production** — author-
only, pending Product Owner approval, per AGENTS.md's migration gate.
