# Financial domain — audited current logic

This records current behavior and inconsistencies. It does not authorize corrections.

## Current sources

Database RPC `get_kpi_periodo` and `get_costo_orario` are treated by the UI as authoritative, but their definitions are not versioned. Client hooks and components also calculate financial indicators from plans, payments, external payments, expenses, materials, machinery, appointments, and budgets.

## Known inconsistencies

- Expense contribution logic is duplicated between SQL and JavaScript; `useControlloDati.js` explicitly describes its implementation as an exact replica of `get_kpi_periodo`.
- Expense projections differ between `Spese.jsx` and the management-control hook, particularly around recurring periods and effective months.
- Discount allocation is inconsistent: executed/not-collected work proportionally allocates plan discounts, while accepted/not-executed work uses gross line prices.
- Payment deadlines/outstanding amounts use full plan value and do not subtract received payments.
- The new-patient KPI appears to interpret a patient ID as a JavaScript timestamp and is probably incorrect for identity/bigint IDs.
- “Revenue by service” derives theoretical value from executed plan lines, while collected revenue comes from payments/RPC; the UI can blur production and cash collection.
- Marginality is client-side and lacks an approved treatment of staff, overhead, historic cost validity, accounting recognition, and reconciliation.

## Proposed canonical lifecycle — Product Owner validation required

This is a proposed future model, not current production semantics:

`PREVENTIVATO → ACCETTATO → ESEGUITO → FATTURATO → INCASSATO → CREDITO RESIDUO`

Cost lifecycle:

`COSTO PREVISTO → COSTO IMPEGNATO → COSTO SOSTENUTO`

Before implementation, the Product Owner must approve definitions, transition rules, partial payments, discounts, refunds, cancellations, tax treatment, attribution dates, reconciliation, and reporting semantics. Until then, do not change or duplicate formulas.
