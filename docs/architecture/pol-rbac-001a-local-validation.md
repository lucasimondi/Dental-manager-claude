# POL-RBAC-001A — Local validation

Status: `PASSED_LOCAL_ONLY` — preliminary (PostgreSQL 16) **and** final
(PostgreSQL 17) validation both passed. See the Product Owner note in the
"PostgreSQL 17 final validation" section for why two engines were used and
exactly what each one covers; do not read the PostgreSQL 16 section alone as
the completion gate.

## Product Owner decisions applied this round

Two decisions were requested and recorded verbatim in
`docs/architecture/pol-rbac-001a-patient-care-assignment.md`:

1. **`episode_id → physio_piani` approved as a transitional compatibility
   layer only.** The implementation already matched this exactly (nullable,
   patient-level-only RLS gating, no second episode model, no backfill
   anywhere) — this was a **documentation-only** change: the migration's
   table/column comments and header, plus the architecture doc, now use the
   Product Owner's exact "transitional compatibility layer" framing and
   record the decision verbatim.
2. **PT/massage therapist roster visibility restricted to identity/role/
   status of the active team, with no way to derive global capabilities,
   other assignments, other patients or clinical content.** The
   implementation **did not** already satisfy this — checked before touching
   anything, not assumed. Two real gaps, both fixed:
   - The "shared teammate" branch of `patient_care_assignments_select`
     granted full-row SELECT (including `created_by`, `created_at`/
     `updated_at`, `ended_at`/`ended_by`, `reason`, `episode_id`) to any
     active teammate on the same patient — a direct API call bypassing the
     UI could read all of it. Fixed by removing that branch entirely (base
     table SELECT is now admin/physiotherapist/own-row only) and adding
     `patient_care_team_roster_v1(studio_id, patient_id)`, a `SECURITY
     DEFINER` function that returns exactly `id, user_id, assignment_type,
     active` — a genuine column-level restriction, not a convention, since
     the function's return type structurally cannot carry the extra columns
     regardless of caller. `PhysioCartella.jsx` now reads the roster
     exclusively through this RPC.
   - While rebuilding this path, found `caller_has_active_patient_assignment_v1`
     never re-checked the caller's own `studio_users.stato = 'attivo'` — a
     suspended user whose assignment row was still `active=true` could still
     pass it. Fixed with a join to `studio_users`, and applied the same
     membership check to the *listed* rows in the roster function (a
     suspended team member's still-`active=true` assignment no longer
     appears as part of "the active team" to anyone).
   - Both fixes are strictly narrowing (nothing gained access that didn't
     already have it) and are covered by nine new regression assertions.

## Why two Postgres engines appear in this document

Prior POL-RBAC-001/POL-UI-002 validation ran against a disposable Supabase
Postgres 17 Docker image. This sandbox has no Docker daemon and its network
policy explicitly denies `apt.postgresql.org` (blocks installing PostgreSQL
17 via the standard PGDG apt repo) and the Docker Hub / AWS ECR public CDNs
(blocks pulling *any* Docker image, confirmed with concrete 403s from the
proxy — see below). PostgreSQL 16 from Ubuntu's own default archive is the
only real, native Postgres server directly installable in this sandbox.

Per the Product Owner's explicit instruction, PostgreSQL 16 is preliminary
development only and is **not** the completion gate. Section "PostgreSQL 17
final validation" below documents how a genuine PostgreSQL 17 engine was
still obtained and used to re-run the complete required checklist, and
distinguishes exactly what ran on each engine.

## PostgreSQL 16 — preliminary development validation

- Engine: PostgreSQL 16.13 (Ubuntu), local `postgresql-16` service.
- Data: ten+ synthetic users across two synthetic studios, three synthetic
  patients; no production data.
- Migration order: `pol_rbac_001_local_bootstrap.sql` (Studio A/B, users,
  Patient A=101/Patient in Studio B=201) → `physio_schema_dati.sql` → POL-RBAC-001
  migration → POL-RBAC-001A migration → `pol_rbac_001a_local_bootstrap.sql`
  (adds Patient B=102 in Studio A, PT2/a10 users) → SQL regression.
- This is where the migration and both regression test files were originally
  authored and debugged (see "Defects found and fixed" below) before being
  re-run unmodified against PostgreSQL 17.

## PostgreSQL 16 results (preliminary development)

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

## PostgreSQL 17 — final validation (completion gate)

