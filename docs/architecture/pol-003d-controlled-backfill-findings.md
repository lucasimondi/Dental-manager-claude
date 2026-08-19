# POL-003D — Controlled Backfill Gate Finding

Date: 2026-08-19
Status: LOCAL_FIX_VALIDATED_WAITING_PRODUCT_OWNER

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

## POL-003D resolution prepared

Repository and aggregate-only production evidence verified that the two excluded plans use exactly `sconto_tipo='eur'`. The application treats `pct` as percentage and every other UI-supported type as a fixed amount; `eur` is therefore the evidenced fixed-euro encoding. The adapter now adds only `eur -> FIXED`. It does not introduce a catch-all, and unknown non-zero discount types remain ineligible.

The shadow query now allocates `eur` discounts proportionally across plan lines using the same rule as `private.financial_line_values_v1`. Synthetic coverage proves two produced lines with gross values EUR 100 and EUR 200 under a EUR 30 fixed plan discount become EUR 90 and EUR 180 net.

## Revised aggregate targets

An aggregate-only query was executed against production inside `BEGIN TRANSACTION READ ONLY`; it returned no tenant identifier, patient identifier, source-row identifier or clinical content. The query recalculated values from the eligible legacy records rather than hardcoding prior observations.

| Metric | Revised compatible target | Prior invalid target | Reason |
|---|---:|---:|---|
| Preventivato | EUR 6,954 | EUR 7,670 | fixed-euro discounts are now applied proportionally |
| Prodotto | EUR 2,181 | EUR 2,597 | produced lines receive the same proportional fixed discount |
| Incassato | EUR 5,102 | EUR 5,102 | settled positive payment mapping was already exact |

The same read-only observation reconfirmed zero canonical contracts, lines, line events and payment events after the earlier rollback. These values are reconciliation evidence, not constants embedded in the adapter or financial engine.

## Remaining gate

No production migration, adapter execution, backfill, deploy, frontend cutover or merge occurred in POL-003D. A second controlled production attempt requires explicit Product Owner approval and must stop and roll back unless all three revised compatible targets reconcile exactly. `ACCETTATO`, fiscal invoice/refund semantics, external payments, historical costs, hours and operator attribution remain blocked.
