# POL-RBAC-001A — Local validation

Status: `PASSED_LOCAL_ONLY`

## Environment

- Engine: PostgreSQL 16.13 (Ubuntu), local `postgresql-16` service — the
  session's sandbox has no Docker daemon, so the disposable-container Supabase
  Postgres 17 image used by prior POL-RBAC-001/POL-UI-002 validation was not
  available; a local, disposable, network-isolated PostgreSQL 16 database was
  used instead. No RLS, trigger or function construct in this migration is
  version-specific between 16 and 17.
- Data: ten+ synthetic users across two synthetic studios, three synthetic
  patients; no production data.
- Migration order: `pol_rbac_001_local_bootstrap.sql` (Studio A/B, users,
  Patient A=101/Patient in Studio B=201) → `physio_schema_dati.sql` → POL-RBAC-001
  migration → POL-RBAC-001A migration → `pol_rbac_001a_local_bootstrap.sql`
  (adds Patient B=102 in Studio A, PT2/a10 users) → SQL regression.

## Results

### Regression (existing, updated for the new contract)

`supabase/tests/pol_rbac_001_authoritative_capabilities.sql` — all 6
original assertions still pass. The PT/massage_therapist assertions now seed
an explicit active assignment first (PT1→101, Massage1→101), since capability
alone is no longer sufficient under POL-RBAC-001A; this is the intended
behavior change, not a regression.

### New: `supabase/tests/pol_rbac_001a_patient_care_assignment.sql`

Studio A: Patient A (101), Patient B (102). PT1 assigned only to Patient A.
Massage1 assigned only to Patient B. PT2 (a9) has the capability but no
assignment. Multi-role user (a6, PT+massage) starts unassigned, then is
assigned as massage_therapist to Patient A only. Studio B provides the
cross-tenant physiotherapist.

All of the mission's required scenarios passed:

- PT1: reads Patient A's plan/goals/prescriptions, registers and reads its
  own diary activity on A, cannot read full evaluations, cannot read/write
  Patient B, cannot modify the physiotherapy plan, cannot modify another
  professional's diary entry.
- Massage1: symmetric result on Patient B; denied on Patient A; cannot
  modify plan or another professional's activity.
- PT2 (unassigned): zero clinical access to either patient.
- Front desk: zero clinical access.
- Non-clinical owner: zero automatic clinical access.
- Physiotherapist: unrestricted tenant-wide read (both patients, both
  evaluations) — confirms the preserved contract was not accidentally
  narrowed.
- Multi-role: capability alone (unassigned) grants nothing; once assigned as
  one type, access is scoped to that assignment only, not to every
  capability held.
- Cross-tenant: Studio B physiotherapist has zero Studio A access, full
  access to its own tenant only.
- Suspended membership: a physiotherapist granted an assignment while
  active, then suspended, loses all access even though capability and
  assignment both still exist.
- Assignment revocation: deactivating PT1's assignment removes its access
  immediately in the same session; `ended_by`/`ended_at` are recorded
  server-side.
- Author spoofing: a `physio_esecuzioni` insert with a forged `created_by`
  is silently corrected to the caller; an assignment insert with a forged
  `created_by` is silently corrected to the caller.
- Assignment management authorization: physiotherapist can assign and can
  browse teammate capabilities for the picker; front desk cannot assign;
  a PT cannot self-assign or deactivate a teammate's assignment; assigning a
  target without the matching capability, or from another tenant, is
  rejected server-side; a second active `responsible_physiotherapist` for
  the same patient is rejected by a unique index; assignment identity
  fields are immutable after insert; DELETE is not granted at all (no
  destructive removal path).
- Direct API/RLS test: every assertion above runs at the SQL/RLS layer
  directly (`SET ROLE authenticated` + `request.jwt.claims`), not through
  any frontend code path.

### Full regression re-run

- POL-UI-002 original: 20/20 Node tests passed (unchanged by this task).
- POL-RBAC-001 original: 6/6 SQL assertions passed (updated fixtures, see
  above).
- POL-RBAC-001A new: all SQL assertions in
  `pol_rbac_001a_patient_care_assignment.sql` passed.
- Node suite: 30/30 passed (`npm test`), including 4 new POL-RBAC-001A
  assertions covering patient-scoped queries, no client-supplied
  `created_by`, `canManageTeam` gating on capability only, and the
  eligibility filter in the assignment picker.
- `npm run build` (Vite production build): passed, only pre-existing pdfjs
  eval and chunk-size warnings remain.
