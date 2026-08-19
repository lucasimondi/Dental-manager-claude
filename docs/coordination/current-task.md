# Current task

- TASK: POL-003C
- TITLE: Management Control Modes
- OWNER: CODEX
- BRANCH: `finance/POL-003C-management-modes`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Persist the per-studio Base/Advanced management-control presentation mode and prepare UI/selectors that consume only POL-003 canonical metrics, without financial backfill or KPI cutover.

## Product Owner authorization

Approved through PR #9 and the explicit POL-003C implementation instruction. Add per-studio Base/Advanced selection and prepare canonical-only UI selectors while keeping every legacy dashboard active. No production backfill, KPI cutover, deploy or remote migration is authorized.

## Required work

1. Add `management_control_mode` to the existing tenant-owned studio settings with allowed values `base` and `advanced`, defaulting existing studios to `base`.
2. Add the selector to Setup and persist it through the existing `studio_info` path.
3. Define Base and Advanced visibility catalogs over the same canonical POL-003 snapshot RPC.
4. Never reproduce a financial formula or silently fall back to legacy tables/calculations.
5. Represent unavailable canonical metrics explicitly as unavailable.
6. Prepare a canonical management component but do not mount it in the live legacy dashboard.
7. Test persistence, tenant isolation, mode switching and absence of financial formula duplication.
8. Run local database tests, application tests/build, secret scan and diff/scope checks.
9. Update the handoff and set `WAITING_PRODUCT_OWNER`.

## Production gate

No production data writes, remote migration, backfill, frontend KPI cutover, legacy RPC replacement, deploy or merge. Base/Advanced may change only presentation and visibility.

## Completion state

The per-studio constrained setting, Setup selector, canonical-only RPC loader, shared Base/Advanced visibility catalogs, dormant canonical UI component and synthetic tests are complete. Legacy dashboards remain mounted. See `pol-003c-implementation.md` and `pol-003c-local-validation.md`.
