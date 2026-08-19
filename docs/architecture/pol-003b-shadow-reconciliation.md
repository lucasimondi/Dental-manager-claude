# POL-003B shadow reconciliation

## Production read-only observation

On 2026-08-19 an aggregate-only query was executed inside `BEGIN TRANSACTION READ ONLY` against the authorized production project. It returned no patient IDs, names, source-row IDs, clinical content, or tenant-identifying output. No production write, migration, function execution, configuration change, or deploy occurred.

| Metric | Legacy aggregate | Canonical row state | Classification |
|---|---:|---:|---|
| Preventivato netto compatible | EUR 6,954 | 0 canonical contracts/lines | `SEMANTIC_EXPECTED_NOT_ADAPTED` |
| Prodotto compatible (executed lines with a date) | EUR 2,181 | 0 canonical line events | `SEMANTIC_EXPECTED_NOT_ADAPTED` |
| Incassato compatible (positive settled payments) | EUR 5,102 | 0 canonical payment events | `SEMANTIC_EXPECTED_NOT_ADAPTED` |
| Accettato | unavailable | 0 canonical line events | `APPROXIMATION_NOT_ALLOWED` |
| Fatturato | unavailable | 0 canonical invoice events | `PRODUCT_OWNER_DECISION_REQUIRED` |

All canonical counts were zero: contracts, lines, lifecycle events, invoices, and payments. The variances therefore confirm the expected pre-backfill state; they are not an adapter defect.

The Preventivato and Prodotto figures above supersede the earlier EUR 7,670 / EUR 2,597 observation. That query had not applied the verified `eur` fixed discounts. POL-003D recalculated the revised targets directly from aggregate source evidence using the canonical proportional fixed-discount rule; no target is hardcoded in the report SQL.

## Versioned report

`supabase/reconciliation/pol_003b_shadow_reconciliation.sql` is a read-only, tenant- and period-parameterized query. It compares only definitions supported by source evidence: preventivato, prodotto and incassato. It emits `NULL` for accepted rather than fabricating a date. It does not attempt invoiced, cost, margin or EBITDA comparisons while their source semantics are unresolved.

Required invocation controls:

1. use a database role explicitly constrained to read-only access;
2. execute only inside the script's read-only transaction;
3. provide an approved tenant UUID and inclusive date range as psql variables;
4. retain only aggregate output; do not log query source rows;
5. do not invoke the adapter function in production.

## Variance classes

- `MATCH`: compatible aggregates agree.
- `SEMANTIC_EXPECTED_NOT_ADAPTED`: legacy compatible value exists while canonical ingestion is intentionally absent.
- `APPROXIMATION_NOT_ALLOWED`: the source cannot support the canonical event/date.
- `REVIEW_DATA_QUALITY_OR_ADAPTER`: a future post-backfill mismatch requires source-quality and adapter investigation before any cutover.
