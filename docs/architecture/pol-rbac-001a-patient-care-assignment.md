# POL-RBAC-001A — Patient / care assignment

Status: `WAITING_PRODUCT_OWNER`

## Problem this closes

POL-RBAC-001 introduced tenant-scoped CAPABILITY (`clinical.physiotherapist`,
`clinical.personal_trainer`, `clinical.massage_therapist`, …): "this user may
act as X in this studio." Its Fisio RLS granted read access to any patient in
the tenant to a caller holding `clinical.personal_trainer` or
`clinical.massage_therapist`, gated only by `physio_patient_in_studio_v1()`
checking tenant + capability — no relationship to a specific patient. Product
Owner review flagged this as too broad: a personal trainer or massage
therapist should only reach the patients/episodes they are actually working
with.

POL-RBAC-001A adds a second, narrower concept — ASSIGNMENT: "this user may
work with THIS patient" — stored in `patient_care_assignments`, and makes
`physio_patient_in_studio_v1()` require an active assignment before granting
personal_trainer/massage_therapist access to a given patient's Fisio rows.
Physiotherapist access is intentionally left tenant-wide, unchanged from the
approved POL-RBAC-001/POL-FIS-001 contract — the mission that started this
task was explicit that already-approved physiotherapist behavior must not be
accidentally restricted. The model is designed to extend to per-patient
physiotherapist restriction in a future task without a rewrite.

## Model

```
studio
  └─ patient
       └─ episode (optional, adapter — see below)
            └─ patient_care_assignments row
                 ├─ user_id            professional assigned
                 ├─ assignment_type    responsible_physiotherapist |
                 │                     physiotherapist | personal_trainer |
                 │                     massage_therapist
                 ├─ active             immediately-effective revocation
                 └─ created_by / created_at / updated_at / ended_at / ended_by / reason
```

`patient_care_assignments` is additive and separate from
`studio_user_capabilities`. Nothing here changes what capabilities exist or
how they are granted (Setup → Collaboratori is untouched); this only decides
which patients an already-capable user may act on.

### POL-FIS-001 adapter — Product Owner approved, transitional only

**Product Owner decision (recorded verbatim):** *"APPROVATO `episode_id →
physio_piani` esclusivamente come adapter transitorio fino alla
stabilizzazione del canonical episode di POL-FIS-001. Documentalo
esplicitamente come transitional compatibility layer. Non creare un secondo
modello episodio e non eseguire backfill inventati."*

`episode_id` is nullable and references `physio_piani(id)` — the only
stable, already-merged concept that plays the "episode/care-path" role in
this codebase today. POL-FIS-001 (PR #14, physiotherapy clinical core) is
**not merged** and its `physio_episodes_v1` contract is not stable relative
to this branch: that PR is based on an earlier point in history and removes
files (POL-UI-001/POL-003F) this branch depends on, so it cannot be adopted
as-is without an incompatible rewrite.

This column is a **TRANSITIONAL COMPATIBILITY LAYER**, nothing more:

- it is not, and must not become, a second episode/care-path model — no
  parallel schema, no independent lifecycle, no new semantics beyond "points
  at the nearest existing stand-in for an episode";
- no episode data is backfilled or invented anywhere in this migration or
  any test fixture — every `episode_id` in the codebase today is `NULL`;
  nothing populates it;
- all RLS gating in this migration operates at **patient granularity only**
  (`patient_id`); `episode_id` is inert metadata, not read by any policy or
  function;
- convergence is mandatory, not optional, once POL-FIS-001 merges and
  stabilizes: a follow-up migration must repoint/rename this column onto the
  canonical `physio_episodes_v1` (or successor). This is tracked as future
  work, not `PRODUCT_OWNER_DECISION_REQUIRED` any more — the Product Owner
  has already decided the adapter itself is approved; only the mechanics of
  the eventual convergence migration remain to be designed when POL-FIS-001
  is ready.

Both the column and the table carry `COMMENT ON ... IS 'TRANSITIONAL
COMPATIBILITY LAYER ...'` in the migration itself, so this constraint is
visible directly in `\d+ patient_care_assignments`, not just in this doc.

### Assignment types

- `responsible_physiotherapist` — at most one active per patient (partial
  unique index); the mockup's "Fisioterapista responsabile" slot.
