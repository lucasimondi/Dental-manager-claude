# POL-FIN-006 — Prodotto live e riconciliazione

Status: IMPLEMENTED LOCALLY — migration not applied remotely

## Sources and semantics

`Prodotto` is derived from `public.plans.voci`:

- `voci[*].prezzo` is the plan-saved original/pre-discount agreed amount. The pricelist only pre-fills this field and is never queried by the financial read model.
- `plans.sconto` and `plans.sconto_tipo` define the plan-level commercial discount.
- `voci[*].eseguita=true` is required.
- `voci[*].dataEsec` is the recognition date.

The plan net is allocated proportionally by original line price. Monetary allocation is performed in cents: each ideal share is floored, then residual cents are assigned by descending fractional remainder with JSON ordinality as the deterministic tie-break. The original line value remains unchanged and the allocated sold values always sum exactly to the plan net.

`Incassato` is derived from positive `public.payments` rows with `stato='pagato'`, on `payments.data`. `payments.piano_id` is the strongest authoritative allocation and remains plan-level. A NULL or incoherent plan link is patient-level/unallocated; no payment amount is ever assigned to a service line.

`Scostamento = Prodotto - Incassato` for the selected period. It is a timing/collection gap, not automatically a patient debt.

## Canonical read model

Migration `20260901190000_pol_fin_006_live_prodotto_reconciliation.sql` adds:

- `private.financial_live_plan_line_values_v1`;
- `private.financial_live_payment_values_v1`;
- `private.financial_live_data_quality_v1`;
- `public.get_prodotto_reconciliation_v1`.

It replaces the bodies of `get_financial_drilldown_v1` and `get_financial_snapshot_v1` so legacy `plans`/`payments` are live while non-legacy canonical events remain supported. `private.incassi_plan_totals_v1` also consumes the same sold-line view, removing the separate plan-discount formula from the saldo path.

`private.incassi_plan_saldo_v1`, `get_saldo_piano`, and `get_saldi_aperti_studio` use only payment links whose studio and patient match the linked plan. Invalid plan financial inputs make the relevant balance RPC unavailable instead of silently removing the plan from the worklist.

Existing consumers continue through `get_financial_snapshot_v1`: Controllo di gestione, annual/monthly ledger, chart, PDF/CSV export, Home financial widgets, Patient Workspace financial reads, and Poliedron.

## Data quality

The engine fails closed rather than summing only valid rows:

- invalid/non-array plan items;
- invalid line prices;
- invalid discount type/value;
- executed item without a valid execution date;
- ambiguous payment status such as legacy `acconto`;
- non-positive `pagato` value or missing payment date.

Affected KPI values are `NULL` and carry an explicit `data_quality_status`. Plan/payment link mismatches do not change cash but mark reconciliation incomplete. `sospeso` is known non-cash and is excluded. Negative legacy payments and fiscal `rimborso` documents are not reclassified as refunds.

## Reconciliation UX

Clicking Prodotto opens the exact selected annual or monthly period. The backend returns:

- period and cumulative totals;
- executed item values and dates;
- plan-linked payment rows, including before/in/after-period labels;
- patient-level unallocated payments;
- residual, overcollection, reconciled, and incomplete states;
- data-quality issue counts.

Patient names are joined only from the already RLS-scoped frontend patient collection. The financial RPC returns patient IDs, not patient names.

## Security

- Private views are `security_invoker=true`.
- RPCs use `search_path=''`.
- Snapshot, generic drill-down, and detail RPC require `finance.management.read`; the detail RPC also requires exact JWT tenant context before reading the live RLS-protected sources.
- `PUBLIC` and `anon` execute privileges are revoked.
- Existing `plans` and `payments` RLS remain unchanged and active.
- No service-role client, tenant fallback, backfill, or production write is introduced.

## Legacy limits

Plan JSON lines do not have a durable item ID. Ordinality is used only as deterministic allocation tie-break and current read-model reference; it is not treated as a payment allocation key. Explicit canonical production reversals/refunds remain supported by the canonical event ledger, but legacy negative payments or execution toggles are not silently reinterpreted as those events.

## Deployment and rollback

This branch does not apply the migration remotely. Deployment requires a separate Product Owner gate.

Rollback restores the immediately preceding versioned definitions of `get_financial_snapshot_v1`, `get_financial_drilldown_v1`, and `private.incassi_plan_totals_v1`, then drops the new detail RPC, views, and date parser. The migration never mutates `plans` or `payments`.
