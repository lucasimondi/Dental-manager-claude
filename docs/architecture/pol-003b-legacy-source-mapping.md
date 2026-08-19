# POL-003B — Legacy source mapping

Status: production metadata/read-only aggregate evidence captured; no production writes.

## Classification vocabulary

- `EXACT`: source carries the required canonical value/date directly.
- `DERIVED`: deterministic transformation from authoritative legacy fields.
- `APPROXIMATION_NOT_ALLOWED`: available data is insufficient for a truthful canonical event.
- `PRODUCT_OWNER_DECISION_REQUIRED`: multiple legitimate interpretations remain.

## Production evidence snapshot

Read-only inspection found:

- `plans`: 10 rows. Observed `voci` keys: `dataEsec`, `dente`, `eseguita`, `incassata`, `prestazione`, `prezzo`.
- plan states: 3 `accettato`, 3 `attivo`, 4 `concluso`.
- `payments`: 15 rows; all current rows have `stato='pagato'`.
- `documenti_fiscali`: 6 rows; all current rows have `tipo='rimborso'`.
- `pagamenti_esterni`: 3 rows.
- `spese`: 8 rows; 3 fixed, 5 variable; current rows are monthly recurrence.
- canonical `financial_*_v1` production tables were empty when POL-003B started.

No patient names, document bodies, PDFs or PHI were extracted for this mapping.

## Mapping matrix

### Contracts / quotes

Legacy source: `plans`.

- `financial_contracts_v1.source_table/source_id`: `EXACT` from `plans` + id.
- `studio_id`, `patient_id`, proposal date: `EXACT` from `plans.studio_id`, `paziente_id`, `data`.
- discount: `DERIVED` from `sconto` + `sconto_tipo`, using POL-003A canonical proportional allocation.
- contract lines: `DERIVED` by stable JSON-array ordinal inside `plans.voci` because no independent legacy line id exists.
- gross line amount: `EXACT` from `voci[*].prezzo` when numeric and non-negative.
- service label/reference: `EXACT` textual evidence from `voci[*].prestazione`; canonical durable pricelist FK is `APPROXIMATION_NOT_ALLOWED` unless an unambiguous legacy link exists.

`PREVENTIVATO` can therefore be mapped deterministically as plan net after discount using `plans.data` as proposal event date.

### Accepted events

Legacy source: `plans.stato`.

Current states observed: `attivo`, `accettato`, `concluso`.

The present schema has no explicit acceptance timestamp/date. Mapping a plan that is currently accepted/concluded to a historical acceptance date cannot be done truthfully from `plans.data` unless Product Owner declares proposal date to be an accepted-date fallback.

Classification: `APPROXIMATION_NOT_ALLOWED` for historical accepted-event date.

Safe shadow alternatives:

1. current accepted-stock snapshot can be derived as-of-now from status, but not attributed to the true historical acceptance period;
2. future acceptance events should write an explicit event date into the canonical engine.

### Produced events

Legacy source: `plans.voci[*]`.

- executed state: `EXACT` from `eseguita=true`.
- production date: `EXACT` when `dataEsec` is populated and parseable.
- net produced value: `DERIVED` from line gross price less proportional plan discount.
- executed line with no valid `dataEsec`: historical period attribution is `APPROXIMATION_NOT_ALLOWED`; include in data-quality report rather than guessing.

The legacy `incassata` line boolean is explicitly non-authoritative for canonical cash/allocation.

### Invoice / fiscal events

Legacy source candidate: `documenti_fiscali` plus `src/components/DocFiscale.jsx`.

Available table fields include `tipo`, `numero`, `data`, `paziente_id`, `importo`, `studio_id`, but no explicit taxable/VAT/gross split.

Current production evidence contains six records and every one is `tipo='rimborso'`.

Application-code evidence adds two important legacy semantics:

1. `documenti_fiscali.importo` is saved as the pre-VAT line subtotal (`totale`). For ordinary invoices the generated PDF separately displays `totale + IVA`, but the archived database `importo` does not store that gross amount.
2. When a plan is imported into a fiscal document, the code calculates the plan discount (`finale`) but then populates the fiscal-document rows from each original `v.prezzo`; the calculated discounted total is not applied to those imported line amounts. Therefore an invoice assembled from a discounted plan may not preserve the plan's net commercial value.

Consequences:

- for a true legacy `fattura`, `documenti_fiscali.importo` is potentially usable as taxable/pre-VAT subtotal only if the document rows themselves are authoritative; it is not a reliable gross-document amount;
- reconstructing historical VAT from today's `studio_info.aliquota_iva` is `APPROXIMATION_NOT_ALLOWED` unless historical regime/rate is provably the same on the document date;
- fiscal documents generated from discounted plans can diverge from canonical produced/accepted net value by design of the old UI;
- current `tipo='rimborso'` means those six production records cannot be classified as invoice revenue without first determining whether they represent reimbursements to the patient, expense reimbursement documents, or another workflow meaning.

