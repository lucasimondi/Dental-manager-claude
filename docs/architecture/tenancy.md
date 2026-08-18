# Tenancy — current state

Poliedra uses `studio_id` as the tenant identifier. The client reads it from `session.user.app_metadata.studio_id`, adds it to inserts, and filters several reads. Correct isolation depends on database RLS.

Known facts:
- core policy definitions are not versioned;
- the Physio migration compares row `studio_id` with the JWT app metadata claim;
- client update/delete operations often filter only by row ID;
- several direct queries omit an explicit client-side tenant filter and rely on RLS;
- RPC accept a caller-provided `p_studio_id`, but their SQL authorization is unavailable;
- `getStudioId()` currently contains a fixed fallback tenant UUID when the claim is missing;
- membership and claim-maintenance logic are not versioned;
- current Physio foreign keys are ID-only and do not enforce same-tenant relationships.

Required invariant for future work: tenant identity must fail closed and every row, relationship, RPC, Realtime path, Storage object, and administrative action must be demonstrably tenant-safe. Any change requires Product Owner approval and automated cross-tenant tests.
