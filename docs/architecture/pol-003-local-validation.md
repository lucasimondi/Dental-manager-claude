# POL-003 local validation

Date: 2026-08-18

Environment: disposable local Supabase CLI `2.115.0`, PostgreSQL `17`, WSL2/Docker

Data: synthetic identifiers and amounts only

## Scope validated

The FIN-001 inventory was completed from versioned repository evidence. The canonical engine v1 was then applied only to an isolated local database containing the minimum synthetic `studio_users` contract required by the migration.

The engine is additive. It does not replace the unversioned legacy RPC bodies, migrate legacy rows, change frontend reads, or select any unresolved financial semantic. Callers must explicitly supply quote basis (`GROSS` or `NET`) and credit basis (`ACCETTATO`, `PRODOTTO` or `FATTURATO`).

## Database result

- Synthetic fixture: passed.
- Migration with `ON_ERROR_STOP=1`: passed.
- Regression transaction `supabase/tests/pol_003_financial_engine.sql`: passed and rolled back.
- `supabase db lint --local --schema public,private --level warning --fail-on error`: no schema errors.

The regression suite verifies advance payment, partial payment, fixed discount allocation, partial execution, acceptance cancellation through an explicit reversal event, refund, reconciled versus unreconciled external payment, production and cash in different months, effective-dated historical costs, two-tenant isolation, multiple operators, and zero denominators. Every scenario asserts `PREVENTIVATO`, `ACCETTATO`, `PRODOTTO`, `FATTURATO`, `INCASSATO`, `CREDITO_RESIDUO` and contribution margin; applicable scenarios also assert cost lifecycle, EBITDA, break-even and hourly metrics.

Security assertions verify fail-closed JWT/membership tenancy, RLS isolation, absence of anonymous RPC execution and absence of direct authenticated writes to canonical source tables. Snapshot values reconcile to the drill-down event records.

## Application and repository result

- `npm ci --ignore-scripts`: passed; npm reported the existing dependency audit findings (2 moderate, 6 high, 2 critical), which are outside POL-003 scope.
- `npm run build`: passed.
- Final `git diff --check`: passed.
- Targeted credential-pattern and high-entropy scan of the task diff: passed; no credential was added.
- Scope review: no application source, deployment configuration or remote environment changed.

## Production boundary

No production database was queried or modified during implementation validation. No remote migration was applied, no deployment was started and no branch was merged. Production reconciliation, legacy adapters and frontend cutover remain gated on Product Owner decisions and a separately authorized rollout.

## Residual risks

- Production SQL bodies for `get_kpi_periodo` and `get_costo_orario` remain unavailable, so old/new reconciliation is not yet possible.
- Legacy source-to-canonical adapters cannot be authored safely until the missing backend baseline and Product Owner semantic decisions are available.
- VAT basis, credit basis, cancellation/restatement, refund/reversal, allocation, external reconciliation, EBITDA cost taxonomy, cost-date semantics and productive-capacity definitions remain open exactly as listed in FIN-001.
- The new source tables intentionally revoke direct authenticated writes; a separately reviewed ingestion path is required before rollout.
- Synthetic validation proves the defined contract, not compatibility with unversioned production data.
