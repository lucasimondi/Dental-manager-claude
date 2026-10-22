# Current task — APPOINTMENT-DENTAL-SHORTCUTS (2026-10-22)
- OWNER: Codex; branch codex/appointment-dental-shortcuts from master cf7461fe.
- PO: odontogram in appointment, duplicate treatment, automatic implant quote (500 implant +150 abutment +remainder ceramic composite crown), existing prescription drug shortcuts.
- STATUS: WAITING_PRODUCT_OWNER — implementation complete; PR stays draft until final-head CI and screenshot review pass.
- SCOPE: direct inline controls, existing tooth selector and medicine favorites, explicit implant total and transparent three-line preview. Single canonical quote, no duplicate generic treatment.
- DATABASE: existing schema/domain/save adapter; no migration/auth/RLS/deploy changes. Price allocation explicitly requested by PO; integer cents; invalid totals fail before writes.
- VALIDATION: 1437/1437 local Node tests, Studio and Personal builds pass, diff --check clean. Final-head browser results in dedicated PR.
- RELEASE: draft PR, tests/build/mobile review, WAITING_PRODUCT_OWNER; explicit Mergia required.
- ROLLBACK: revert dedicated PR; immutable stable checkpoint preserved.
