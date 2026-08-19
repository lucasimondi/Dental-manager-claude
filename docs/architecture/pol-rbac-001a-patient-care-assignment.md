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

### POL-FIS-001 adapter, not a dependency

`episode_id` is nullable and references `physio_piani(id)` — the only
stable, already-merged concept that plays the "episode/care-path" role in
this codebase today. POL-FIS-001 (PR #14, physiotherapy clinical core) is
**not merged** and its `physio_episodes_v1` contract is not stable relative
to this branch: that PR is based on an earlier point in history and removes
files (POL-UI-001/POL-003F) this branch depends on, so it cannot be adopted
as-is without an incompatible rewrite. Per the task's dependency-handling
instructions, this migration does not depend on POL-FIS-001. All RLS gating
in this migration operates at **patient granularity only** (`patient_id`);
`episode_id` is carried as forward-compatible metadata and is not read by any
policy. When POL-FIS-001's episode contract stabilizes and merges, a
follow-up migration should repoint/rename this column onto
`physio_episodes_v1` — flagged here as `PRODUCT_OWNER_DECISION_REQUIRED` for
that future convergence, not something this task resolves.

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
`clinical.physiotherapist` can browse teammates' capabilities (previously
restricted to `studio.manage_members` or one's own row), which the
"Assegna professionista" picker needs to list eligible collaborators. This
does not expose more than "this user may act as X in this studio."

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
responsibility, and, for whoever holds `studio.manage_members` or
`clinical.physiotherapist` (`canManageTeam`, derived in `SchedaPaz.jsx` from
capability only — never from assignment count or patient data, so the
POL-UI-002 "capability decides what, not how many patients" boundary holds),
a "Gestisci team" action to assign or terminate a professional. The picker
only lists same-studio users whose `studio_user_capabilities` row matches
the chosen responsibility. Every row shown and every action offered is
presentation only — hiding "Gestisci team" is UX, not security; the same
`patient_care_assignments` RLS applies to a direct API call from any role.

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
