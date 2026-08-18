# POL-002A local validation

Date: 2026-08-18

## Isolation and data handling

- Runtime: Ubuntu WSL2 with Docker Engine, no Docker Desktop dependency.
- Supabase CLI: `2.115.0`.
- Database image: Supabase PostgreSQL `17.6.1.159` (PostgreSQL `17.6`).
- PostgreSQL client: `18.4`.
- Node.js/npm: `22.22.1` / `9.2.0`.
- No Supabase project was linked and no remote URL, project credential, access token, service-role key, database password or production data was used.
- The local stack started only the database service. Forwarded database traffic was blocked during SQL execution and commands ran inside the container.
- The disposable database and synthetic rows were removed with `supabase stop --no-backup` after validation.

## Synthetic fixture contract

`supabase/tests/fixtures/pol_002a_synthetic_baseline.sql` is test-only. It is not a migration, production baseline or attempted reconstruction of the missing backend. It declares only the verified function/table contracts required to exercise POL-002A, with two fictional tenants, four fictional memberships and two fictional patients.

## Executed checks

1. Loaded the synthetic fixture into a fresh local Supabase database.
2. Applied `supabase/migrations/20260818143000_pol_002a_critical_security_hardening.sql` with `ON_ERROR_STOP=1` — passed.
3. Executed `supabase/tests/pol_002a_critical_security.sql` with synthetic fixture variables — passed; final destructive fixture operation rolled back.
4. Verified fail-closed anonymous, missing-membership, inactive-member, non-admin and cross-tenant cases.
5. Verified active same-tenant admin access, guarded GDPR execution, trusted executor use, financial RPC tenant regression, intentionally public grants and trigger-function hardening.
6. Ran `npm ci --ignore-scripts` and `npm run build` — passed.

## Test harness corrections discovered locally

- Expected authorization errors are now caught inside PL/pgSQL exception blocks so they do not abort the enclosing test transaction.
- Fixture variables are exposed to dollar-quoted blocks through transaction-local PostgreSQL settings because psql does not interpolate variables inside dollar quotes.
- Failure branches now raise a real SQL error instead of using the non-portable `\quit 1` form ignored by psql 18.
- Empty `search_path` accepts the PostgreSQL 17 catalog serialization `search_path=""` as well as `search_path=`.

## Non-blocking observations

- The existing dependency tree reports 10 npm audit findings: 2 moderate, 6 high and 2 critical. No dependency was changed because remediation is outside POL-002A.
- The build reports the existing pdfjs `eval` warning and large-chunk warnings. No application refactor was performed.

## Result

POL-002A migration and security tests are validated against the verified minimal contracts in a disposable synthetic environment. This does not prove compatibility with unversioned production objects beyond those contracts; Product Owner and Tech Lead review remain required before any remote application.
