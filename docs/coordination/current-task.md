# Current task — PERSONAL-DIARIO-HOME-PHILOSOPHY (2026-11-01)
- OWNER Codex; branch codex/diario-home-philosophy from master de7f920 (PR259).
- AUTHORIZATION: PO requests direct Home navigation, no repeated quotations across diary pages, philosophical library by categories and eras.
- SCOPE: diary navigation and quote catalogue/selection only; existing Personal settings JSON for page quoteId, no schema/Auth/RLS changes. Preserve touch/editor/exports.
- STATUS VALIDATED_LOCAL. 1504/1504 Node tests, Personal and Studio builds; browser synthetic Home/selection/filters/375px checks completed. Ready for dedicated PR and exact-head checks; specific new PO Mergia required.
- ROLLBACK revert dedicated PR; preserve diary rows and stable checkpoints.

- COMPLETED: direct Home with save flush; 162 passages / 32 philosophers / six eras / 26 schools / 13 themes; filterable source-linked library, manual unique selection, pin allocation/repair, explicit exhaustion instead of cycling; live/turn/export consistency and wrapped export attribution.
- FILES: diary JSX/CSS/library panel, quotes/export helpers, two tests, architecture/coordination. DATABASE: none; optional quoteId metadata in existing JSON on user save, existing CAS and RLS unchanged. No live diary reads/writes.
- LIMITS: selected catalogue is finite, not every philosopher; after 162 distinct allocations, show exhaustion without duplicates. Unpersisted legacy default pins can shift if reserved pins change. Cross-device duplicate pins repaired on next full load. Android hardware/download not newly tested.
- NEXT: publish draft PR, verify intended diff/CI/preview and mark ready; await specific PO Mergia.