- `physiotherapist` — additional physiotherapists on the team.
- `personal_trainer`, `massage_therapist` — the two types RLS actually gates.

`responsible_physiotherapist`/`physiotherapist` rows are currently team
roster/visibility metadata only — physiotherapist RLS access remains
capability-only, tenant-wide, per the preserved contract. They are not
inert: the mission asks for the model to support restricting physiotherapist
access to assigned patients in the future, and this table is where that
restriction would attach without a schema change.

## Authorization

- **Who can compose a patient's team**: an active member holding
  `studio.manage_members` (legacy admin, per POL-RBAC-001) or
  `clinical.physiotherapist` — the responsible clinician can build their own
  patient's team without needing an admin for every change
  (`can_manage_patient_assignment_v1`).
- **Who can read a patient's team roster, and how much**: two tiers, per an
  explicit Product Owner decision:
  - `studio.manage_members` and `clinical.physiotherapist` get full-row
    access to `patient_care_assignments` directly (`patient_care_assignments_select`)
    — the "vista completa del team previsto dal contratto."
  - A PT/massage therapist gets **only** the data-minimized
    `patient_care_team_roster_v1(studio_id, patient_id)` function: it returns
    `id, user_id, assignment_type, active` — identity, role in the pathway,
    and status — for the active team of the one patient they are themselves
    actively assigned to, and nothing else. They have **no** raw SELECT
    grant on `patient_care_assignments` for other users' rows at all (only
    their own row, via the `user_id = auth.uid()` branch) — an earlier
    version of this migration granted them full-row table access when
    actively assigned to the same patient (including `created_by`,
    `created_at`/`updated_at`, `ended_at`/`ended_by`, `reason`), which the
    Product Owner rejected as exceeding "identità professionale, ruolo nel
    percorso e stato": *"Non devono poter derivare capability globali, altri
    assignment, altri pazienti o contenuti clinici aggiuntivi tramite il
    roster."* The function is `SECURITY DEFINER`, so this is a genuine
    column-level restriction, not a UI convention — a direct API call gets
    exactly the same four columns regardless of client code.
  - `caller_has_active_patient_assignment_v1` (used by the roster function's
    authorization check) also gained an explicit re-check of the caller's
    own `studio_users.stato = 'attivo'` in this same round — it previously
    only checked that the caller's assignment row was `active`, which does
    not by itself prove they aren't suspended; membership must fail closed
    independently of assignment state, matching every other access path in
    this migration.
- **Valid assignment targets**: the target user must have an active
  membership in the same studio and hold the `studio_user_capabilities` row
  matching the assignment type (`patient_assignment_target_eligible_v1`).
  Assigning a front-desk user as `personal_trainer`, or a user from another
  tenant, is rejected server-side at insert time — not just hidden in the
  UI.
- **Server-enforced authorship**: `created_by` is always overwritten to
  `auth.uid()` on insert; a client-supplied value is discarded
  (`patient_care_assignments_guard_v1` trigger). Assignment identity fields
  (`studio_id`, `patient_id`, `episode_id`, `user_id`, `assignment_type`,
  `created_by`, `created_at`) are immutable after insert — to reassign, end
  the row and create a new one.
- **Revocation**: `UPDATE … SET active=false` is the only supported
  transition; the trigger stamps `ended_at`/`ended_by` from the caller and
  refuses to reactivate or otherwise edit an already-ended row. There is no
  DELETE grant on the table — history is preserved, matching the "prefer
  historical closure over destructive deletion" instruction.

## Fisio RLS changes

`physio_patient_in_studio_v1(studio_id, patient_id)` is redefined in place
(same name/signature), so every existing caller (physio_piani/valutazioni/
obiettivi/diario_sedute/prescrizioni write checks) is tightened without
touching their policy DDL:

- `clinical.physiotherapist` → unchanged, tenant-wide (preserved contract).
- `clinical.personal_trainer` → additionally requires an active
  `patient_care_assignments` row of type `personal_trainer` for that patient.
- `clinical.massage_therapist` → same, for type `massage_therapist`.

POL-RBAC-001's `physio_piani_read`, `physio_obiettivi_read` and
`physio_prescrizioni_read` policies granted read on capability alone (no
patient linkage at all) — that was the actual "PT/massage reads every
patient in the tenant" hole. They are re-scoped to
`physio_patient_in_studio_v1(studio_id, paziente_id)`, matching the
already-patient-scoped write policies.

