# POL-002 Phase 1 — access audit

Date: 2026-08-18  
Repository baseline: `master` at `58df045d3247b37530137a055f8314b0da6245f2`

## Result

Safe read-only Supabase production access is not available in the current development environment. Per the task stop condition, no production inventory was attempted.

## Access available

- GitHub connector read/write access to `lucasimondi/Dental-manager-claude`.
- Repository files and history, including the single Physio migration.
- Public production project reference visible in existing application configuration: `idklxdqebfceplrualgh`. This identifies a target but does not grant metadata access.
- Read-only local inspection of tool availability and environment-variable names.

## Access checks performed

- Supabase CLI: unavailable.
- `psql`: unavailable.
- Local Git and GitHub CLI: unavailable.
- Supabase connector/tool: unavailable.
- Supabase/PostgreSQL/database environment variable names: none detected.
- Local repository/project link: unavailable; the workspace contains no checkout and no Supabase link metadata.
- Dashboard/API metadata access: unavailable.
- Edge Function source access: unavailable, except the repository's Vercel proxy.
- Storage metadata access: unavailable.
- Production migration history access: unavailable.

No credential or environment-variable value was displayed.

## Access required to resume

The Product Owner must provide or authorize:

1. Confirmation that `idklxdqebfceplrualgh` is the current production project reference.
2. A named authorized operator.
3. A temporary PostgreSQL metadata-only/read-only login with the minimum catalog visibility required; no application-row access.
4. Authorization and a safe mechanism to use compatible Supabase CLI and `psql`, or administrator-produced schema-only exports.
5. Read-only Dashboard/API metadata access for Auth configuration, Realtime, Storage, extensions, scheduled jobs, and deployed Edge Function metadata.
6. Authoritative Edge Function source or approved read-only source export.
7. A secure quarantine location outside Git for raw artifacts.
8. Two named reviewers for sanitization and approval of what may enter Git.
9. Explicit authorization to resume POL-002 after the access is validated as non-mutating.

Do not provide credentials in chat or commit them to Git.

## Repository-only inventory

The repository versions one migration: `supabase/migrations/20260818000000_physio_schema_dati.sql`, defining seven `physio_*` tables and tenant-scoped RLS policies. The client references many core tables, RPC, Storage behavior, Auth/provisioning functions, and Edge Functions whose production definitions are not versioned.

These repository references do not prove that any object exists in production or matches the client. Until metadata access is available, all production/repository classifications remain `UNKNOWN`, except that the Physio definitions are `REPOSITORY_ONLY_OR_UNVERIFIED` rather than proven matching.

## Security finding status

- Fixed tenant fallback: `CONFIRMED` in repository client code; production impact cannot be tested.
- Membership model: `CANNOT VERIFY` in production.
- Tenant isolation: `CANNOT VERIFY`.
- Physio cross-tenant foreign-key risk: `CONFIRMED` in the versioned migration design; production deployment and exploitability cannot be verified.
- Core RLS coverage: `CANNOT VERIFY`.
- Role separation: `CANNOT VERIFY`.
- RPC receiving `studio_id`: client calls are `CONFIRMED`; server authorization is `CANNOT VERIFY`.
- Registration/provisioning: client sequence is `CONFIRMED`; backend behavior is `CANNOT VERIFY`.
- Invitation flow: client behavior is `CONFIRMED`; backend enforcement and revocation are `CANNOT VERIFY`.

## Financial RPC status

The client calls `get_kpi_periodo` and `get_costo_orario`. Their authoritative SQL definitions, dependencies, grants, security mode, search path, and production location are unavailable. No formula was evaluated or changed.

## Baseline classification plan

Safe to version directly after verification: sanitized application-owned schemas, tables, constraints, indexes, enums, views, functions, triggers, grants, RLS, Storage declarations, Edge Function source, and non-secret configuration templates.

Requires sanitization: schema-only raw exports, environment-specific URLs, ownership metadata, function configuration, webhook routes, Auth/provider metadata, Storage metadata, and Edge Function configuration.

Requires Product Owner decision: baseline migration strategy, managed versus application-owned objects, role model, tenant-safe relationship design, financial semantics, environment topology, deployment authority, and remediation task order.

Must never enter Git: passwords, database URLs containing credentials, access/refresh tokens, service-role keys, signing secrets, provider secrets, Vault values, Auth users, patient/clinical rows, Storage objects, raw production dumps, or webhook payloads.