Per Product Owner instruction, PostgreSQL 16 above is preliminary
development only. This section is the actual completion gate and was run
**after** the PostgreSQL 16 pass, against every file exactly as committed —
no migration or test file was edited between the two runs.

### Engine and how it was obtained

Docker (`dockerd`) is not running by default in this sandbox and its network
policy denies the hosts needed to get PostgreSQL 17 the way prior tasks did:

| Attempted source | Host | Result |
|---|---|---|
| PGDG apt repo (`postgresql-17` package) | `apt.postgresql.org` | Proxy: `403`, policy denial |
| Supabase's own Postgres 17 Docker image | `d2glxqk2uabbnd.cloudfront.net` (ECR blob storage) | Proxy: `403`, policy denial |
| Plain `postgres:17` Docker image | `production.cloudfront.docker.com` (Docker Hub blob storage) | Proxy: `403`, policy denial |

(`dockerd` itself was started successfully and `docker pull` reached the
registry API — the image *manifests* resolved — but every actual layer
download was blocked by the proxy at the blob-storage host, for all three
sources above, each on a different host. This is the sandbox's network
allowlist policy, not a transient failure.)

**What did work:** `@electric-sql/pglite` — a real PostgreSQL server compiled
to WASM from unmodified Postgres source (not a reimplementation), published
entirely on the npm registry (which *is* allowlisted, unlike Docker/PGDG).
Version `0.4.6` bundles genuine **PostgreSQL 17.5**, confirmed directly:

```
PostgreSQL 17.5 on wasm32-unknown-linux-gnu, compiled by emcc ...
```

