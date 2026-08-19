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

**PostgreSQL 16 was preliminary development only.** Per explicit Product
Owner instruction, the full required checklist (migration chain, POL-RBAC-001
regression, POL-RBAC-001A assignment regression, RLS two-tenant, assignment/
revoke, suspended user, author spoofing, cross-tenant, unassigned PT,
unassigned massage therapist, physiotherapist flow, build, Node test,
secret/diff/scope check) was re-run unmodified against a genuine
**PostgreSQL 17.5** engine — Docker and `apt.postgresql.org` are both denied
by this sandbox's network policy (confirmed with concrete 403s against three
independent hosts: PGDG apt, Supabase's own Docker image blob storage, and
plain Docker Hub's blob storage), so PostgreSQL 17.5 was obtained via
`@electric-sql/pglite` — a real Postgres compiled from unmodified source to
WASM, distributed on the (allowlisted) npm registry — after an RLS smoke
test confirmed it enforces roles/policies/`set_config` correctly, not a stub.
Every item on the list passed on PostgreSQL 17.5 except `supabase db lint`,
which ran for real but against PostgreSQL 16 (the TCP adapter needed to
expose PGlite over the wire protocol only supports the PostgreSQL 18 PGlite
line, confirmed by a hung handshake when forced against 17.5) — flagged
below as `PRODUCT_OWNER_DECISION_REQUIRED` if a literal PG17 CLI-lint run is
required before merge. Full engine-by-engine breakdown, transcripts and the
exact hosts/errors: `docs/architecture/pol-rbac-001a-local-validation.md`.

Two self-review passes after the initial push (a code-review pass and a
dedicated security-review pass) each found and fixed one real least-privilege
issue, both since regression-tested: (1) the `studio_user_capabilities`
extension for physiotherapists originally exposed every capability row in
the studio, not just `clinical.*` ones — narrowed with
`capability LIKE 'clinical.%'`; (2) `patient_care_assignments_select`'s
"shared patient" branch checked the caller's active assignment but not
whether the row being read was itself active, letting a teammate see another
professional's ended assignment and its free-text termination reason —
fixed by requiring the read row's own `active` flag. The responsive
"Team del percorso" UI (375/768/1024/1440px) was also verified by
screenshotting the shipped component's exact markup/styles headlessly (the
live app cannot be driven in this sandbox without touching the real
production Supabase project it's hardcoded to, which the safety rules
forbid) — see the local-validation doc for details and results.

## Residual risks

- `supabase db lint` ran against PostgreSQL 16, not PostgreSQL 17 (see above)
  — the schema/policy checks it performs are static, not version-dependent,
  and it reported no errors, but a literal PG17 CLI-lint run needs Docker or
  PGDG apt access this sandbox's network policy does not grant.
  `PRODUCT_OWNER_DECISION_REQUIRED` if that's required before merge.
  Security/performance advisors (Supabase-hosted) remain unavailable in this
  sandbox for the same reason on either engine.
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
