# Current task

- TASK: POL-UI-002
- TITLE: Canonical Financial Widgets + Role Presets
- OWNER: CODEX
- BRANCH: `ui/POL-UI-002-canonical-financial-widgets-presets`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Turn the modular Home into a permission-aware workspace with canonical financial widgets, one shared period context and presentation presets for Titolare, Segreteria and Clinico/Fisio. Preserve the POL-UI-001 personalization hierarchy and use only the POL-003/POL-003F snapshot contract for new financial widgets.

## Safety boundaries

- New financial widgets read only `get_financial_snapshot_v1`; they contain no financial formulas and no legacy fallback.
- Active membership, management-control capability and role are evaluated fail closed before the canonical loader is mounted.
- Layout resolution is user override → studio default → role/vertical preset → platform default.
- Fisio clinical selectors remain disabled because an authoritative merged Home contract is not available; no legacy Fisio table is queried by the Home.
- No database migration was added or changed. No production write, remote migration, backfill, deployment or merge occurred.

## Completion state

Implementation and local verification are complete. The canonical widget pack, shared period selector, presets, permission-aware catalog, explicit unavailable states and responsive contracts for 375/768/1024/1440 are implemented. Twenty Node tests, POL-UI-001 migration/RLS regression on an isolated Supabase/PostgreSQL 17 container, database lint and the production build passed. Secret, diff and scope checks passed. The task is waiting for Product Owner review on PR #15.

## Open decisions and residual risks

- The verified membership model exposes `admin` and generic `utente`; until authoritative clinical/front-desk roles exist, non-admin dental users receive the Segreteria preset and non-admin Fisio users receive the Clinico/Fisio preset. This changes presentation only and requires a future Product Owner-approved role model for finer assignment.
- Authoritative worked hours remain unavailable, so Produzione/ora and Incasso/ora show `Non disponibile` when the snapshot lacks a positive denominator.
- No canonical trend series or stable POL-FIS-001 Home selector is consumed.
- Ten pre-existing dependency audit findings remain outside scope (2 moderate, 6 high, 2 critical); existing pdfjs eval and chunk-size build warnings remain.

## Exact next action

Product Owner and Tech Lead review PR #15, validate the permission/preset mapping and decide whether a manual device pass is required. Do not apply migrations remotely, deploy, merge or begin another task without explicit Product Owner approval.
