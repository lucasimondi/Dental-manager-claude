# Current task — CONNECTOR-APPOINTMENT-DIRECT (2026-11-02)
- OWNER Codex; branch codex/connector-appointment-direct from current master.
- AUTHORIZATION PO requests removing the additional confirmation for appointment insertion after confirming the existing booking.
- SCOPE explicit user authorization permits same-turn prepare/confirm for NEW appointments only. Other domains retain new-reply confirmation. Existing signed proposal, live grant/capability/availability checks and canonical executor unchanged.
- Previous Personal restyling task preserved in handoffs and its own PR263; no changes to its implementation.
- STATUS WAITING_PRODUCT_OWNER; implementation complete, 1524/1524 Node tests and production build pass; diff check clean. No merge or deployment performed.
- CHECKPOINT stable/2026-08-27-full-recovery remains immutable at070b28fd4eae4e2cc397584201d0bb149468fae7.
- NEXT dedicated PR, exact-head CI, explicit Product Owner merge approval per AGENTS.md. Release requires both existing Edge function and Vercel transport updates; refreshed client metadata needed.
- ROLLBACK revert this dedicated PR; no migration/data changes.
