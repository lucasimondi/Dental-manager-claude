# Patient Workspace 2.0 rollout

The studio-level `feature_overrides.patientWorkspaceV2` flag is the only production switch.

- `false` or absent: `PatientWorkspaceBoundary` renders `SchedaPaz.jsx`.
- `true`: the same boundary renders `PatientWorkspaceV2` from `patientWorkspaceRealAdapter`.

Both `Pazienti.jsx` and the central `App.jsx` patient flow use this boundary. The workspace is keyed by patient id and document request id, so switching patient clears tabs, drawers, documents and modal state.

Rollback is immediate: set `patientWorkspaceV2` to `false`. There is no migration and no data rollback. Clinical status writes and persistent payment plans remain disabled until authoritative concurrency and storage contracts exist.

The controlled `/patient-workspace-v2-real-preview?patientId=…` route forces the flag only on that route and returns real data only for an authenticated, RLS-authorized session.
