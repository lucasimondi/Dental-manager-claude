# POL-003A deployment alignment

Date: 2026-08-21

Environment: disposable local PostgreSQL 16, synthetic identifiers and amounts only

## Problem

Production Supabase currently exposes only `public.get_financial_snapshot_v1(date,date)`.
The frontend on `master` calls it as `get_financial_snapshot_v1(p_data_inizio, p_data_fine, p_studio_id)`,
which requires the 3-argument signature added by
`supabase/migrations/20260821120000_pol_003a_tenant_access_fix.sql`. That migration is
present in the repository (merged to `master` via PR #26) but has not been applied to the
production database, so PostgREST's schema cache has no matching function and every call
fails with:

```
Could not find the function public.get_financial_snapshot_v1(p_data_fine, p_data_inizio, p_studio_id) in the schema cache
```

This is a deployment/migration sequencing gap, not a code defect. The frontend must keep
calling the 3-argument form — reverting it to the legacy 2-argument call, adding a legacy
fallback, dropping `p_studio_id`, or weakening RBAC/RLS to work around the symptom would
reintroduce the POL-003A "access denied" bug the migration fixes and was explicitly out of
scope for this hotfix.

## Migration review (20260821120000_pol_003a_tenant_access_fix.sql)

Re-read in full for this hotfix. Confirmed:

- Adds `p_studio_id uuid DEFAULT NULL` to `get_financial_snapshot_v1` and
  `get_financial_drilldown_v1` via `DROP FUNCTION IF EXISTS ... ` (old exact 2/3-arg
  signatures) followed immediately by `CREATE FUNCTION` with the new signature — the only
  two `DROP` statements in the file, both expected and immediately replaced; no other object
  is dropped.
- `private.financial_has_tenant_access_v1` and all eight `financial_*_v1` RLS `SELECT`
  policies are byte-for-byte untouched — the migration never redefines that function, only
  calls it (line 118) — so RLS and the existing JWT-anchored tenant-isolation behavior for
  every other caller are unaffected.
- Adds one new, narrowly-scoped function,
  `private.financial_verified_studio_membership_v1(p_studio_id uuid)`, mirroring
  `has_studio_capability_v1`'s existing pattern: `auth.uid() IS NOT NULL AND p_studio_id IS
  NOT NULL AND EXISTS (active studio_users membership)` — no JWT dependency, granted to
  `authenticated` only, revoked from `PUBLIC`/`anon`.
- `get_financial_drilldown_v1` only sets its transaction-local
  `request.financial_studio_override_v1` GUC after that verification succeeds, and
  explicitly clears it when `p_studio_id` is omitted — so a call without `p_studio_id` always
  gets pure JWT-only resolution, never a value leaked from an earlier call in the same
  transaction.
- No DML, no destructive data mutation; purely function/grant definitions inside a single
  transaction (`BEGIN` … `COMMIT`).

No second migration was created — the existing file is correct and additive; a duplicate
would only add churn.

## Local validation (this hotfix)

Fresh disposable database, `supabase/tests/pol_003b_local_bootstrap.sql` +
`20260818190642_pol_003_financial_engine_v1.sql` +
`20260821120000_pol_003a_tenant_access_fix.sql`, run with `ON_ERROR_STOP=1`:

- Migration applies cleanly, no errors.
- `\df` confirms the deployed signatures: `get_financial_snapshot_v1(date,date,uuid DEFAULT
  NULL)` and `get_financial_drilldown_v1(date,date,text,uuid DEFAULT NULL)` — the exact
  3-argument shape the frontend calls.
- `supabase/tests/pol_003_financial_engine.sql` (all ~26 synthetic scenarios plus the
  POL-003A regression block, now including a new **cross-tenant** case added for this
  hotfix — a real, active member of one studio explicitly naming a *different* real studio's
  `p_studio_id` stays denied, not just a user with no membership at all): all pass, rolled
  back.
- `supabase/tests/pol_003f_costs_hours_adapter.sql` (built on top of the same fix): passes
  unchanged.
- Local Postgres cluster and scratch databases stopped/dropped after validation.

## Production boundary

No production database was queried or modified during this review. Applying
`20260821120000_pol_003a_tenant_access_fix.sql` to production, and reloading PostgREST's
schema cache afterward, requires explicit Product Owner authorization and is **not**
performed by this hotfix.
