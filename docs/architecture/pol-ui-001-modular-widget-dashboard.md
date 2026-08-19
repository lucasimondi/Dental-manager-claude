# POL-UI-001 — Modular Widget Dashboard

Status: PRODUCT_OWNER_APPROVED_DESIGN

## Product principle

Poliedra Home is not a fixed dashboard. It is a modular, responsive widget workspace that can adapt to the user's role, studio, vertical and priorities without creating separate products or separate sources of truth.

## Configuration hierarchy

1. Platform/vertical defines the available widget catalog.
2. Studio owner may define a studio default Home layout.
3. Individual user may personalize their own Home layout when permitted.
4. User layout overrides studio default only for presentation; it never changes business or financial data.

Persist layout per user + studio. Do not store financial formulas or calculated financial values in widget configuration.

## Required capabilities

- add/remove widgets;
- drag-and-drop reorder;
- responsive resize where useful;
- compact/expanded variants for selected widgets;
- reset to studio default;
- responsive mobile stacking using the same widget definitions;
- visibility controlled by permissions, role, vertical and authoritative data availability;
- missing authoritative data is shown as unavailable, never guessed;
- widgets consume canonical domain sources/RPCs rather than reproducing formulas.

## Widget library — initial families

### Financial
- Prodotto
- Incassato
- Preventivato
- Margine / EBITDA when canonical
- Break-even when canonical
- Costi
- Credito clienti / portafoglio when canonical
- Monthly financial trend
- Monthly targets

All financial widgets MUST consume POL-003 canonical financial sources only.

### Organization
- Today's agenda
- Tasks / activities
- Pending confirmations
- Documents to sign
- Payments to follow up
- Recalls / follow-ups
- Recent communications
- Team / collaborator status
- Agenda utilization when authoritative

### Clinical
- Patients requiring reassessment
- Open treatment plans
- Clinical follow-ups
- Clinical alerts
- Missing documents / consents
- Vertical-specific outcome or pathway widgets where supported

### AI / Insight
- CFO AI summary
- Operational AI summary
- Priority actions
- Anomaly / attention signals

AI widgets explain canonical/authoritative data; they do not create an independent source of truth.

## Role-oriented presets

Presets are starting layouts, not separate dashboards.

Examples:
- Owner / director: finance + operations + team;
- Front desk: agenda + confirmations + recalls + payments + tasks;
- Clinician / physiotherapist: agenda + patients + reassessments + treatment plans + outcomes;
- Administrative user: billing + payments + documents + tasks.

## Vertical behavior

The same widget engine is shared across Poliedra verticals. Each vertical can register relevant widgets and presets.

Physiotherapy must support widgets for sessions, reassessments, outcomes, treatment plans and collaborator activity. Future verticals (personal trainer, psychologist, medical professional, nutrition/dietology, massage, hairdresser, beauty center and others) reuse the same engine and register their own domain widgets.

## Mobile-first behavior

Mobile does not have a separate dashboard model. The same configured widgets are rendered responsively:
- one-column stacking by default;
- priority/order preserved;
- large desktop widgets may render a compact mobile variant;
- primary actions remain reachable;
- no horizontal dashboard canvas required for normal use.

## UX

Setup / Home exposes `Personalizza Home`.

Customization flow:
- Add widget
- Categories: Finanza | Agenda | Pazienti/Clienti | Attività | Clinica | Team | Comunicazioni | KPI | AI
- reorder by drag and drop;
- resize where supported;
- hide/remove;
- preview desktop/mobile;
- save;
- reset to default.

## Security and integrity

- Tenant isolation is mandatory.
- Widget availability respects application permissions.
- A hidden widget is not an authorization boundary; backend access remains protected independently.
- No legacy financial fallback inside financial widgets.
- Widget config must contain IDs, layout and display preferences only, never secrets or sensitive record payloads.

## Rollout

Phase 1: architecture + persistence + widget registry + responsive grid + customization shell.
Phase 2: migrate existing Home cards into widgets without changing their data semantics.
Phase 3: canonical financial widgets and organizational widgets.
Phase 4: physiotherapy clinical widgets and role presets.
Phase 5: additional vertical-specific widget packs and optional AI-assisted layout recommendations.

No production implementation, migration, deployment or merge is authorized by this design document alone.