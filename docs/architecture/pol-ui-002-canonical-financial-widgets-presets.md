# POL-UI-002 — Canonical Financial Widgets + Role Presets

Status: IMPLEMENTED_LOCALLY_WAITING_PRODUCT_OWNER

## Objective

Turn the POL-UI-001 modular Home into a role-aware operational workspace while keeping one shared widget engine and one financial source of truth.

## Non-negotiable principles

1. Financial widgets consume only POL-003/POL-003F canonical server-side data.
2. No client-side financial formulas and no fallback to legacy KPI RPCs.
3. Missing canonical metrics render as unavailable, never inferred.
4. Presets are presentation starting points, not separate dashboards.
5. User override > studio default > platform/role preset remains presentation-only.
6. All widgets remain tenant-safe and permission-aware.
7. Mobile/tablet/desktop share the same widget definitions and data contracts.

## Phase 1 — Canonical financial widget pack

Register first-class widgets for:
- Preventivato
- Accettato, only when canonical status is available
- Prodotto
- Fatturato, only when canonical status is available
- Incassato
- Credito residuo, only when canonical status is available
- Costi fissi operativi
- Costi variabili
- Margine di contribuzione
- EBITDA gestionale
- Break-even
- Costo orario struttura
- Ore disponibili
- Produzione/ora, only when authoritative worked hours are available
- Incasso/ora, only when authoritative worked hours are available
- Trend mensile canonical, only where the canonical endpoint supports deterministic historical series

Each widget must expose source/version metadata in a developer/debug path but not clutter normal UX.

## Widget UX

Each financial widget supports:
- compact and/or medium/wide size variants where useful;
- clear label and value;
- selected period context;
- delta/trend only when supported by canonical historical data;
- unavailable state with short explanation;
- optional drill-down entry point to the authoritative source records where the canonical contract supports it.

Never display a mathematically derived delta if the comparison period is missing/incomplete.

## Period behavior

Home financial widgets must share a consistent period selector or clearly inherit the Home period context.

Default: current month.

Allow at least:
- current month;
- previous month;
- current year;
- custom supported period if already available without duplicating financial logic.

Changing Home period updates all canonical financial widgets coherently.

## Role presets

### Owner / Titolare
Suggested default:
- Incassato
- Prodotto
- Margine di contribuzione
- EBITDA gestionale
- Break-even
- Costi
- Credito residuo when available
- Agenda oggi
- Attività/promemoria
- Team/collaboratori when available

### Front desk / Segreteria
Suggested default:
- Agenda oggi
- Prossimi appuntamenti
- Attività/promemoria
- Richiami
- Reminder / comunicazioni
- Pagamenti da seguire / scadenze where authoritative and permitted
- Preventivi where permitted

Do not expose clinical content or owner-only financial metrics merely because a widget exists.

### Clinician / Fisioterapista
Suggested default:
- Agenda oggi
- Prossimi pazienti
- Sedute oggi when FIS selector exists
- Rivalutazioni due when FIS selector exists
- Piani terapeutici attivi when FIS selector exists
- Outcome da rivalutare when FIS selector exists
- Attività/promemoria

Financial widgets should be hidden by default unless role/permission allows them.

## Preset resolution

Presets seed presentation only.

Resolution order:
1. personal layout override;
2. studio default layout;
3. role/vertical preset;
4. platform default.

A reset should return to the nearest inherited layout, not persist a duplicate copy.

Do not overwrite an existing user override when the user's role changes. The new inherited preset applies only when no personal or studio layout takes precedence.

## Permissions

The widget catalog must filter availability by authoritative permissions/capabilities, not only by frontend role labels.

A hidden widget is never an authorization mechanism. Backend/RPC/RLS protections remain mandatory.

Financial widgets must not expose aggregate values to roles that are not allowed to read management-control data.

## Physiotherapy integration boundary

POL-UI-002 may register placeholder/contract entries for Fisio widgets but must not invent clinical selectors.

If POL-FIS-001 selectors are not merged/stable, render Fisio widgets only after their authoritative contracts exist. Do not query legacy Fisio tables ad hoc from the Home.

## Responsive behavior

Required widths:
- 375 px
- 768 px
- 1024 px
- 1440 px

Rules:
- mobile: one-column by default;
- tablet: 1–2 columns depending on widget size;
- desktop: existing 12-column system;
- financial values must not overflow;
- labels and period controls remain touch-friendly;
- no horizontal scrolling for normal dashboard use.

## Testing

Required tests:
- canonical source only; no `get_kpi_periodo` fallback in new financial widgets;
- unavailable canonical metric state;
- period propagation;
- owner preset;
- front desk preset;
- clinician/fisio preset;
- personal override > studio default > role preset > platform default;
- role change without overwriting personal layout;
- unauthorized financial widget hidden and backend call not triggered;
- two-tenant isolation;
- 375/768/1024/1440 responsive contracts;
- existing POL-UI-001 personalization still works;
- build, secret scan, diff/scope check.

## Safety

No production migration, deployment or merge is authorized by this design document alone.

If a canonical metric is absent from POL-003/POL-003F, mark it `PRODUCT_OWNER_DECISION_REQUIRED` or unavailable; do not implement a legacy substitute.
