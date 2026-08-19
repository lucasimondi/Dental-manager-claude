# POL-003B legacy adapter implementation

## Scope and safety boundary

POL-003B installs one restricted, tenant-parameterized adapter function. The migration does not invoke it, schedule it, grant it to API roles, or alter any legacy table/RPC. Execution in production remains prohibited until a separate Product Owner gate.

The adapter is `SECURITY INVOKER`, requires an explicit non-null `studio_id`, validates the verified legacy schema at runtime, and is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Its unique canonical source keys and `ON CONFLICT DO NOTHING` make repeated execution idempotent.

## Implemented mappings

| Legacy source | Canonical target | Classification | Rule |
|---|---|---|---|
| `plans` | `financial_contracts_v1` | `EXACT`/`DERIVED` | Exact tenant, patient, proposal date and source ID; discount kind normalized only from verified `pct`/`percent`/`fixed`/`fisso` plus the POL-003D-verified `eur` fixed encoding; invalid or unknown non-zero encodings fail closed. |
| `plans.voci[]` | `financial_contract_lines_v1` | `EXACT` | Stable JSON ordinality is `source_line_id`; numeric non-negative price and service label are preserved. No pricelist/operator relationship is invented. |
| `voci[].eseguita` plus valid `dataEsec` | `financial_line_events_v1(PRODOTTO)` | `EXACT`/`DERIVED` | One positive full-fraction event per executed line. Net amount remains calculated by the canonical proportional-discount view. Missing execution dates are skipped. |
| settled positive `payments` | `financial_payment_events_v1(PAYMENT)` | `EXACT` | Exact tenant, patient, event date and amount. No contract/invoice allocation is invented; any later invoice debt uses the canonical FIFO rules. |

## Deliberate exclusions

- `ACCETTATO`: current plan status exists, but the historical acceptance event date does not. `APPROXIMATION_NOT_ALLOWED`.
- cancellation: a current status cannot establish the date or magnitude of a cancellation event. `APPROXIMATION_NOT_ALLOWED`.
- `documenti_fiscali`: stored amount/VAT meaning and the legacy `rimborso` event meaning remain insufficient for invoice, credit-note or refund backfill. `PRODUCT_OWNER_DECISION_REQUIRED` plus source remediation.
- negative legacy payments: the source does not prove that a negative value is a refund event. They are skipped, not reclassified.
- `pagamenti_esterni`: no verified `reconciled` field exists. No external payment enters canonical cash.
- `spese`, personnel, materials and machinery: current classifications/prices cannot reconstruct effective-dated historical cost events.
- appointments/configuration: scheduled duration is not proof of worked hours, and current capacity configuration is not historical availability.
- operator hints inside JSON: no verified durable operator contract exists. They are not copied.

The adapter returns aggregate inserted/skipped/blocked counters. These counters contain no patient-identifying information.

## Rollback

Before any future execution, rollback of the original POL-003B installation means dropping only `private.run_pol_003b_legacy_adapter_v1(uuid)`. After an authorized backfill, canonical rows must be reversed by their exact `(studio_id, source_table, source_id[, source_line_id])` provenance under a separately reviewed runbook; legacy source rows must never be changed.

POL-003D replaces the installed adapter definition through `20260819123457_pol_003d_eur_discount_normalization.sql`. The migration does not invoke the function and does not change its grants or security-invoker boundary. Rolling back this definition before execution means restoring the prior versioned POL-003B function body, not editing production manually.
