# Current task

- TASK: POL-002B
- TITLE: Private Patient Files
- OWNER: CODEX
- BRANCH: `security/POL-002B-private-patient-files-v2`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Remove public access to clinical files in Supabase Storage without breaking the existing patient file workflow. Preserve tenant isolation and current legacy `<patient_id>/<filename>` object paths during the first cutover.

## Verified production facts

- `patient-files` exists and is currently public.
- Production currently contains 1 object in the bucket.
- The object uses the legacy numeric patient-id first path segment and matches an existing `public.patients` row.
- `patients.id` is bigint and `patients.studio_id` is uuid.
- Active tenant membership is represented by `public.studio_users(user_id, studio_id, stato)`.
- The verified pre-task application baseline in `SchedaPaz.jsx` listed/uploaded/deleted under `<patient_id>/` and used `getPublicUrl()` for preview/download.

## Prepared on branch

- migration `20260818190000_pol_002b_private_patient_files.sql`;
- four authenticated tenant-scoped Storage policies;
- non-client-executable authorization helper tied to patient studio + active membership + JWT studio claim;
- bucket privacy cutover (`public=false`), not applied remotely;
- SQL regression assertions and behavioral test matrix.

The migration SQL has been syntax/preflight-tested against the production schema inside an explicit transaction ending in `ROLLBACK`; the bucket remained public after the test. No production state changed.

## Completed validation

- `SchedaPaz.jsx` now creates 300-second signed URLs and fails closed when listing or signing fails; list/upload/delete retain the legacy `<patient_id>/<filename>` path.
- Repository search found no other `patient-files` `getPublicUrl()` call site.
- The migration, SQL assertions and integration matrix passed on a disposable local Supabase/PostgreSQL 17 stack with synthetic users, patients, memberships and files only.
- The integration test covered two tenants, a second active member, inactive/missing membership, missing/invalid studio claim, unknown patient, anonymous access, cross-tenant list/sign/upload/update/delete denial, same-tenant signed download, URL expiry and cleanup.
- Local Supabase database advisors reported no issues; `npm run build`, `git diff --check` and the targeted secret-pattern scan passed.
- The disposable local stack was stopped with `--no-backup`; no production or remote migration action occurred.

## Awaiting Product Owner

Review the branch diff, test evidence and handoff. Production application, deploy, migration execution and merge remain separate explicit gates.

## Production gate

Do not apply the POL-002B migration, deploy application changes, merge, or alter existing Storage objects until local validation is complete and the Product Owner explicitly approves the PR and cutover.
