# Current task

- TASK: POL-003D
- TITLE: Controlled Financial Backfill Reconciliation
- OWNER: CODEX
- BRANCH: `finance/POL-003D-controlled-backfill-reconciliation`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Correct the narrow legacy discount encoding mismatch discovered during the controlled production backfill gate, revalidate the adapter locally, and prepare a second controlled backfill attempt without cutting over the frontend.

## Verified finding

- Two legacy plans use `sconto_tipo='eur'`.
- POL-003B currently accepts `pct|percent|fixed|fisso`, therefore those two plans are skipped fail-closed.
- Legacy application behavior treats `pct` as percentage and any non-`pct` discount type as a fixed amount; therefore `eur` is a verified legacy fixed-euro encoding.
- The previous shadow values EUR 7,670 Preventivato and EUR 2,597 Prodotto were not valid canonical targets because they did not apply those fixed-euro discounts consistently.
- Incassato EUR 5,102 reconciled exactly.
- The attempted production backfill was fully rolled back; canonical financial counts returned to zero.

## Required work

1. Start from current `master` and read AGENTS.md, CLAUDE.md, POL-003A/B/C docs and `docs/architecture/pol-003d-controlled-backfill-findings.md`.
2. Add the narrow explicit legacy normalization `sconto_tipo='eur' -> FIXED` to the adapter. Do not introduce a generic fallback for unknown discount types.
3. Update the shadow reconciliation so its compatible Preventivato/Prodotto semantics apply the same verified fixed-euro discount rules as the canonical engine.
4. Add synthetic regression fixtures for `eur` fixed discounts, including produced lines and proportional discount allocation.
5. Prove adapter idempotency and two-tenant isolation locally.
6. Recalculate the expected aggregate targets from source evidence; do not hardcode the old EUR 7,670 / EUR 2,597 values as truth.
7. Keep ACCETTATO, fiscal invoice/refund semantics, external payments, historical costs, hours and operator attribution blocked.
8. Build, test, database lint/advisor, secret scan and diff check.
9. Do not modify production, do not run remote adapter/backfill, do not mount CanonicalManagementView, do not deploy and do not merge.
10. Push a dedicated branch/PR and end WAITING_PRODUCT_OWNER with the exact new expected canonical aggregates and reconciliation evidence.

## Production state

POL-003B and POL-003C structural migrations are installed. `management_control_mode` exists with default `base`. Canonical financial event tables are empty after verified rollback. Legacy dashboards remain active.

## Completion state

The adapter now normalizes only the verified legacy `eur` encoding to canonical `FIXED`; unknown non-zero discount types still fail closed. The versioned shadow query applies the same proportional fixed-discount allocation. Local PostgreSQL 17 regression, idempotency, two-tenant isolation, shadow reconciliation, lint, advisors, application tests and build are complete.

The aggregate-only production read confirmed, inside a read-only transaction, the revised compatible targets: EUR 6,954 Preventivato, EUR 2,181 Prodotto and EUR 5,102 Incassato. Canonical contracts, lines, line events and payments remain zero. No remote adapter/backfill, migration, application write, deploy, cutover or merge occurred.
