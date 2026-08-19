# POL-003D — Controlled Backfill Gate Finding

Date: 2026-08-19
Status: BACKFILL_BLOCKED_PENDING_ADAPTER_RECONCILIATION

## Production-safe execution result

POL-003B and POL-003C structural migrations were applied successfully in production. POL-003B only installed the restricted adapter function; POL-003C added `studio_info.management_control_mode` with default `base` and a `base|advanced` check constraint.

A controlled adapter execution was then attempted for the only tenant containing legacy financial data. Before execution the canonical financial tables were empty.

Adapter counters:
- contracts inserted: 8
- contract lines inserted: 39
- produced events inserted: 13
- payment events inserted: 15
- plans skipped: 2
- lines skipped: 0
- produced skipped: 0
- payments skipped: 0
- fiscal documents blocked: 6
- external payments blocked: 3
- costs blocked: 8

## Reconciliation failure

Previously validated aggregate-only legacy shadow values:
- Preventivato netto compatible: EUR 7,670
- Prodotto compatible: EUR 2,597
- Incassato compatible: EUR 5,102

Post-adapter canonical aggregates:
- Preventivato: EUR 5,260
- Prodotto: EUR 1,187
- Incassato: EUR 5,102

Cash matched exactly. Preventivato and Prodotto did not match because two plans were excluded by the adapter fail-closed eligibility rules. The excluded value is material and therefore partial backfill is not acceptable for cutover.

## Rollback

The controlled backfill was fully rolled back by exact tenant/source provenance immediately after the mismatch was detected.

Verified post-rollback canonical counts for the tenant:
- contracts: 0
- contract lines: 0
- line events: 0
- payment events: 0

No frontend cutover occurred. Legacy dashboards remain authoritative for the current UI.

## Required POL-003D work

1. Identify exactly why the two plans fail POL-003B eligibility without extracting PHI.
2. Classify each failure as data quality, legacy encoding variant, or unsupported financial semantics.
3. Do not relax validation generically.
4. If the legacy encoding can be deterministically normalized without changing meaning, implement the narrowest explicit normalization and add regression fixtures.
5. Re-run local adapter tests and the production shadow reconciliation read-only.
6. Controlled production backfill may be retried only when expected eligible aggregates reconcile exactly for Preventivato, Prodotto and Incassato.
7. Keep Accettato, Fatturato, external payments, historical costs/hours/operator attribution blocked until separately supported.
8. Do not mount CanonicalManagementView or cut over Base/Advanced dashboards before reconciliation passes.