A smoke test first confirmed PGlite correctly enforces the exact mechanisms
this migration depends on — `CREATE ROLE`/`SET ROLE`, `GRANT ... TO`,
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, and
transaction-scoped `set_config(..., true)` (used to simulate
`request.jwt.claims` exactly as Supabase's PostgREST does) — before it was
trusted for the real regression: two synthetic users with a
`FOR SELECT USING (owner = auth.uid())` policy each saw only their own row,
confirming real RLS enforcement, not a stub.

This is a different real Postgres 17 build than the Supabase-patched
`17.6.1.159` Docker image prior tasks used (vanilla PG 17.5 vs. Supabase's
17.6.1 patch build) — close, not byte-identical. It is **not** a
lower-fidelity substitute in any way that matters to this migration: no
Supabase-specific extension or patch is used anywhere in
`20260819210000_pol_rbac_001a_patient_care_assignment.sql` or the prior
POL-RBAC-001 migration it stacks on — every construct is core PostgreSQL
(tables, RLS, `SECURITY DEFINER` SQL/plpgsql functions, triggers, partial
unique indexes, `GRANT`/`REVOKE`). If the Product Owner requires the exact
Supabase-patched build specifically, that remains
`PRODUCT_OWNER_DECISION_REQUIRED` — see "Residual gap" below.

### What ran on PostgreSQL 17, mapped to the Product Owner's required list

Re-confirmed after the roster data-minimization and membership-suspension
fixes above (same seven-file chain, same PostgreSQL 17.5 PGlite engine, same
transcript shape below — the nine new regression assertions for both fixes
are included in `pol_rbac_001a_patient_care_assignment.sql` and passed).

All seven files were applied via one persistent PGlite (PostgreSQL 17.5)
instance, executed in commit order with no edits, `ON_ERROR_STOP`-equivalent
(any error aborts the run — see script below): `pol_rbac_001_local_bootstrap.sql`
→ `physio_schema_dati.sql` → POL-RBAC-001 migration → POL-RBAC-001A migration
→ `pol_rbac_001a_local_bootstrap.sql` → `pol_rbac_001_authoritative_capabilities.sql`
→ `pol_rbac_001a_patient_care_assignment.sql`.

| Required item | Result on PostgreSQL 17.5 |
|---|---|
| Migration chain completa | ✅ all 4 migration/bootstrap files applied cleanly in order |
| POL-RBAC-001 regression | ✅ all 6 original assertions passed (`pol_rbac_001_authoritative_capabilities.sql`) |
| POL-RBAC-001A assignment regression | ✅ every assertion in `pol_rbac_001a_patient_care_assignment.sql` passed |
| RLS due tenant (Studio A/B) | ✅ Studio B physiotherapist: 0 Studio A rows, full own-tenant access |
| Assignment/revoke | ✅ PT1 loses Patient A access in the same session immediately after `active=false`; `ended_by`/`ended_at` recorded |
| Utente sospeso | ✅ physiotherapist granted an assignment while active, then suspended: 0 access despite capability + assignment both present |
| Author spoofing | ✅ forged `created_by` on both `physio_esecuzioni` and `patient_care_assignments` inserts silently corrected to the caller |
| Cross-tenant | ✅ Studio B user: 0 rows across Studio A patients, in both regression files |
| PT non assegnato | ✅ PT2 (capability, no assignment): 0 clinical access to either patient |
| Massaggiatore non assegnato | ✅ symmetric: Massage1 denied on Patient A (only assigned to Patient B) |
| Physiotherapist flow | ✅ unrestricted tenant-wide read/write on both patients — preserved contract confirmed, not narrowed |
| Database lint | ⚠️ see "Residual gap" below — ran on PostgreSQL 16, not 17 |
| Build | ✅ `npm run build` — engine-independent (Vite/JS only), re-confirmed clean after the PG17 pass |
| Node test | ✅ `npm test` 30/30 — engine-independent, re-confirmed after the PG17 pass |
| Secret/diff/scope check | ✅ `git diff --check` clean; targeted secret-pattern scan over the full POL-RBAC-001A diff: no matches; scope confined to the 13 files listed in the handoff |

Runner script: `run-pg17.js` (kept out of the repo — a one-off validation
harness, not a project dependency), reads each file with Node `fs`, executes
via `db.exec()` against one `PGlite()` instance, and aborts on first thrown
error. Full transcript:

```
ENGINE: PostgreSQL 17.5 on wasm32-unknown-linux-gnu, ...
--- supabase/tests/pol_rbac_001_local_bootstrap.sql ... OK
--- supabase/migrations/20260818000000_physio_schema_dati.sql ... OK
--- supabase/migrations/20260819200029_pol_rbac_001_authoritative_capabilities.sql ... OK
--- supabase/migrations/20260819210000_pol_rbac_001a_patient_care_assignment.sql ... OK
--- supabase/tests/pol_rbac_001a_local_bootstrap.sql ... OK
--- supabase/tests/pol_rbac_001_authoritative_capabilities.sql ... OK
--- supabase/tests/pol_rbac_001a_patient_care_assignment.sql ... OK
ALL FILES APPLIED CLEANLY
```

Every `pg_temp.assert_true(...)` call in both regression files — the same
assertions listed in the PostgreSQL 16 section above — ran and passed inside
this transcript; a failure would have raised and aborted the run.

### Residual gap: `supabase db lint` ran on PostgreSQL 16, not 17

The Supabase CLI (`supabase db lint --db-url ...`) needs a live
TCP/wire-protocol Postgres server (not PGlite's in-process WASM instance)
and the `plpgsql_check` extension. `@electric-sql/pglite-socket` (a TCP
adapter for PGlite) exists on npm, but every published version requires
PGlite `>=0.5.0` — a jump to **PostgreSQL 18**, not 17 — as an exact peer
dependency; forcing it against the 0.4.6/PG17.5 line produced a socket that
accepted TCP connections but hung on the wire-protocol handshake (confirmed,
not assumed — `psql` timed out after 2 minutes), so that combination is not
usable. Ubuntu's own archive (already reachable, unrelated to the blocked
hosts above) does carry `postgresql-16-plpgsql-check`, so `db lint` was run
for real against local PostgreSQL 16 with `plpgsql_check` installed:

```
Linting schema: auth
Linting schema: public

No schema errors found
```

This exercises the actual Supabase CLI and the actual schema/policy
definitions (lint's checks are schema-static, not data- or
transaction-dependent), just not on a PostgreSQL 17 server process. Getting
`db lint` running against genuine PostgreSQL 17 specifically would need
either Docker/PGDG network access this sandbox's policy does not grant, or a
`pglite-socket` release compatible with the PG17.5 PGlite line, which does
not currently exist on npm. Flagged as `PRODUCT_OWNER_DECISION_REQUIRED` if
a CLI-lint-on-literal-PG17 run is required before merge — it would need to
happen in an environment with Docker or PGDG apt access.

## Not run (either engine)

- Security/performance advisors — Supabase-hosted analysis tooling, requires
  a linked or Docker-run Supabase project; not available without the network
  access documented above.
- No remote Supabase command, production query, deployment or merge
  occurred at any point, on either engine.

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
