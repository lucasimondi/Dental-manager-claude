# POL-003 — Financial Source of Truth

Status: PRODUCT DESIGN / NOT YET IMPLEMENTED
Owner: Tech Lead + Product Owner

## Objective
Create one canonical financial model for Poliedra so every dashboard, KPI, report, forecast and AI answer derives from the same definitions and the same server-side calculations.

The current repository documents duplicated and inconsistent logic between SQL and JavaScript. POL-003 removes that ambiguity before new financial features are added.

## Canonical lifecycle
Revenue / clinical-commercial lifecycle:

`PREVENTIVATO → ACCETTATO → ESEGUITO → FATTURATO → INCASSATO → CREDITO RESIDUO`

Cost lifecycle:

`COSTO PREVISTO → COSTO IMPEGNATO → COSTO SOSTENUTO`

These states must remain analytically distinct. Production is not cash. Invoicing is not cash. Outstanding credit is not revenue earned twice.

## Canonical measures

### 1. Preventivato
Gross value of proposed plans/quotes in the selected period. It is a pipeline/commercial metric, not revenue.

### 2. Accettato
Net contractual value accepted by the client/patient after discounts. It is backlog / committed demand, not yet production or cash.

### 3. Prodotto / Eseguito
Net economic value of services actually performed in the period, after the economically attributable share of discounts, cancellations and reversals.

### 4. Fatturato
Value of fiscal documents issued in the period. It must not be used as a synonym for produced revenue or collected cash.

### 5. Incassato
Cash/payment value actually received in the period, including integrated external payment sources once reconciled.

### 6. Credito residuo
Amount due but not yet collected for performed/invoiced/contractually due items, according to the chosen operational rule. It must subtract actual collections and refunds.

### 7. Costi variabili
Costs that scale directly with production/service delivery: materials, laboratory, consumables, commissions directly attributable to a service, payment fees where treated as variable, and other explicit variable categories.

### 8. Costi fissi
Costs incurred regardless of individual service volume: rent, base payroll, insurance, software subscriptions, utilities base component, professional services, leases, etc. Classification must be configurable but canonical once selected.

### 9. Margine di contribuzione
`PRODOTTO_NETTO - COSTI_VARIABILI_ATTRIBUITI`

Percentage:
`MARGINE_CONTRIBUZIONE / PRODOTTO_NETTO`

### 10. EBITDA operativo gestionale
Management metric, not statutory accounting EBITDA unless explicitly reconciled:

`PRODOTTO_NETTO - COSTI_VARIABILI - COSTI_FISSI_OPERATIVI`

The UI must call it "EBITDA operativo gestionale" until accounting reconciliation is implemented.

### 11. Break-even
Revenue/production needed to cover fixed costs at the current contribution-margin ratio:

`COSTI_FISSI / MARGINE_CONTRIBUZIONE_%`

If the contribution-margin percentage is zero or negative, break-even is undefined and the UI must show an explicit warning rather than a misleading number.

### 12. Costo orario
Two separate metrics are required:

- `costo_orario_struttura`: allocated operating cost / productive capacity hours;
- `costo_orario_operatore`: attributable operator cost / productive operator hours.

They must never be silently mixed.

### 13. Produttività
At minimum:

- production per worked hour;
- production per operator;
- production per chair/resource where applicable;
- contribution margin per hour;
- collection ratio;
- plan acceptance ratio;
- execution conversion from accepted backlog.

## Date attribution rules
Every KPI must declare which date drives the period:

- Preventivato: quote/plan creation date.
- Accettato: acceptance date.
- Prodotto: execution/service date.
- Fatturato: fiscal document issue date.
- Incassato: payment settlement/receipt date.
- Costi: effective economic date or payment date depending on the chosen view.

Poliedra should eventually support two explicit views where useful:

1. `ECONOMIC / COMPETENCE VIEW`
2. `CASH VIEW`

The UI must never combine the two without labeling the result.

## Discounts, refunds, cancellations and partial payments

- Discounts must reduce accepted and produced value consistently.
- Plan-level discounts must be allocated proportionally across service lines unless a line-specific allocation exists.
- Cancelled/unperformed lines must not count as production.
- Refunds must reduce cash and, where appropriate, net revenue with an auditable reversal entry.
- Partial payments reduce credit residual exactly by the amount received.
- Overpayments/credits must be represented explicitly, not hidden by `max(0, ...)` unless the UI is intentionally showing only positive receivables.

