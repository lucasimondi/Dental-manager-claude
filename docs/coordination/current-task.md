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
- a separate private-bucket compatibility plan for `patient-files`.

No RLS policy was added to `google_calendar_tokens` or `super_admins`. No Storage or Auth setting was changed.

## Validation state

Repository/static checks are complete. SQL tests were prepared but not executed because this environment has no local Supabase, PostgreSQL client, or isolated synthetic database. Nothing was applied to production.

## Product Owner action required

Request Tech Lead review of the migration and fixture contract, execute the tests only in a disposable isolated Supabase environment, and approve or reject a PR. Do not merge, deploy or apply the migration remotely.
