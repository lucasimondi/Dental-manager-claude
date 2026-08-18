# Current task

- TASK: POL-002B
- TITLE: Private Patient Files
- OWNER: CODEX
- BRANCH: `security/POL-002B-private-patient-files-v2`
- STATUS: `IN_PROGRESS`

## Objective

Remove public access to clinical files in Supabase Storage without breaking the existing patient file workflow. Preserve tenant isolation and current legacy `<patient_id>/<filename>` object paths during the first cutover.

## Verified production facts

- `patient-files` exists and is currently public.
- Production currently contains 1 object in the bucket.
- The object uses the legacy numeric patient-id first path segment and matches an existing `public.patients` row.
- `patients.id` is bigint and `patients.studio_id` is uuid.
- Active tenant membership is represented by `public.studio_users(user_id, studio_id, stato)`.
- Existing application code in `SchedaPaz.jsx` lists/uploads/deletes under `<patient_id>/` and uses `getPublicUrl()` for preview/download.

## Prepared on branch

- migration `20260818190000_pol_002b_private_patient_files.sql`;
- four authenticated tenant-scoped Storage policies;
- non-client-executable authorization helper tied to patient studio + active membership + JWT studio claim;
- bucket privacy cutover (`public=false`), not applied remotely;
- SQL regression assertions and behavioral test matrix.

The migration SQL has been syntax/preflight-tested against the production schema inside an explicit transaction ending in `ROLLBACK`; the bucket remained public after the test. No production state changed.

## Remaining implementation

1. In `src/components/SchedaPaz.jsx`, replace `getPublicUrl()` for `patient-files` with `createSignedUrl(path, 300)` and handle signing errors fail-closed.
2. Preserve list/upload/delete paths as `<patient_id>/<filename>` for this first migration.
3. Run repository search and prove there are no other `patient-files` public URL call sites.
4. Validate migration + behavioral matrix in the isolated local Supabase environment using synthetic two-tenant fixtures.
5. Run `npm run build` and secret/diff checks.
6. Update handoff and set `WAITING_PRODUCT_OWNER`.

## Production gate

Do not apply the POL-002B migration, deploy application changes, merge, or alter existing Storage objects until local validation is complete and the Product Owner explicitly approves the PR and cutover.
