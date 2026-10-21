# Current task — APPOINTMENT-DOCUMENTS (2026-10-21)
- OWNER: Codex; branch codex/appointment-documents from master 85382ebc.
- PO: retrieve created quotes/prescriptions directly from appointment, without patient record navigation.
- STATUS: WAITING_PRODUCT_OWNER — implementation complete; PR #242 remains draft until final-head CI and screenshot review pass.
- SCOPE: patient documents list in the immediate appointment sheet, recent items, type/search filters, in-app PDF with existing download/share. Refresh after archive save and plan save.
- VALIDATION: 1433/1433 local Node tests, Studio and Personal builds pass, diff --check clean. Final browser evidence in PR #242.
- DATABASE: existing schema/read access/archive settings; no migrations, RLS/auth/financial changes.
- ROLLBACK: revert dedicated PR; stable/2026-08-27-full-recovery unchanged.
- RELEASE: draft PR, validation/review, WAITING_PRODUCT_OWNER; explicit Mergia required.
