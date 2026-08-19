# POL-003C local validation

## Environment

- disposable Supabase PostgreSQL `17.6.1.159` container;
- two synthetic studios and synthetic JWT claims;
- no production data, migration, backfill, deploy or configuration change.

## Results

- migration applied successfully to the synthetic baseline;
- existing studio rows received `base`;
- `advanced` persisted for studio A;
- studio A could neither see nor update studio B;
- studio B remained `base`;
- invalid mode was rejected by the database constraint;
- four Node selector tests passed: mode normalization/persistence contract, visibility-only switching, canonical RPC-only loading/fail-closed error handling, and absence of legacy sources/formula implementation;
- production build passed with the pre-existing pdfjs `eval` and large-chunk warnings;
- dependency installation retained 10 pre-existing audit findings: 2 moderate, 6 high and 2 critical.

## Cutover gate

The canonical component is deliberately dormant. Validation proves persistence and architecture, not readiness of production canonical data. A later Product Owner gate must order remote migration, reconciliation acceptance, backfill and UI cutover; none occurred in POL-003C.
