# POL-AI-005A — Transactional Action Planner: Phase A foundation

Phase A only: UNDERSTAND → RESOLVE → PLAN. No CONFIRM/ACT/VERIFY, no real
write, no migration, no merge. This document is the exact resume point for
Phase B.

## WHAT IS COMPLETE

- **Domain audit**: `docs/architecture/POL-AI-005A-domain-audit.md` — real
  patient/treatment-plan/payment/Poliedron code paths, verified by reading
  the shipped source (not assumed).
- **Deterministic command parser** (`src/lib/poliedron/planner/commandParser.js`):
  covers the five documented command families (mark-completed with/without
  tooth, treatment+payment, multi-item plan creation, multiple treatments+
  payment with unknown teeth) with zero Model Gateway calls. Reuses
  `intentEngine.js`'s `extractAmount`.
- **Patient resolution** (`patientResolver.js`): reuses the app's one
  shared `cercaPazienti`/`normalizza` (`ricercaPazienti.js`); returns
  `RESOLVED`/`AMBIGUOUS`/`NOT_FOUND`/`INVALID` (cross-tenant), never
  creates a patient.
- **Procedure resolution** (`procedureResolver.js`): exact → alias →
  strong-match → not-found against the caller's `pricelist`; honest about
  there being no canonical procedure ID in this app.
- **Tooth model** (`toothModel.js`): `KNOWN`/`UNKNOWN_AT_ENTRY`/
  `NOT_APPLICABLE`/`LEGACY_INCOMPLETE`, reproducing the real FDI tooth set
  from `Odontogramma.jsx`. No DB column added.
- **Action Plan contract + planners** (`actionPlanner.js`): `buildActionPlan`
  builds a frozen, JSON-serializable plan (`actionId, intent, patientRef,
  entities, steps, warnings, assumptions, confidence, requiredPermissions,
  requiresConfirmation, blocked`) for all three documented workflows
  (treatment+payment, multi-item plan creation, mark-completed with
  idempotent reuse). Steps are data only — no executable code in any step.
- **Idempotency**: reuses an existing matching plan item instead of
  duplicating it; flags (never silently collapses or silently duplicates)
  a same-patient/same-amount pending payment; two explicit incomplete
  fillings in one request are always kept as two distinct planned items.
- **Permission plan**: every write-shaped step (`ENSURE_TREATMENT_ITEM`,
  `MARK_TREATMENT_COMPLETED`, `ENSURE_PENDING_PAYMENT`) carries
  `requiredPermissions`, checked against the real
  `buildIntelligencePermissions()` flags; a plan with a missing permission
  is `blocked: true` with a visible warning, never silently partially
  planned.
- **Model fallback contract** (`modelFallbackContract.js`): defines and
  enforces the semantic-fields-only allow-list; strips any id-shaped key a
  model response might contain.
- **Data Health handoff design** (`dataHealthHandoff.js`): produces
  signals shaped exactly like `intelligence/model.js`'s real `createSignal()`
  output, in-memory only — not wired into `studioDataHealth.js`.
- **executeActionPlan()**: an explicit rejecting stub — calling it throws,
  it never silently no-ops.
- **Tests**: `tests/actionPlanner.test.mjs` (28 tests) — full §21 matrix,
  including a mandatory "no Supabase write anywhere in the planner tree"
  regression and a "no Model Gateway reference" regression.
- **Verification**: 286/286 Node tests pass (258 pre-existing + 28 new);
  production build passes; `git diff --check` clean.

## WHAT IS NOT IMPLEMENTED

- No CONFIRM step (a real Action Preview UI the user reviews/edits before
  acting).
- No ACT step (no code anywhere writes to `plans`/`payments`/any table).
- No VERIFY/readback step (confirming a write actually landed as planned).
- No Data Health signal is persisted or fed into `studioDataHealth.js` —
  design only.
- The deterministic parser is narrow by design (five families + close
  variants); anything else must fall back to the Model Gateway under the
  contract in `modelFallbackContract.js`, which Phase B still has to wire
  up end to end (Phase A only defines/enforces the contract shape).
- `REQUIRED_PERMISSION` (`clinical`/`financial`) is a **Phase A design
  choice**, stricter than what `Piani.jsx`/`Pagamenti.jsx` enforce for a
  human today — see PRODUCT_OWNER_DECISION_REQUIRED below.

## PHASE_B_REQUIRED_WORK

1. **Confirmation preview** — a real UI (likely a new Poliedron panel
   state) that renders an Action Plan's steps/warnings/assumptions for the
   user to review, edit (e.g. pick the correct ambiguous patient/procedure,
   fill in a tooth), and explicitly confirm before anything executes.
