# Current task

- TASK: POL-UI-001
- TITLE: Modular Widget Dashboard — Phase 1
- OWNER: CODEX
- BRANCH: `ui/POL-UI-001-modular-widget-dashboard`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Implement the approved Phase 1 foundation: tenant-safe per-user persistence, widget registry, responsive grid, drag/drop ordering, supported resize, Personalizza Home, add/remove, default reset and desktop/mobile preview. Existing widget content and business semantics must remain unchanged.

## Safety boundaries

- Layout stores presentation metadata only: widget ID, order, visibility and size.
- RLS requires the authenticated row owner and active studio membership.
- No financial formula, widget business logic or data source changes.
- No production migration, remote write, deployment or merge.

## Completion gate

Local PostgreSQL/Supabase tests, Node tests, desktop/mobile UI verification, build, secret scan and diff check must pass. Push only to PR #13 and finish `WAITING_PRODUCT_OWNER`.

## Completion state

Phase 1 implementation and local verification are complete. The only incomplete verification surface is interactive in-app-browser control, blocked by an internal browser runtime trust-path error and recorded in the validation document. Deterministic responsive/UI contract tests, database security tests and the production build pass. No production write, remote migration, deploy or merge occurred.
