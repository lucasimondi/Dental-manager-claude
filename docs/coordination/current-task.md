# Current task

- TASK: POL-UI-001
- TITLE: Modular Widget Dashboard — Phase 1
- OWNER: CODEX
- BRANCH: `ui/POL-UI-001-modular-widget-dashboard`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Complete Phase 1 and close its pre-merge residual risks: touch-first accessible reorder plus tenant-safe studio defaults inherited beneath personal presentation overrides. Existing widget content and business semantics remain unchanged.

## Safety boundaries

- Layout stores presentation metadata only: widget ID, order, visibility and size.
- RLS requires the authenticated row owner and active studio membership.
- No financial formula, widget business logic or data source changes.
- No production migration, remote write, deployment or merge.

## Completion gate

Local PostgreSQL/Supabase tests, Node tests, desktop/mobile UI verification, build, secret scan and diff check must pass. Push only to PR #13 and finish `WAITING_PRODUCT_OWNER`.

## Completion state

Phase 1 and the requested residual-risk closure are complete. Accessible move controls work independently of HTML5 drag/drop; resolution is user override → studio default → platform default; reset removes the override. Node tests, Supabase/PostgreSQL 17 migration/RLS regression, database lint, build, secret/diff/scope checks passed. No production write, remote migration, deploy or merge occurred.
