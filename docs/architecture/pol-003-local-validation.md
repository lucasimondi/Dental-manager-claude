# POL-003A local validation

Date: 2026-08-19

Environment: disposable local Supabase CLI `2.115.0`, PostgreSQL `17`, WSL2/Docker

Data: synthetic identifiers and amounts only

## Scope validated

The Product Owner semantics lock was applied to the unpublished additive POL-003 migration. The engine remains isolated from legacy frontend reads and unversioned production RPCs. Ambiguous `quote_basis` and `credit_basis` parameters were removed.

## Database result

- Synthetic membership fixture: passed.
- Migration with `ON_ERROR_STOP=1`: passed on a freshly recreated local database.
- `supabase/tests/pol_003_financial_engine.sql`: passed and rolled back all synthetic mutations.
- `supabase db lint --local --schema public,private --level warning --fail-on error`: no schema errors.
- `supabase db advisors --local`: no security or performance issues.

Regression coverage includes percentage and fixed discounts, advance, overpayment, explicit partial allocation, patient-level FIFO, current-period cancellation, refund, credit note, production reversal, reconciled/unreconciled external payments, all three operational balance metrics, unallocated cash, break-even against production, available versus worked hours, multiple operators, zero denominators and two-tenant isolation.

Security assertions verify eight RLS SELECT policies, fail-closed tenant membership, no anonymous RPC execution, no authenticated direct writes and removal of the old ambiguous RPC signature. Snapshot totals reconcile to event-level drill-down records.

## Application and repository result

- `npm run build`: passed with pre-existing pdfjs `eval` and large-chunk warnings.
- `git diff --check`: passed.
- Targeted credential-pattern scan: passed.
- Scope review: no application source or deployment configuration changed.

## Production boundary

No production database was queried or modified. No remote migration was applied, no deployment was started and no branch was merged. The disposable local stack was stopped and deleted after validation.

## Residual risks and decisions

- `PRODUCT_OWNER_DECISION_REQUIRED`: automatic allocation reversal for an unallocated refund is not defined; POL-003A requires explicit negative allocation.
- `PRODUCT_OWNER_DECISION_REQUIRED`: whether public snapshots need opening/closing/movement columns in addition to closing stocks.
- `PRODUCT_OWNER_DECISION_REQUIRED`: whether hourly structure cost should include further configured operating categories.
- Legacy adapters remain blocked by missing production SQL/backend definitions and cannot safely infer dates or relationships.
- Synthetic validation proves the new contract but not compatibility with unversioned production data.
- The canonical source tables intentionally reject direct authenticated writes; a separately reviewed ingestion path is required before rollout.
