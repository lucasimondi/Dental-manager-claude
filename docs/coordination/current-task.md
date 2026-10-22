# Current task — APPOINTMENT-UI-TOOTH-FLOW (2026-10-22)
- OWNER: Codex; branch codex/appointment-ui-tooth-flow from master a56e077b.
- PO: rejects previous UI; major visual improvement, automatically one procedure per selected tooth, remove Duplicate, larger agenda booking popup; check saved procedure visibility.
- STATUS: WAITING_PRODUCT_OWNER — implementation complete; draft PR until final-head CI and screenshot review pass.
- SCOPE: compact clinical visit form, tooth-driven canonical line expansion (including implant quote bundles), saved-plan procedure visibility, full mobile / larger desktop booking form with stable footer.
- DATABASE: existing schema/save adapter/domain lifecycle; no migrations, RLS/auth/tenant/deployment changes; synthetic verification only, no production patient data.
- VALIDATION: 1441/1441 local Node tests, Studio and Personal builds pass; diff --check clean. Browser evidence in PR.
- RELEASE: draft PR → tests/build/visual review → WAITING_PRODUCT_OWNER; explicit Mergia required.
- ROLLBACK: revert PR; immutable stable checkpoint preserved.
- CI: browser setup uses the official HTTPS Ubuntu mirror after the Azure HTTP mirror stalled until timeout; all existing suites remain enabled.
