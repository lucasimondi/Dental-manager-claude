# patient-files private-access compatibility plan

Status: P0 plan only. No Storage or application rollout is authorized by POL-002A.

## Confirmed dependency

`src/components/SchedaPaz.jsx` lists, uploads and deletes patient-scoped objects in `patient-files`, then calls `getPublicUrl` for image/PDF previews. Paths are `<patient_id>/<timestamp>_LABEL_<filename>`.

The bucket is verified as public. Files are attached to patient records and may be clinical images or PDFs, so public object URLs can expose protected health information.

## Target

A private bucket with tenant-scoped list/read/insert/delete authorization and short-lived signed access. Object paths must carry a tenant identifier that policies can validate; patient IDs and unguessable-looking filenames are not authorization.

## Staged rollout

1. Capture sanitized Storage policy definitions and object-path distribution metadata; never download object content.
2. Approve a tenant-safe path contract, for example `<studio_id>/<patient_id>/<object>`, including legacy-object handling.
3. Add private-bucket policies for active tenant members, separated by operation and least privilege.
4. Update the application to request short-lived signed URLs or use an authenticated download endpoint. Do not cache signed URLs beyond expiry.
5. Add synthetic two-tenant tests for list, upload, preview, delete, cross-tenant denial, expired URLs and revoked membership.
6. Migrate legacy object keys with a separately approved, audited and reversible job; never expose object contents in logs.
7. Deploy compatible application behavior before changing bucket visibility.
8. Switch `patient-files.public` to false only after preview/upload/delete compatibility passes in staging.
9. Verify previously issued public URLs no longer return objects, monitor failures, and retain a rollback window.
10. Document retention, deletion, audit, cache-control and incident response.

## Rollback

Before the visibility switch, rollback is application-only. After the switch, prefer rolling back the signed-URL client while keeping the bucket private if possible. Re-publication requires a Product Owner/security gate because it reintroduces PHI exposure.

## Decisions required

- signed URL lifetime;
- allowed roles per Storage operation;
- legacy path migration strategy;
- whether downloads require additional audit logging;
- retention and deletion rules;
- cache and CDN behavior;
- incident handling for already-shared public URLs.