- Ad hoc RLS/lint sanity: `patient_care_assignments` and `physio_esecuzioni`
  both have `relrowsecurity = true`; policy list confirmed one SELECT/INSERT/
  UPDATE policy each on `patient_care_assignments`, no DELETE policy.
- Responsive verification at 375/768/1024/1440 px: the live app cannot be
  driven in this sandbox — its Supabase client is hardcoded to a real
  project (`src/lib/supabase.js`), and connecting to it would be exactly the
  "production access" this task's safety rules forbid. Instead, the "Team
  del percorso" card, "Gestisci team" modal and "Assegna professionista"
  form were reproduced as static markup using the exact inline styles from
  `PhysioCartella.jsx`'s `SezioneTeam` and the shared `Crd`/`Fld`/`Modal`
  components it reuses, then screenshotted headlessly with the sandbox's
  pre-installed Chromium at all four required widths. Confirmed: single-
  column stacking with ≥40px touch targets at 375px; the roster groups lay
  out via `repeat(auto-fit, minmax(160px,1fr))` into 2-3 columns at
  768/1024/1440px with no overflow; the modal is a full-width bottom sheet
  on mobile and a centered, width-capped (480px) sheet on desktop — matching
  the "drawer on mobile, not full-screen on desktop" requirement — with no
  horizontal scrolling at any width. This validates the CSS actually shipped,
  not a live end-to-end app session (no auth, no real data, no network calls
  to Supabase were involved).
- `git diff --check`: clean. Targeted secret-pattern scan over the full diff
  against the PR #16 branch: no matches (no service-role keys, private keys,
  or other credential patterns).
- Scope check: diff touches only the files listed in the handoff below;
  Setup/Collaboratori (`GestioneUtenti.jsx`), POL-UI-002 preset/widget logic,
  and financial code are untouched.

## Not run

- Docker-based Supabase local stack (`supabase db lint`, security/performance
  advisors, `plpgsql_check`) — unavailable in this sandbox (no Docker daemon).
  The migration was instead validated directly against a disposable
  PostgreSQL 16 database with `ON_ERROR_STOP=1`, which caught every syntax
  and logic defect found during development (recorded as fixed below).
- No remote Supabase command, production query, deployment or merge
  occurred at any point.

## Defects found and fixed during local validation

- A dedicated security-review pass (post-push, before Product Owner review)
  found that `patient_care_assignments_select`'s "shared patient" branch
  gated on the *caller's* active assignment but did not filter the *row
  being read* by `active`, so a teammate with any active assignment to a
  patient could read every historical row for that patient — including
  another professional's ended assignment, its free-text `reason`, and
  `ended_by`/`ended_at` — not just the active roster the migration's own
  comment promised. Fixed by requiring the read row itself to be `active`
  in that branch; added a regression assertion (an active teammate cannot
  see another professional's just-ended row) and re-validated the full
  local suite.
- Also caught in review: the `studio_user_capabilities` SELECT extension for
  physiotherapists initially had no capability-prefix filter, letting a
  physiotherapist read the studio's non-clinical capability rows (who holds
  `finance.management.read`, `studio.owner`, `studio.manage_members`,
  `home.front_desk`) — narrowed to `capability LIKE 'clinical.%'` with a
  negative regression assertion added.
- `to_regproc()` does not accept a parenthesized signature; preflight check
  fixed to use `to_regprocedure()`.
- The assignment table's tenant-safety/immutability trigger initially ran
  `SECURITY INVOKER` and could not read `public.patients` under the
  `authenticated` role (no direct grant); changed to `SECURITY DEFINER`
  with `search_path=''`, matching every other helper function in this
  migration.
- The assignment SELECT policy's original self-referencing `EXISTS`
  subquery on the same table caused Postgres to report "infinite recursion
  detected in policy"; replaced with a `SECURITY DEFINER` helper function
  (`caller_has_active_patient_assignment_v1`), the same pattern already used
  to avoid RLS recursion elsewhere in this codebase.
- Two seeding statements in the new SQL test used `RESET ROLE` (table-owner
  bypass) while `request.jwt.claims` still held a previous session's value,
  so the author-enforcement trigger silently attributed the fixture row to
  the wrong (previous) user instead of `NULL`/the intended author — fixed by
  seeding through the real `authenticated`+JWT-claim path everywhere an
  author-enforced table is touched, which now also exercises the INSERT RLS
  policy as part of fixture setup rather than bypassing it.
