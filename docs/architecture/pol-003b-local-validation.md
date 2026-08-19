# POL-003B local validation

## Environment

- disposable Docker container `pol003b-pg17`;
- Supabase PostgreSQL `17.6.1.159`;
- synthetic schema and records only;
- no production export, patient data, remote migration, deploy or application write.

## Results

- POL-003A financial engine migration: passed on a clean local database.
- POL-003B adapter migration: passed; installation performed no adapter execution.
- `pol_003b_legacy_adapter.sql`: passed and rolled back all synthetic mutations.
- POL-003A full financial regression suite: passed unchanged.
- Shadow reconciliation SQL: passed in a read-only transaction and returned the four expected aggregate metric rows.
- `plpgsql_check` for `private.run_pol_003b_legacy_adapter_v1(uuid)`: zero errors/warnings.

The adapter test covers percentage and fixed discounts, partial execution, a settled payment that remains unallocated/advance-compatible, partial/overpayment behavior, invalid and missing execution data, cancelled legacy state without an invented cancellation event, negative payment without an invented refund, fiscal invoice/refund rows without an invented invoice/credit note, unreconciled external payments, historical cost exclusion, two tenants, multiple unverified operator hints, idempotency and tenant-scoped repeat execution.

`supabase db lint --db-url` was attempted against the Docker Desktop port mapping, but the WSL CLI could not reach that local port. Static PL/pgSQL validation was therefore performed with the image-provided `plpgsql_check`; all executable SQL paths were additionally exercised by migration and regression tests. This is a local tooling limitation, not a database test failure.

Production security/performance advisors were read in place without changes. They continue to report pre-existing repository-wide findings, including RLS-enabled tables without policies, broadly executable `SECURITY DEFINER` functions, RLS initialization-plan inefficiencies, multiple permissive policies and currently unused indexes. These findings predate and are outside POL-003B; the unapplied adapter cannot appear in production advisor output.

## Remaining gate

These tests prove deterministic behavior against verified schema and synthetic rows. They do not authorize or validate a production backfill. Production execution, canonical row insertion, frontend cutover and legacy RPC replacement remain separately gated.
