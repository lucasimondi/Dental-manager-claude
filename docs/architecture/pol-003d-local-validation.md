# POL-003D local validation

## Environment and scope

- dedicated branch `finance/POL-003D-controlled-backfill-reconciliation` from current `master`;
- Supabase CLI 2.115.0, consulted through its built-in command help;
- disposable container `pol003d-pg17` using Supabase PostgreSQL 17.6.1.159;
- synthetic schemas and records only, including two artificial tenants;
- no production migration, adapter execution, backfill, application write, deploy, cutover or merge.

## Database results

- POL-003A engine, POL-003B adapter and POL-003D replacement migration applied successfully locally with `ON_ERROR_STOP=1`.
- Updated POL-003B adapter regression passed: `eur` mapped to `FIXED`, EUR 30 allocated proportionally across EUR 100/EUR 200 lines as EUR 10/EUR 20, net values EUR 90/EUR 180, both produced events reconciled, and an unknown non-zero encoding remained fail closed.
- Adapter rerun inserted zero rows, proving idempotency.
- Tenant B execution did not change tenant A counts or values.
- The complete pre-existing POL-003A financial regression passed unchanged.
- `plpgsql_check` returned zero findings for `private.run_pol_003b_legacy_adapter_v1(uuid)`.
- The versioned read-only shadow report returned exact local matches: Preventivato EUR 270, Prodotto EUR 270 and Incassato EUR 150; Accettato remained `APPROXIMATION_NOT_ALLOWED`.
- `supabase db lint` reported no schema errors for `public,private`.
- Security advisors reported only fixture artifacts: RLS is intentionally absent on six minimal synthetic legacy/bootstrap tables and `plpgsql_check` is installed in `public`; the POL-003 canonical tables retain their tested RLS. Performance advisors reported no issues.

## Application and repository results

- `npm test`: four tests passed.
- `npm run build`: passed with existing pdfjs `eval` and chunk-size warnings.
- The legacy dashboard remains mounted; `CanonicalManagementView` was not activated.
- Secret-pattern scan and `git diff --check` passed; no production/deployment configuration or application source file changed.
- The disposable container was removed after validation.

## Aggregate-only production evidence

A read-only aggregate query recalculated the source-supported targets as EUR 6,954 Preventivato, EUR 2,181 Prodotto and EUR 5,102 Incassato. It also reconfirmed zero canonical contracts, lines, line events and payment events. No identifying or clinical field was returned and no remote adapter/function/migration was executed.

## Residual risks and gate

Local synthetic proof cannot replace a controlled, reversible production reconciliation. The future attempt must use exact provenance, compare all three revised aggregates, and roll back on any mismatch. Accepted events, fiscal documents/refunds, external payments, historical costs, hours and operator attribution remain deliberately excluded. Frontend cutover remains prohibited.
