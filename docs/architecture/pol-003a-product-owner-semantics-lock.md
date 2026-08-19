# POL-003A — Product Owner semantics lock

Status: approved semantics, locally implemented; no production application

## Canonical commercial and revenue lifecycle

- `PREVENTIVATO` is the proposed value net of commercial discount. `PREVENTIVATO_LORDO` and `SCONTO` remain separately reconcilable.
- `ACCETTATO` is the net contract value accepted on the acceptance-event date.
- `PRODOTTO` is the net value actually performed. A plan discount is allocated proportionally to its lines; production reversals are explicit negative events in their own period.
- Invoicing is exposed as `FATTURATO_NETTO_IVA` (taxable amount), `FATTURATO_IVA`, and `FATTURATO_LORDO`. Invoice and credit-note events are distinct and dated when issued.
- `INCASSATO` is signed cash by receipt/refund date. An advance changes cash only. External payments enter only when `reconciled=true`.

No generic `CREDITO_RESIDUO` remains. The engine exposes cumulative stock through the snapshot end date:

- `PORTAFOGLIO_DA_ESEGUIRE = ACCETTATO - PRODOTTO`;
- `PRODOTTO_DA_FATTURARE = PRODOTTO - FATTURATO_NETTO_IVA`;
- `CREDITO_CLIENTI = FATTURATO_LORDO - INCASSATO_ALLOCATO`;
- `SALDO_INCASSI_NON_ALLOCATO = INCASSATO - INCASSATO_ALLOCATO`, preserving advances and overpayments without clamping.

The taxable invoice amount is compared with produced value; gross invoice value is compared with allocated cash. This keeps VAT explicit instead of mixing it into production margin.

## Payment allocation

Explicit allocation to an invoice/contract/line wins. Remaining reconciled positive cash is allocated FIFO to the oldest positive invoice for the same tenant and patient, ordered deterministically by event date and identity. The legacy `incassata` checkbox is not an input to the canonical engine.

An explicit plan/service link made before invoicing is preserved and excludes that amount from unrelated FIFO allocation. It becomes `INCASSATO_ALLOCATO` for customer-receivable purposes only when an invoice allocation exists; until then it remains an advance in `SALDO_INCASSI_NON_ALLOCATO`.

Refunds are separate negative cash events. When a refund reverses an invoice allocation, that negative allocation must be explicit. Credit notes do not alter cash, and production reversals do not alter invoices or cash.

An unallocated refund is never auto-FIFO matched against historical invoice allocations. It remains an explicit negative event in `SALDO_INCASSI_NON_ALLOCATO` until a user or authorized system supplies a reconciliation target.

## Costs and operating metrics

- `MARGINE_CONTRIBUZIONE = PRODOTTO - COSTI_VARIABILI_ATTRIBUIBILI`.
- `EBITDA_OPERATIVO_GESTIONALE = PRODOTTO - COSTI_VARIABILI_ATTRIBUIBILI - COSTI_FISSI_OPERATIVI`.
- Depreciation/amortization, interest, tax and extraordinary classifications are excluded from this EBITDA.
- `BREAK_EVEN = COSTI_FISSI_OPERATIVI / MARGINE_CONTRIBUZIONE_%`; achievement is compared with `PRODOTTO`.
- Available productive hours and actually worked clinical hours are distinct event types.
- `COSTO_ORARIO_STRUTTURA = COSTI_FISSI_OPERATIVI_DI_STRUTTURA_E_BASE_PERSONALE / ORE_PRODUTTIVE_DISPONIBILI`.
- `PRODUZIONE_ORA = PRODOTTO / ORE_EFFETTIVAMENTE_LAVORATE`.
- `INCASSO_ORA = INCASSATO / ORE_EFFETTIVAMENTE_LAVORATE`.

For hourly structure cost, the numerator includes rent, base payroll and employer cost, leases, software, insurance, base utilities, professional/administrative operating services and equivalent configured fixed operating categories. It excludes patient/service-specific materials, laboratory, per-service commissions, payment fees and other production-attributable variable costs, plus depreciation/amortization, interest, tax and extraordinary items. Any future full-cost hourly metric must use a different name.

Zero or negative denominators yield `NULL`, not a fabricated number.

## Period and audit rules

Lifecycle flows use event dates inside the requested period. Each of the four stock metrics exposes opening value, signed period movements and closing value. The unsuffixed headline equals closing, and `opening + movements = closing` must reconcile exactly. Drill-down accepts `_APERTURA`, `_MOVIMENTI` and `_CHIUSURA` metric suffixes and includes every contributing source event. Cancellation, credit note, refund and production reversal are recorded in the period in which they occur and never rewrite prior events.

## Remaining implementation dependency

The three Product Owner decisions are fully locked. Exact legacy-table-to-canonical ingestion mappings and authoritative dates still cannot be chosen until the missing production SQL/backend baseline is available; this is an evidence dependency rather than an unresolved financial semantic.
