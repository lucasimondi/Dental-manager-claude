# Current task — PERSONAL-WIN95-COHERENCE (2026-11-02)
- OWNER Codex; branch codex/personal-win95-coherence from master a4ecf9e3 (merged PR263).
- AUTHORIZATION PO asks for coordinated Windows95 icons/text inside windows, coordinated header/colors, and today's agenda first in Home.
- SCOPE shared Personal icons, theme-scoped content/reader/dialog/calendar styling, header mark and Home ordering. Modern appearance remains switchable. Diary book layout and canonical event/category data retained.
- CHECKPOINT immutable stable/2026-08-27-full-recovery at070b28fd4eae4e2cc397584201d0bb149468fae7 unchanged.
- STATUS WAITING_PRODUCT_OWNER; implementation and local validation complete. Previous connector appointment task is separate PR264 and not included.
- VALIDATION full1522/1522 Node tests and standalone Personal build pass; combined build and diff check also pass. Cloud browser cannot reach local QA server (ERR_CONNECTION_REFUSED); no visual/physical Android verification claimed.
- DATABASE none; no migration/Auth/RLS/financial/tenancy change or live user data operations.
- NEXT final build/checks, dedicated PR, exact-head CI; WAITING_PRODUCT_OWNER for task-specific Mergia before merge per AGENTS.md.
- ROLLBACK revert dedicated PR; no data migration.
