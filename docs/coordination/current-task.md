# Current task

- TASK: POL-002A
- TITLE: Critical Security Hardening
- OWNER: CODEX
- BRANCH: `security/POL-002A-critical-hardening`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Prepare a minimal, versioned hardening patch for confirmed Supabase authorization issues without modifying production.

## Completed

Using the verified metadata supplied by the Tech Lead, the branch now contains:

- a fail-closed `public.is_studio_admin()`;
- a non-exposed active-admin tenant guard;
- guarded wrappers for both GDPR SECURITY DEFINER RPCs that preserve the existing scalar return types at migration time and derive the audit executor from `auth.uid()`;
- targeted EXECUTE revocations for explicitly privileged functions while leaving intentionally public flows unchanged;
- a secure empty `search_path` and no direct Data API EXECUTE for `set_updated_at`;
- a fail-closed UI admin check;
- synthetic SQL security regression tests;
- a test-only synthetic fixture baseline for disposable local validation;
- a separate private-bucket compatibility plan for `patient-files`.

No RLS policy was added to `google_calendar_tokens` or `super_admins`. No Storage or Auth setting was changed.

## Validation state

Local validation is complete on an isolated Supabase/PostgreSQL 17 container using only synthetic data. The migration applied successfully, the SQL security suite passed with transaction rollback, and `npm run build` passed. The disposable database was stopped without backup and removed. Nothing was applied to production.

## Product Owner action required

Review the migration, synthetic fixture contract, test corrections and local validation record, then approve or reject a PR. Do not merge, deploy or apply the migration remotely.
