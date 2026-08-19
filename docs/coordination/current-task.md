# Current task

- TASK: POL-RBAC-001A
- TITLE: Patient / Care Assignment (authoritative capability + assignment separation)
- OWNER: CLAUDE
- PREVIOUS TASK/OWNER: POL-RBAC-001, CODEX, `WAITING_PRODUCT_OWNER` (unchanged; POL-RBAC-001A is a new, additive follow-up task opened directly by the Product Owner directive that started this session, not a takeover of POL-RBAC-001's ownership)
- BRANCH: `security/POL-RBAC-001-authoritative-capabilities` (same branch/PR #16; POL-RBAC-001A commits are additional commits on top, not a new branch)
- BASE REVIEW: `ui/POL-UI-002-canonical-financial-widgets-presets` / PR #15 (unchanged, still stacked; POL-UI-002 preserved intact)
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Close the residual risk the Product Owner identified in POL-RBAC-001: a
`clinical.personal_trainer`/`clinical.massage_therapist` capability alone let
a user read every Fisio patient in the tenant. Separate CAPABILITY ("may act
as X") from ASSIGNMENT ("may act on THIS patient"), add a tenant-safe
`patient_care_assignments` table, and make PT/massage_therapist Fisio RLS
require an active assignment. Physiotherapist access stays tenant-wide
per the already-approved contract. Add a minimal "Team del percorso"
UI to view/manage a patient's assigned professionals.

## Safety boundaries

- No automatic patient/professional assignments are inferred or seeded in
  any migration; only synthetic test fixtures create assignment rows.
- Assignment authorization requires active membership on both caller and
  target, in the same tenant; suspended membership denies access even with
  a matching capability and an active assignment.
- Physiotherapist Fisio access is unchanged (tenant-wide by capability) —
  not accidentally narrowed by this task.
- No production access, remote migration, backfill, deployment or merge is
  authorized or performed.

## Completion state

`patient_care_assignments` (additive table), its authorization/eligibility
helper functions, author-enforcement/immutability trigger and RLS are
implemented in one migration stacked after POL-RBAC-001's. Redefining
`physio_patient_in_studio_v1` in place tightens all its existing callers;
the three Fisio READ policies that previously granted tenant-wide access on
capability alone are re-scoped to patient level; `physio_esecuzioni` gains
server-enforced authorship so PT/massage_therapist can record and read their
own execution log. `studio_user_capabilities` SELECT is extended so a
physiotherapist can browse teammate capabilities for the "Assegna
professionista" picker. `PhysioCartella.jsx` gains a "Team del percorso"
section and management modal, gated client-side by capability
(`canManageTeam`) purely for UX — RLS is authoritative. POL-FIS-001's
episode concept is not merged/stable relative to this branch, so
`episode_id` is a nullable adapter onto the existing `physio_piani` table,
isolated and documented for future convergence — this did not block the
tenant/RLS/assignment work.

Validation passed locally: original 20 POL-UI-002 + 6 POL-RBAC-001 Node/SQL
regressions (with the RBAC fixture updated for the new assignment-gated
contract), all POL-RBAC-001A SQL assertions (Studio A/B, Patient A/B, PT1/
PT2/Massage1/multi-role/suspended/cross-tenant/revocation/author-spoofing/
assignment-management-authorization), 4 new Node tests, and a clean Vite
production build. See `docs/architecture/pol-rbac-001a-local-validation.md`.

## Residual risks

- Docker was unavailable in this sandbox, so `supabase db lint`/advisors/
  `plpgsql_check` could not be run; validated instead against a disposable
  local PostgreSQL 16 database with `ON_ERROR_STOP=1`. Recommend running the
  Docker-based Supabase toolchain before merge if available to the next
  reviewer.
- `episode_id` targets `physio_piani`, not a real POL-FIS-001 episode.
  `PRODUCT_OWNER_DECISION_REQUIRED`: when POL-FIS-001 merges and stabilizes,
  decide whether to repoint/rename this column or introduce a mapping
  migration.
- Physiotherapist Fisio access remains tenant-wide (unchanged from
  POL-RBAC-001); the model supports but does not yet implement per-patient
  restriction for physiotherapists, as the mission anticipated as future
  work.
- Team-roster visibility for an assigned PT/massage therapist is scoped to
  patients they are themselves actively assigned to (not the whole tenant);
  this is a judgment call beyond the mission's literal text, documented in
  `docs/architecture/pol-rbac-001a-patient-care-assignment.md`.
- Existing dependency advisories (`npm audit`) and pre-existing build
  warnings remain outside this task's scope, unchanged from prior handoffs.

## Exact next action

Product Owner and Tech Lead review the stacked POL-RBAC-001 + POL-RBAC-001A
commits together on PR #16. Validate the assignment model, the
`episode_id`/POL-FIS-001 adapter decision, and the physiotherapist-team
visibility judgment call above. Do not apply remotely, deploy, merge
POL-RBAC-001A/POL-RBAC-001, or merge PR #15/#16 without explicit Product
Owner approval.
