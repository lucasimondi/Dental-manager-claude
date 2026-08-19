# POL-003C — Management Control Experience Modes

Status: IMPLEMENTED_LOCALLY_WAITING_PRODUCT_OWNER

Implementation evidence: `pol-003c-implementation.md` and `pol-003c-local-validation.md`. The legacy dashboards remain active and no production backfill or KPI cutover has occurred.

## Core architectural rule

Poliedra MUST have one canonical financial source of truth and one canonical financial engine. Base and Advanced are presentation/interaction modes only. They MUST NOT implement separate formulas, ledgers, SQL financial logic, or competing sources of truth.

Commercial subscription tier and management-control mode are separate concepts:
- subscription tier determines which product capabilities are licensed;
- management-control mode determines the complexity/depth shown to the user.

The selected mode is configured per studio from Setup and can be changed without migrating or recalculating financial data.

## Setup

Setting: `management_control_mode`

Allowed values:
- `base`
- `advanced`

Future optional value (not in initial implementation): `automatic`.

Default for existing studios during rollout: `base`, unless an existing explicit preference can be proven.

## Base mode

Purpose: owner/professional understands studio performance in under 30 seconds.

Primary KPIs:
- Prodotto
- Incassato
- Costi operativi
- Margine operativo gestionale
- Break-even and distance from break-even
- Costo orario struttura
- Produzione/ora
- Incasso/ora
- month-over-month trend
- monthly target progress

UX requirements:
- simple dashboard;
- plain-language explanations;
- status/attention signals without hiding the underlying numeric value;
- CFO AI summarizes what changed, why it matters, and the highest-value action;
- drill-down remains available where supported by the canonical engine.

Base mode MUST NOT invent simplified financial formulas. It consumes the same canonical metrics as Advanced.

## Advanced mode

Purpose: full operational/financial control for structured studios, multi-operator organizations, and users who want CFO-level depth.

Expose, where canonical data exists:
- Preventivato lordo
- Sconto
- Preventivato netto
- Accettato
- Portafoglio da eseguire
- Prodotto
- Prodotto da fatturare
- Fatturato netto IVA
- IVA
- Fatturato lordo
- Incassato
- Incassato allocato
- Incassi/anticipi non allocati
- Credito clienti
- Costi fissi operativi
- Costi variabili attribuibili
- Margine di contribuzione and %
- EBITDA operativo gestionale
- Break-even
- Ore produttive disponibili
- Ore effettivamente lavorate
- Saturazione/utilizzo where authoritative scheduling data exists
- Produzione/ora
- Incasso/ora
- budget vs actual
- forecast when a defined forecasting model exists
- trends
- drill-down to canonical source records
- reconciliation/anomaly signals
- operator/category/service profitability only when source attribution is authoritative.

## CFO AI behavior

CFO AI MUST read canonical metrics, never reproduce financial formulas independently.

Base mode:
- concise natural-language summary;
- highlight maximum 3 important signals/actions by default;
- avoid accounting jargon unless requested.

Advanced mode:
- explain variances and drivers;
- compare periods/budget where supported;
- surface portfolio, billing gap, receivables, margins and utilization;
- allow deeper drill-down and scenario questions.

## Safety and integrity

- No metric may silently fall back to legacy client-side formulas.
- Missing canonical data is shown as unavailable/incomplete, not guessed.
- Base/Advanced switching changes visibility and UX only, not stored financial events or historical values.
- Tenant isolation and RLS remain mandatory.
- No production backfill or frontend cutover is authorized by this design document.

## Relationship to POL-003B / next implementation

Before controlled financial backfill and UI cutover, implementation must:
1. persist the studio mode safely;
2. build selectors/components that consume canonical financial RPCs;
3. keep legacy dashboards active until reconciliation gates pass;
4. support shadow comparison during rollout;
5. cut over Base first, then Advanced, only after Product Owner review.

## Product direction

A future `automatic` mode may recommend Advanced when enough authoritative data is available (e.g. collaborators, structured costs, hours, budget). It must never change financial semantics and should require explicit user acceptance before changing the visible mode.
