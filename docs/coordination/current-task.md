# Current task

- TASK: POL-RBAC-001
- TITLE: Authoritative Tenant Capabilities
- OWNER: CODEX
- BRANCH: `security/POL-RBAC-001-authoritative-capabilities`
- BASE REVIEW: `ui/POL-UI-002-canonical-financial-widgets-presets` / PR #15
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Extend the existing `admin`/`utente` membership model with explicit tenant-scoped capabilities for owner/admin, front desk, clinician, physiotherapist, personal trainer and massage therapist. Make POL-UI-002 presets and widget access consume only server-authoritative capabilities. Harden Fisio RLS by clinical responsibility without inferring professional roles.

## Safety boundaries

- Legacy active `admin` remains owner/management-capable, but never receives clinical access automatically.
- Legacy active `utente` receives no inferred capability. Front-desk and clinical capabilities require an explicit tenant-scoped assignment.
- Capability resolution is server-side, active-membership checked and fail closed; suspended or cross-tenant identities resolve no access.
- Fisio full clinical writes/finalization require `clinical.physiotherapist`. PT and massage therapist can read the authorized operational path and author their own diary entries, but cannot read evaluations or modify physiotherapy plans.
- No production access, remote migration, backfill, deployment or merge is authorized or performed.

## Completion state

The additive capability table, server-side resolver functions, assignment RLS, tenant-safe relationship checks, author-enforcement triggers and replacement Fisio policies are implemented in one migration with synthetic tests. POL-UI-002 now loads capabilities from `get_my_studio_capabilities_v1`; preset and financial access no longer inspect legacy role labels or infer profession from vertical. Setup supports explicit additive assignments. The Fisio UI separates full and operational modes.

Validation passed: original 20 POL-UI-002 Node tests plus 6 RBAC tests, clean PostgreSQL/Supabase 17 migration and RLS regression for two tenants/suspension/multi-role/negative escalation/all requested profiles, database lint and production build.

## Residual risks

- `clinical.general` is registered for future vertical contracts but grants no Fisio access.
- The existing legacy `studio_users` management policies remain an external prerequisite; this migration does not reconstruct unknown production policies.
- Client deployment must follow the migration. Before it, capability RPC absence makes the new client fail closed.
- No production capability assignments are inferred or seeded. Product Owner must approve an explicit assignment/rollout plan.
- Existing dependency advisories and build warnings remain outside scope.

## Exact next action

Product Owner and Tech Lead review the stacked POL-RBAC-001 PR and migration. Validate the explicit role/capability matrix and rollout ordering. Do not apply remotely, deploy, merge POL-RBAC-001 or merge PR #15 without explicit Product Owner approval.
