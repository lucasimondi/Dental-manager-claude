# Initial technical backlog

Items are derived from the approved audit. None are started.

## P0 — Repository/backend reproducibility
- Capture current production Supabase definitions read-only.
- Review and sanitize extracted artifacts.
- Establish migration-first schema, RPC, trigger, grant, Storage, and Edge Function versioning.
- Prove environment reconstruction without production mutation.

## P0 — Tenant isolation
- Remove tenant fallback through an approved task.
- Test isolation across tables, RPC, Realtime, and Storage.
- Make tenant resolution fail closed.

## P0 — Authentication, membership, and RLS
- Establish a canonical membership model.
- Audit provisioning, invitations, role changes, claim refresh, revocation, and admin bootstrap.
- Version and test operation/role-specific policies.

## P0 — Tenant-safe relationships
- Inventory every foreign key.
- Design composite tenant-safe constraints.
- Add cross-tenant negative tests.

## P1 — Canonical financial domain
- Obtain Product Owner validation of lifecycle and definitions.
- Inventory formulas and select one authoritative implementation.
- Add golden fixtures before correcting inconsistencies.

## P1 — Automated tests
- Add unit, integration, RLS, migration, RPC, Edge Function, and E2E strategy incrementally.

## P1 — CI/CD quality gates
- Add build, lint, test, schema, security, and migration checks.
- Protect the default branch after Product Owner approval.

## P1 — Multi-user concurrency
- Replace full-array diff mutations and full-table realtime refreshes with reviewed concurrency controls.

## P2 — Modularization
- Define core versus vertical boundaries before refactoring large components.

## P2 — Progressive TypeScript adoption
- Establish boundaries and runtime schemas first; migrate incrementally without feature rewrites.
