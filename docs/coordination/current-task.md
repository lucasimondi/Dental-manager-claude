# Current task — PATIENT-ONE-CLICK, PR260 (2026-11-01)
- OWNER Codex; branch codex/patient-one-click; masterde7f920. Same open/unmerged PR260.
- AUTHORIZATION: PO requests direct patient entry, corrected scrolling/keyboard/list suggestions, compact odontogram, whole-plan/entered-treatment quote choice and clean coherent patient record graphics.
- COMPLETED: focused viewport-safe editor, native scrolling and stable footer; actual list suggestions/manual fallback; compact always-visible32-tooth selection; confirmed saved-plan PDF projection choosing all or just entered rows without copying plans; clean legacy/V2 identity/contact/KPI/actions. Partial PDF explicitly excludes global plan discount, uses confirmed saved prices.
- VALIDATION:1508/1508 Node tests and final Studio build pass. Synthetic browser legacy/V2, list suggestions, tooth31, both scope totals/PDFs, responsive375/768/1024/1440, previous keyboard geometry simulation. Physical Android keyboard/touch/download/share unverified. Scratch screenshot synthetic only; temporary host override removed.
- DATABASE: no schema/RLS/capability/tenancy/financial-formula or production data changes. Existing validation and uncertain-write protections retained. Immutable stable refs untouched.
- STATUS WAITING_PRODUCT_OWNER: publish update on same PR260, inspect exact-head checks; no merge/manual deployment authorized. Explicit new Mergia required by AGENTS.md.
- ROLLBACK revert PR260; preserve saved plan rows and stable checkpoints.