Until those semantics are resolved, `FATTURATO_NETTO_IVA`, `FATTURATO_IVA` and `FATTURATO_LORDO` historical backfill must remain partial/data-quality flagged rather than fabricated.

### Payment events

Legacy source: `payments`.

- studio/patient/date/amount: `EXACT`.
- current observed payment rows all have `stato='pagato'`.
- payment method: retained as source metadata, not a financial formula input.
- canonical positive payment event: `DERIVED` for legacy rows whose status is accepted as settled/paid.
- no deterministic invoice allocation exists in legacy schema: initial allocation must use POL-003A FIFO where eligible, while preserving advances as unallocated cash.

Historical refunds must not be inferred from negative/ambiguous rows without evidence.

### External payments

Legacy source: `pagamenti_esterni`.

Fields do not include a verified canonical reconciliation flag.

Classification: `APPROXIMATION_NOT_ALLOWED` for canonical `INCASSATO` until a deterministic reconciliation rule/state is introduced.

POL-003A requires external payments to enter canonical cash only when `reconciled=true`.

### Expenses

Legacy source: `spese`.

- amount/start date/end date/recurrence/frequency/type: available.
- fixed vs variable legacy classification: `EXACT` from `tipo_costo` for current rows.
- mapping `fisso` -> `FISSO_OPERATIVO`: `DERIVED` only for categories that are actually operational fixed costs under POL-003A.
- mapping `variabile` -> `VARIABILE_ATTRIBUIBILE`: not automatically valid. A generic variable expense is not necessarily attributable to produced service.

A category-level classification matrix is required before canonical EBITDA backfill. Do not classify missing/unknown categories as variable by fallback.

Recurring expense expansion must preserve effective start/end dates. Historical recurring-month semantics must follow the existing verified period-expansion contract or be reported separately.

### Personnel

Legacy source: `personale`.

- monthly cost, weekly hours, start date and active flag are available.
- base personnel structure cost can be `DERIVED` into fixed operating structure cost only after defining historical effective periods; there is no explicit end date or cost-version history.
- using today's monthly cost to rewrite historical months is `APPROXIMATION_NOT_ALLOWED`.

### Materials / machinery / service links

Legacy sources: `materiali`, `macchinari`, `prestazione_materiali`, `prestazione_macchinari`, `pricelist`.

These are suitable for current/theoretical service marginality but lack effective-dated historical cost versions.

- current service resource model: `DERIVED`.
- historical produced cost backfill using current material/machine values: `APPROXIMATION_NOT_ALLOWED`.

Future canonical cost events must snapshot the cost version at production time.

### Hours

Legacy source candidates: `studio_info.config_orario`, `appointments`.

- available structure capacity may be `DERIVED` from versioned/effective schedule configuration only where historical config is known.
- appointment duration is not automatically equal to actual worked clinical time.
- using all booked non-cancelled appointment minutes as historical `ORE_EFFETTIVE`: `APPROXIMATION_NOT_ALLOWED` unless the Product Owner explicitly adopts that operational proxy.

Future workflows should capture actual worked duration directly or derive it from completed session/service events.

## Immediate adapter design

The first adapter must be intentionally partial and data-quality aware:

1. map contracts and lines;
2. map produced events only when `eseguita=true` and valid `dataEsec` exists;
3. map settled legacy payments as payment events, with allocations computed by canonical rules;
4. do not ingest external payments until reconciliation state exists;
5. do not ingest fiscal documents as invoices until `rimborso` semantics and VAT basis are resolved;
6. do not invent historical accepted dates;
7. do not backfill historical variable/material/personnel/machinery costs from present values;
8. emit reconciliation/data-quality counters for every skipped or non-mappable record.

## Shadow comparison principles

Legacy-vs-canonical comparisons must compare like-for-like semantics. Expected differences are not automatically bugs.

Examples:

- legacy produced gross vs canonical produced net-after-discount will differ by design;
- legacy cash may include unreconciled `pagamenti_esterni`; canonical cash must not;
- legacy residual may clamp overpayment to zero; canonical unallocated cash preserves it;
- legacy break-even may compare against cash; canonical break-even compares against produced value;
- legacy fiscal archive can diverge from PDF gross and from discounted-plan economics because of the old storage/import behavior described above.

Every variance must be categorized as `SEMANTIC_EXPECTED`, `DATA_QUALITY`, `ADAPTER_BUG`, or `UNRESOLVED_SOURCE_SEMANTICS` before any frontend cutover.