2. **Action executor** — replace `executeActionPlan()`'s stub with real
   logic. Two sub-decisions the Product Owner must make first (see below):
   (a) extract `Piani.jsx`'s `toggleEseguita`/`save` and `Pagamenti.jsx`'s
   `save` reducer logic into importable, testable functions with
   byte-identical behavior (including the `stato: 'concluso'`
   auto-promotion), or (b) design a proper domain-service layer. Either
   way, the executor must reproduce the exact same effect a human clicking
   the existing UI would get — never a parallel, subtly different write
   path.
3. **Clinical writes** — actually calling whatever the executor becomes,
   for `ENSURE_TREATMENT_ITEM`/`MARK_TREATMENT_COMPLETED`.
4. **Financial writes** — actually inserting a `payments` row for
   `ENSURE_PENDING_PAYMENT`. Remember: no `planId` linkage exists (domain
   audit MISSING_ABSTRACTIONS #2) — the payment will only ever reference
   the patient, same as today.
5. **Transactional/partial-failure handling** — a multi-step plan (e.g.
   workflow A: ensure item + mark completed + ensure payment) needs a real
   answer for "step 2 of 3 fails" — this app's Supabase access has no
   client-side transaction primitive today; Phase B must either find/build
   one (RPC?) or design compensating steps. Flagged as a likely STOP
   condition already in this task's own instructions.
6. **Readback verification** — after a write, re-read the affected
   plan/payment and confirm it matches what was planned (catches RLS
   silently filtering an update, etc. — see the POL-UI-013C precedent for
   exactly this class of bug in a different feature).
7. **Data Health clearing** — when a previously-incomplete tooth is later
   filled in, the corresponding Data Health signal should clear; needs a
   real persistence/matching design once `dataHealthHandoff.js` is wired
   into `studioDataHealth.js`.
8. **Responsive QA** — once there is a real Confirmation Preview UI to
   render, the usual 6-breakpoint × light/dark real-browser QA this
   repo's every UI task performs.
9. **Security review** of the actual write paths once they exist (RLS
   still the only authority; this Phase A code performs no writes to
   review yet).

## SCHEMA_CHANGE_REQUIRED

None found or needed for the conservative Phase B scope above (mark an
existing/new item completed with a possibly-unknown tooth; record a
payment). If Phase B's design instead wants a real `tooth` column, a
`procedure_id` foreign key, or a `plan_item_id` on `payments`, those would
each be genuine schema changes requiring a new migration and a Product
Owner gate — not decided or authored here.

## BACKEND_CHANGE_REQUIRED

Likely, for item 5 above (transactional/partial-failure handling) if the
Product Owner wants true atomicity across `plans`/`payments` writes — this
would need a Postgres RPC (`SECURITY DEFINER` function performing both
writes in one transaction), which is a backend change requiring its own
migration, RLS review, and Product Owner gate. Not designed here beyond
flagging it.

## PRODUCT_OWNER_DECISION_REQUIRED

1. **Permission model for AI-initiated writes.** Today, a human marking a
   treatment completed or registering a payment needs only `activeMember`
   (page access) — there is no distinct "may write clinical data" or "may
   register a payment" capability. Phase A's planner conservatively
   requires `clinical`/`financial` (computed from `managementControl`),
   which is **stricter** than the existing human-driven forms. Please
   confirm whether that's the right bar for an AI-initiated write, or
   whether a different/new capability should gate it.
2. **Atomicity for multi-step plans.** See BACKEND_CHANGE_REQUIRED above —
   decide whether Phase B needs a real transactional RPC or whether
   sequential writes with compensating rollback (or accepting partial
   completion with a clear user-visible status) is acceptable.
3. **Executor implementation approach.** Extract reducer logic from
   `Piani.jsx`/`Pagamenti.jsx` into shared functions (favors byte-identical
   behavior, some refactor risk) vs. design a new domain-service layer
   (cleaner, more work, temporarily two code paths). Recommend the former
   as lower-risk, but this is a real architectural choice for the Product
   Owner/Tech Lead.

None of the above blocked Phase A itself — every item above is scoped work
for Phase B, not a STOP condition encountered while building the
foundation. No STOP condition from the task's own §22 list was hit: the
schema safely supports incomplete treatment (no change needed), payment
linkage does not require a schema change for the conservative Phase B
scope, and the write permission model, while stricter-than-today by
design choice, is not "unclear" — it is deliberately conservative pending
confirmation.