## Expenses and recurrence
Recurring costs require a single expansion engine. A recurring expense must produce period occurrences according to start date, end date, frequency and active status. JavaScript must not independently reimplement the SQL recurrence formula.

## Server-side source of truth
Financial formulas must be centralized in versioned SQL/views/RPCs (or a versioned financial service) and tested. Frontend components may format/display results but must not duplicate canonical formulas.

Existing `get_kpi_periodo` and `get_costo_orario` must be either versioned and reconciled to this contract or replaced by versioned equivalents.

## Suggested canonical API
A single period endpoint/RPC should return a typed financial snapshot, for example:

- preventivato
- accettato
- prodotto_netto
- fatturato
- incassato
- credito_residuo
- costi_variabili
- costi_fissi
- margine_contribuzione
- margine_contribuzione_pct
- ebitda_operativo_gestionale
- break_even
- costo_orario_struttura
- produttivita_ora
- collection_rate
- acceptance_rate
- data_quality_status

Detailed drill-down RPCs/views must reconcile exactly to snapshot totals.

## Reconciliation invariant
For every period and tenant:

- dashboard total = drill-down total;
- exported report total = dashboard total;
- CFO AI answer = same canonical snapshot;
- no client component maintains a second financial truth.

## Data-quality layer
Each KPI should carry enough metadata to distinguish:

- complete;
- estimated;
- missing input;
- stale configuration;
- unreconciled external payment;
- anomaly detected.

Poliedra must prefer "dato incompleto" over a precise-looking but unreliable number.

## CFO AI contract
The CFO AI does not invent numbers and does not calculate from raw client state when a canonical KPI exists.

It should:

1. read canonical financial snapshots and drill-downs;
2. identify missing/late data;
3. ask the user for missing operational inputs;
4. detect anomalies versus history/budget;
5. explain why a KPI moved;
6. generate cash/production forecasts;
7. surface overdue receivables and recurring-cost changes;
8. suggest actions, clearly separating facts from recommendations.

Example daily checks:

- services performed with no attributable payment/status update;
- payments not reconciled to patient/client or plan;
- costs due but not registered;
- anomalous drop in production/hour;
- margin compression by service/category;
- receivables ageing;
- missing working-hours/capacity data.

## Tiering
### Standard
- core revenue/cash/cost KPIs;
- simple break-even;
- monthly trend;
- basic alerts.

### Pro
- service/operator/resource marginality;
- forecast;
- budget vs actual;
- receivables ageing;
- CFO AI operational checks.

### Premium
- multi-site consolidation;
- advanced scenarios;
- external payment/banking reconciliation;
- advanced CFO AI;
- benchmarking/internal cohort analytics where legally and contractually allowed.

The financial engine remains one; tiers change visibility, depth and automation, not mathematical definitions.

## Vertical strategy
Core formulas are shared across every vertical. Vertical modules add domain-specific dimensions but cannot redefine core financial terms.

Examples:

- Dental: chair/hour, treatment plan, lab/material cost, clinician productivity.
- Physiotherapy: therapist/hour, session/package, room/equipment utilization.
- Psychology: session utilization, no-show impact, therapist capacity.
- Hair salons: station/operator/hour, treatment/product mix, retail product margin.
- Beauty centers: cabin/operator/hour, package utilization, consumable/product margin.
- Personal training: coach/hour, package/session utilization.
- Medical/polyclinic: professional/resource/hour, specialty/service line contribution.

## Required implementation gates
Before POL-003 can be marked DONE:

1. Inventory all current client and SQL formulas.
2. Map each existing KPI to this canonical contract or explicitly deprecate it.
3. Version authoritative SQL definitions.
4. Add deterministic synthetic financial fixtures.
5. Add regression tests for discounts, partial payments, refunds, cancellations, recurring expenses and date attribution.
6. Prove dashboard-to-drill-down reconciliation.
7. Remove duplicated financial arithmetic from the frontend where canonical server values exist.
8. Run build and database tests in isolation.
9. Validate multi-tenant isolation.
10. Product Owner approves KPI semantics and sample outputs before production migration.

## Explicit non-goals for first implementation
- statutory accounting or tax certification;
- automatic legal/accounting classification without user/accountant validation;
- inventing missing historic data;
- changing fiscal records to make management KPIs reconcile.

Poliedra is initially a management-control source of truth, not a substitute for statutory accounting records.
