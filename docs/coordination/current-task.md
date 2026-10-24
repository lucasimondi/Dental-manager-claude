# Current task — PHOTO-TO-ACTIONS (2026-10-24)
- OWNER: Codex; branch codex/photo-import-workflow from master ae6a3b15 (PR #245 merged).
- PO: photos attached to an assistant should populate the management system with minimal steps.
- SCOPE: first operational gap: authenticated implant-label registration from Poliedron attachments, shared domain validation, explicit clinical review, duplicate checks and read-back; document current coverage and external-assistant connection requirements.
- STATUS: implementation complete; preparing draft PR and CI review. Existing agenda/payment/plan/prescription domain workflows retained. External ChatGPT/Gemini connection is not configured by this change.
- DATABASE: no migration, RLS/auth change or production data operation authorized for implementation. Reuse existing implants and action-claim schema.
- VALIDATION: 1458/1458 full Node suite; final implant suite 12/12, Studio and Personal builds and diff check pass. Synthetic services/providers only; no OCR accuracy or live-account result claimed.
- RELEASE: draft PR, tests/review, WAITING_PRODUCT_OWNER; explicit Mergia and separately controlled Edge Function release. No manual deploy.
- ROLLBACK: revert dedicated PR and restore prior function version; immutable stable checkpoint unchanged.
