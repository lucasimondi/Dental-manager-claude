# Current task

- TASK: POL-003
- TITLE: Financial Source of Truth
- OWNER: CODEX
- BRANCH: `design/POL-003-financial-source-of-truth`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Turn the approved POL-003 design into a verifiable, versioned, tenant-safe server-side canonical financial engine without changing production, deploying, or applying remote migrations.

## Required work

1. Complete FIN-001: inventory every current financial formula, source table and RPC visible in the repository; map duplicates, divergences and client-side calculations without inventing missing definitions.
2. Record every unresolved semantic as `PRODUCT_OWNER_DECISION_REQUIRED` and continue only with unambiguous implementation.
3. Implement the canonical lifecycle with distinct `PREVENTIVATO`, `ACCETTATO`, `PRODOTTO`, `FATTURATO`, `INCASSATO` and `CREDITO_RESIDUO` measures.
4. Keep all canonical formulas server-side, deterministic, versioned, tenant-safe and reconcilable to drill-down source records.
5. Add synthetic regression coverage for advance/partial payments, discounts, partial execution, cancellation, refund, external payment, cross-period service/cash, historical costs, two tenants, multiple operators and zero denominators.
6. Run the migration and tests only in a disposable local Supabase/PostgreSQL environment, then run build, secret scan and diff checks.

## Production gate

Do not modify production, apply remote migrations, deploy, or merge. Product Owner approval is required before any production reconciliation, rollout or unresolved financial semantic is selected.

## Completed local evidence

- FIN-001 formula and data-source inventory completed in `docs/architecture/pol-003-fin-001-inventory.md`.
- Additive canonical engine v1 prepared in migration `20260818190642_pol_003_financial_engine_v1.sql`; it is not connected to legacy frontend reads.
- Synthetic regression suite passed on a disposable local Supabase/PostgreSQL 17 instance, including all required lifecycle, cost, tenancy, operator and zero-denominator scenarios.
- Supabase schema lint passed with no errors; application build passed; final diff and secret checks are recorded in the POL-003 handoff.
- No production or remote migration, deployment or merge was performed.

## Waiting on Product Owner

Resolve or explicitly defer the `PRODUCT_OWNER_DECISION_REQUIRED` items in FIN-001 before authorizing legacy adapters, frontend cutover, production reconciliation or rollout.
