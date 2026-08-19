# Current task

- TASK: POL-003B
- TITLE: Legacy Financial Adapter & Reconciliation
- OWNER: CODEX
- BRANCH: `finance/POL-003B-legacy-adapter-reconciliation`
- STATUS: `IN_PROGRESS`

## Objective

Map the existing Poliedra financial sources into the POL-003A canonical engine, build deterministic adapters and produce a shadow reconciliation report comparing legacy and canonical figures before any frontend cutover.

## Product Owner authorization

Approved after POL-003A merge and controlled production installation of the additive canonical engine. Production financial_*_v1 tables currently contain zero canonical rows. POL-003B may inspect production metadata and aggregate financial source data read-only, but must not write legacy/canonical production rows, alter frontend KPI reads, deploy application code, or replace legacy RPCs.

## Required work

1. Inventory authoritative legacy tables/columns/dates for `plans`, `payments`, `documenti_fiscali`, `pagamenti_esterni`, `spese`, `personale`, `materiali`, `macchinari`, `prestazione_materiali`, `prestazione_macchinari`, `pricelist`, `appointments` and relevant configuration.
2. Define deterministic source-to-canonical mappings for contracts, contract lines, accepted/produced events, invoice events, payment events/allocations, cost events and available/worked hours.
3. Never infer unavailable historical dates. Classify every mapping as `EXACT`, `DERIVED`, `APPROXIMATION_NOT_ALLOWED`, or `PRODUCT_OWNER_DECISION_REQUIRED`.
4. Build idempotent adapter SQL in a new migration or versioned adapter module, but do not run it against production.
5. Use synthetic/local fixtures to test discounts, partial execution/payment, advances, overpayment, cancellation, refunds, notes of credit, external payment reconciliation, historical costs, two tenants and multi-operator data.
6. Build a read-only shadow reconciliation query/report for production aggregate comparisons. It must not copy patient-identifying data into logs or Git.
7. Compare at least legacy vs canonical-compatible definitions for preventivato, accepted backlog, produced, invoiced, collected, costs, margin/EBITDA where source evidence permits. Explain every variance; do not force equality where semantics differ.
8. Do not wire the frontend to POL-003A during this task.
9. Run build, database tests/lint/advisor, secret scan and diff check. Update handoff and set `WAITING_PRODUCT_OWNER`.

## Production gate

No production data writes, no remote adapter migration, no frontend cutover, no replacement of legacy RPCs and no deploy. Product Owner approval is required after shadow reconciliation before any canonical backfill or UI switch.
