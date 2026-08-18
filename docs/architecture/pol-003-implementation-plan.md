# POL-003 — Financial Source of Truth: Implementation Plan

Status: design only. No formula changes authorized in production by this document.

## Objective
Replace duplicated/ambiguous financial calculations with one canonical server-side financial engine used by all verticals and by the CFO AI.

## Canonical lifecycle
Revenue/work lifecycle:
`PREVENTIVATO -> ACCETTATO -> ESEGUITO/PRODOTTO -> FATTURATO -> INCASSATO -> CREDITO RESIDUO`

Cost lifecycle:
`PREVISTO -> IMPEGNATO -> SOSTENUTO`

## Canonical metric rules
- Preventivato: gross proposed value before acceptance, net of explicitly stored commercial discount according to the approved pricing contract.
- Accettato: accepted contracted value, independent from execution/cash collection.
- Prodotto: value of services actually delivered in period, recognized by service/execution date.
- Fatturato: accounting invoice value when invoice exists; never substitute production or cash.
- Incassato: cash actually received in period, including external payment sources after reconciliation.
- Credito residuo: collectible accepted/delivered/factured amount minus valid payments/refunds according to the approved recognition model.
- Fixed cost: recurring/period cost not driven by service volume within the relevant operating range.
- Variable cost: cost attributable to delivery volume or individual service/operator.
- Contribution margin: produced revenue minus variable costs attributable to production.
- Operating EBITDA (management view): produced revenue minus variable and operating fixed costs, excluding tax/depreciation/financial items unless separately configured.
- Break-even: fixed operating costs / contribution-margin ratio when mathematically valid.

Do not label a metric EBITDA if the implementation includes/excludes items inconsistently; expose the formula version.

## Required dimensions
Every canonical metric should support, when data exists:
- studio;
- period;
- practitioner/collaborator;
- service/category;
- patient/client;
- vertical;
- acquisition source where available.

## FIN-001 — Inventory and reconciliation map
- version all existing financial RPC definitions;
- map every UI financial calculation and source table;
- identify duplicate JS formulas;
- create `current -> canonical` reconciliation table;
- classify each discrepancy as bug, semantic difference or unresolved Product Owner decision.

No formula changes in this task.

## FIN-002 — Canonical data contract
Define one versioned contract for:
- amount fields and currency;
- discount allocation;
- partial acceptance;
- partial delivery;
- partial payment;
- refunds/chargebacks;
- cancellations;
- credits/write-offs;
- dates used for each lifecycle stage;
- tax/VAT inclusion/exclusion;
- external payments;
- historical cost changes.

## FIN-003 — Canonical server-side engine
Implement server-side views/functions/RPCs as the only authoritative calculation layer.

Requirements:
- deterministic;
- tenant-safe;
- versioned in migrations;
- no caller-controlled studio authorization bypass;
- explainable outputs with formula/version metadata;
- period boundaries explicit and timezone-safe.

## FIN-004 — Core KPI API
Minimum canonical outputs:
- preventivato;
- accettato;
- prodotto;
- fatturato;
- incassato;
- credito residuo;
- costi fissi;
- costi variabili;
- margine di contribuzione;
- operating EBITDA;
- break-even;
- costo orario struttura;
- costo orario operatore;
- produzione/ora;
- incasso/ora;
- collection rate;
- acceptance rate;
- no-show economic impact where definable.

## FIN-005 — UI migration
- replace duplicated client formulas with canonical API outputs;
- visibly distinguish `prodotto`, `fatturato` and `incassato`;
- show formula/data-quality status;
- preserve drill-down to underlying records;
- remove obsolete calculations only after reconciliation tests pass.

## FIN-006 — Cost model
Support:
- recurring fixed costs;
- one-off fixed costs;
- service-level variable materials;
- collaborator compensation models;
- equipment/room allocation as optional management dimensions;
- effective-from/effective-to historical cost validity.

Never rewrite historical results using today's cost unless user explicitly requests a current-cost simulation.

## FIN-007 — Forecast and scenarios
Forecasts must remain separate from actuals.

Inputs may include:
- booked future appointments;
- accepted unfinished plans;
- historical conversion/collection rates;
- configured recurring costs;
- staffing capacity.

Every forecast must expose assumptions and confidence/data-quality warnings.

## FIN-008 — CFO AI contract
The CFO AI can:
- read only canonical KPIs and drill-down data;
- detect missing or stale inputs;
- ask the user for missing costs/data;
- flag anomalies, overdue receivables and margin deterioration;
- explain why a KPI changed;
- produce forecasts/scenarios from explicit assumptions.

The CFO AI must never:
- invent a missing financial number;
- silently change accounting/management semantics;
- write financial source data without explicit user action/approved automation;
- present forecast as actual.

## FIN-009 — Regression test suite
Synthetic scenarios must cover at least:
1. full payment before service;
2. partial payment;
3. discount across multiple service lines;
4. partial execution;
5. cancellation after acceptance;
6. refund;
7. external payment reconciliation;
8. service delivered in one month and paid in another;
9. cost effective-date change;
10. two-studio isolation;
11. multiple practitioners;
12. zero/negative denominator edge cases.

For each scenario assert preventivato/accettato/prodotto/fatturato/incassato/credito/margins.

## FIN-010 — Migration and rollout
- run old and new engine in parallel on synthetic data and, where allowed, metadata-safe/aggregate production comparison;
- produce discrepancy report;
- Product Owner approves semantics;
- switch UI reads only after acceptance thresholds pass;
- retain rollback path;
- no destructive rewrite of source transactions.

## Definition of Done
- one authoritative server-side engine;
- no duplicated KPI business logic in client code;
- versioned formulas and migration history;
- multi-tenant authorization proven;
- synthetic regression suite green;
- production reconciliation signed off;
- every major dashboard number can drill down to source records;
- CFO AI consumes canonical metrics only;
- verticals use the same core formulas.
