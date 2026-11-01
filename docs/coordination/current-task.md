# Current task — PATIENT-ONE-CLICK (2026-11-01)
- OWNER Codex; branch codex/patient-one-click from master de7f920.
- AUTHORIZATION: PO requests simpler patient flow, treatment and quote entry in one click. Previous diary task merged/deployed PR259.
- COMPLETED: direct actions in legacy/V2; focused fullscreen-mobile shared row editor; existing verified persistence reused without requiring appointment; saved PDF access and return to the mounted record.
- DATABASE: no schema/RLS/capability/tenancy/formula/deployment changes or production data operations. Existing concurrency limits retained; uncertain writes block replay.
- VALIDATION: 1502/1502 full Node tests, including five new direct-patient cases; Studio and Personal production builds passed; final16/16 service tests and diff check pass. Synthetic browser legacy/V2 save-return, list-price, duplication, quote PDF, multi-plan validation; geometry375/768/1024/1440, final375x740 fullscreen/no overflow. Physical Android save/share/keyboard not verified. Final build receipt in handoff.
- STATUS WAITING_PRODUCT_OWNER after dedicated PR publication and exact-head checks; explicit new Mergia required by AGENTS.md. No merge/manual deploy.
- ROLLBACK revert dedicated PR; keep plans and stable checkpoints unchanged.