`physio_esecuzioni` (execution log) had no `created_by` column, so PT/massage
therapists could not record or read their own execution history at all —
only physiotherapists could insert/update it. This migration adds
`created_by` with the same author-enforcement trigger used by
`physio_valutazioni`/`physio_diario_sedute`, and rewrites its three policies
so physiotherapist access remains unrestricted while PT/massage access is
own-authored and assignment-gated through the prescription's patient.

`physio_diario_sedute` and `physio_piani`/`physio_prescrizioni` write checks
already called `physio_patient_in_studio_v1()` — they become assignment-aware
automatically from the function redefinition, no policy DDL changes needed
there. `physio_esercizi` (shared exercise library, no patient linkage) is
unchanged — it is reference data, not clinical content.

`studio_user_capabilities`'s SELECT policy is extended so a caller with
`clinical.physiotherapist` can browse teammates' **clinical.\*** capability
rows only (previously restricted to `studio.manage_members` or one's own
row), which the "Assegna professionista" picker needs to list eligible
collaborators. The extension is capability-prefix-scoped
(`capability LIKE 'clinical.%'`) so a physiotherapist still cannot see who
holds `finance.management.read`, `studio.owner`, `studio.manage_members` or
`home.front_desk` — only `studio.manage_members` sees the full table, as
before.

## Membership suspension and multi-role

Every authorization/eligibility function in this migration re-checks
`studio_users.stato = 'attivo'` on both caller and (for assignment inserts)
target. A suspended membership denies access even when capability and an
active assignment both exist — assignment is additive on top of active
membership, never a bypass. Multi-role capability combinations (e.g.
`clinical.personal_trainer` + `clinical.massage_therapist`) are additive but
each still requires its own matching assignment; holding both capabilities
does not grant access to a patient assigned under only one of them.

## UI

`PhysioCartella.jsx` gains a "Team del percorso" section (visible in both
full and operational modes) showing the active roster grouped by
responsibility, read via `patient_care_team_roster_v1` (never a raw
`patient_care_assignments` select — see "Authorization" above), and, for
whoever holds `studio.manage_members` or `clinical.physiotherapist`
(`canManageTeam`, derived in `SchedaPaz.jsx` from capability only — never
from assignment count or patient data, so the POL-UI-002 "capability decides
what, not how many patients" boundary holds), a "Gestisci team" action to
assign or terminate a professional. The picker only lists same-studio users
whose `studio_user_capabilities` row matches the chosen responsibility.
Every row shown and every action offered is presentation only — hiding
"Gestisci team" is UX, not security; the same server-side authorization
(the roster function's data minimization, and `patient_care_assignments`
RLS for writes) applies to a direct API call from any role, gated exactly
the same way for a PT/massage therapist regardless of which client sends
the request.

`currentUserId`/`isStudioAdmin` are threaded `App.jsx` → `Pazienti.jsx` /
`SchedaPaz.jsx` → `PhysioCartella.jsx`; no other prop wiring changed.

## What this task does not touch

Setup → Collaboratori (`GestioneUtenti.jsx`, capability grant/revoke) is
unchanged — that is the CAPABILITY layer, a separate concept from the
ASSIGNMENT layer this task adds, per the mission's explicit separation.
POL-UI-002 preset/widget resolution is unchanged: Home continues to read
`get_my_studio_capabilities_v1` only; assignment never determines a preset.
Outcome measures, body maps, AI, dictation, management-control widgets and
the patient app are out of scope, as before.

## Rollback boundary

A controlled rollback must, in order: restore POL-RBAC-001's five replaced
Fisio read policies and `physio_patient_in_studio_v1` definition, drop the
`physio_esecuzioni` author trigger/column and its three replaced policies,
restore `studio_user_capabilities_select`, then drop the assignment
table/triggers/functions/indexes. Rolling back only part of this (e.g. the
table but not the tightened Fisio policies) would leave PT/massage_therapist
with zero patients rather than fail-open, which is safe but breaks the
feature — not a security regression either way, since the tightened
policies fail closed on their own. Production rollback requires a separate
Product Owner gate; nothing in this task touches production.
