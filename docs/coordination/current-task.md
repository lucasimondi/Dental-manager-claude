# Current task — STUDIO-RICHIESTE-ESAMI (2026-10-21)
- OWNER: Codex; branch `codex/studio-richieste-esami`, base master afbdbc1d.
- PO: richieste ecografia/TAC in Documenti medici, stesso layout e intestazione.
- PREVIOUS: AGENDA-CONDIVISA PR #234 merged; implementation unchanged.
- STATUS: WAITING_PRODUCT_OWNER — implemented and locally verified; PR review before merge.
- SCOPE: diagnostic exam request form/PDF; reuse existing esami archive category and settings.
- DATABASE / AUTH: no changes or production operations.
- ROLLBACK: revert PR; no migration.
- VALIDATION: 1410/1410 tests, Vite build pass, synthetic PDF rendered and inspected; diff check clean. No browser/iPhone validation.
