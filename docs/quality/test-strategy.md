# Test strategy

Current baseline: no versioned automated tests, lint, typecheck, or CI workflow.

Future tests must be introduced task-by-task without changing product behavior accidentally.

## Priority layers

1. Database reproducibility: clean local restore, migration ordering, schema diff.
2. Tenant isolation: two-tenant fixtures for SELECT, INSERT, UPDATE, DELETE, RPC, Realtime, and Storage.
3. Authentication/authorization: owner, admin, clinician, staff, invited, disabled, and unauthenticated cases.
4. Financial golden tests: Product Owner-approved examples for discounts, partial execution, invoicing, payments, credits, recurring expenses, refunds, and period boundaries.
5. Domain unit tests for pure calculations.
6. Integration tests for Supabase adapters and Edge Functions.
7. E2E smoke tests for login, patient workflow, agenda, payment, and vertical gating.
8. Build, lint, dependency, and security checks.

Tests must use synthetic data, never production PHI. Migration, RLS, and corresponding tests remain in the same change. A failing authorization test blocks delivery. CI implementation is a future approved backlog item.
