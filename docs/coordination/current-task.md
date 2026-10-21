# Current task — APPOINTMENT-WORKSPACE (2026-10-21)
- OWNER: Codex; branch codex/appointment-workspace from master 3d31bb4.
- PO: large appointment sheet with embedded treatment, payment, prescription, documents and manual/list-price quote. Preserve existing appointment actions; no patient-sheet navigation for these operations.
- PREVIOUS: PR #238 merged with PO authorization; Vercel success verified.
- STATUS: WAITING_PRODUCT_OWNER — draft PR #239; implementation complete, final-head browser CI and screenshot review required before marking ready. Explicit Mergia required for release.
- DATABASE / AUTH / FINANCE: reuse existing forms and setters; no schema or semantic changes.
- ROLLBACK: revert dedicated PR; immutable stable/2026-08-27-full-recovery preserved.
