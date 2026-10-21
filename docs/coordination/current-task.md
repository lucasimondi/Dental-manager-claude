# Current task — APPOINTMENT-RAPID-FORM (2026-10-21)
- OWNER: Codex; branch codex/appointment-rapid-form from master 4e14cf7.
- PO: previous embedded modules rejected; one immediate full-screen form with direct fields and collapsible sections, no module navigation.
- PREVIOUS: PR #239 merged; production deployment not yet confirmed in prior release record.
- SCOPE: direct treatment/price fields, optional payment, quote and inline document fields. Preserve existing domain/PDF/auth rules and legacy agenda actions.
- STATUS: WAITING_PRODUCT_OWNER — implementation complete; draft PR #240 and final-head CI/screenshots required before ready. Explicit Mergia required for release.
- DATABASE: existing adapter and schema only; no migration, tenancy/RLS/formula changes. Confirm writes before close; explicit non-atomic failure handling.
- ROLLBACK: revert dedicated PR; immutable stable checkpoint preserved.
- VALIDATION: 1430/1430 local Node tests and both builds pass. Final browser evidence and screenshots recorded in PR #240; no production operations.
