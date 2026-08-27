# Test strategy

Current baseline, `VERIFIED` on `master` at commit `b65cdba` (24 August 2026): a versioned
Node test suite exists (`npm test` runs `tests/*.test.mjs`), and
`.github/workflows/pol003e-ci.yml` runs `npm test` plus `npm run build` on every pull
request to `master`. Still missing: lint, typecheck, E2E, and automated RLS/migration checks
in CI (RLS and migration assertions are currently executed locally per task and recorded in
the corresponding `docs/architecture/*-local-validation.md`).

Further tests must be introduced task-by-task without changing product behavior accidentally.

## Priority layers

1. Database reproducibility: clean local restore, migration ordering, schema diff.
2. Tenant isolation: two-tenant fixtures for SELECT, INSERT, UPDATE, DELETE, RPC, Realtime, and Storage.
3. Authentication/authorization: owner, admin, clinician, staff, invited, disabled, and unauthenticated cases.
4. Financial golden tests: Product Owner-approved examples for discounts, partial execution, invoicing, payments, credits, recurring expenses, refunds, and period boundaries.
5. Domain unit tests for pure calculations.
6. Integration tests for Supabase adapters and Edge Functions.
7. E2E smoke tests for login, patient workflow, agenda, payment, and vertical gating.
8. Build, lint, dependency, and security checks.

Tests must use synthetic data, never production PHI. Migration, RLS, and corresponding tests remain in the same change. A failing authorization test blocks delivery.

Test results must be reported with the truthfulness labels defined in `../../AGENTS.md`:
`VERIFIED` only for suites actually executed in the reporting session, with the command and
environment stated; `NOT VERIFIABLE` when a check could not be run and why (for example no
Docker, no production access, no browser). Extending CI beyond test and build remains a
backlog item.
