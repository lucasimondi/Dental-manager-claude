# Current task

- TASK: POL-003A
- TITLE: Product Owner Semantics Lock
- OWNER: CODEX
- BRANCH: `design/POL-003-financial-source-of-truth`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Lock the Product Owner-approved POL-003 semantics into the versioned, tenant-safe server-side canonical engine and regression suite without changing production, deploying, or applying remote migrations.

## Required work

1. Make `PREVENTIVATO` net after discount while retaining gross and discount amounts.
2. Lock accepted, produced, invoice, cash, allocation, cancellation/reversal, cost, break-even and hour semantics from the Product Owner decision.
3. Replace generic residual credit with portfolio-to-execute, produced-to-invoice, customer receivable and unallocated cash balance.
4. Remove ambiguous quote/credit basis parameters and retain server-side deterministic drill-down reconciliation.
5. Add explicit payment allocation plus deterministic patient-level FIFO for otherwise unallocated positive cash.
6. Run migration, regression tests, database lint, build, secret scan and diff checks locally only.

## Production gate

Do not modify production, apply remote migrations, deploy, or merge. Product Owner approval is required before any production reconciliation, rollout or unresolved financial semantic is selected.

## Completed local evidence

- FIN-001 formula and data-source inventory completed in `docs/architecture/pol-003-fin-001-inventory.md`.
- Product Owner semantics locked in `docs/architecture/pol-003a-product-owner-semantics-lock.md`.
- Additive canonical engine v1 updated in migration `20260818190642_pol_003_financial_engine_v1.sql`; it remains disconnected from legacy frontend reads.
- Synthetic POL-003A regression suite passed on a disposable local Supabase/PostgreSQL 17 instance, including discounts, advance/overpayment, partial and FIFO allocation, cancellation, refund, credit note, production reversal, external reconciliation, separate balances, break-even, hour denominators and two-tenant isolation.
- Supabase schema lint and advisors reported no issues; application build passed; final diff and secret checks are recorded in the POL-003A handoff.
- No production or remote migration, deployment or merge was performed.

## Waiting on Product Owner

Review the POL-003A implementation and the remaining explicitly documented decisions before authorizing legacy adapters, frontend cutover, production reconciliation or rollout. Do not begin a new task without Product Owner approval.
