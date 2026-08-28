# Poliedra agent rules

These rules are mandatory for every coding agent, including Codex and Claude Code.

## Required reading order

Before any work:
1. Read `AGENTS.md`.
2. Read `docs/POLIEDRA_MASTER_CONTEXT.md`.
3. Read `docs/coordination/current-task.md`.
4. Read the architecture documents relevant to the task.
5. Read the latest entry in `docs/coordination/handoffs.md`.

Do not rely on chat history as project memory. The repository is the source of truth.

## Product Master Context

`docs/POLIEDRA_MASTER_CONTEXT.md` contains the stable Product Owner vision, architectural decisions, product roadmap and cross-project constraints.

Do not override it silently. If an implementation requires a conflicting product decision, mark:

`PRODUCT_OWNER_DECISION_REQUIRED`

The Master Context is stable product direction. `docs/coordination/current-task.md` remains the source of truth for the current operational task and branch.

## Ownership and task control

- Exactly one agent owns a task at a time.
- Work only on the task and branch recorded in `current-task.md`.
- Never work directly on `master` or `main`.
- Do not merge without Product Owner approval.
- A handoff transfers ownership only when it is complete and recorded.
- Do not start a backlog task without Product Owner authorization.

Every handoff must record: task ID, previous agent, branch, objective, completed work, files changed, database changes, tests executed, test results, unresolved issues, risks, and exact next action.

## Golden rollback checkpoints

- Branches under `stable/*` are immutable disaster-recovery checkpoints, not development branches.
- Never commit to, rebase, force-push, delete, rename, or move a `stable/*` branch.
- Never use a `stable/*` branch as the working branch for a task or PR.
- Development must start from the latest authorized `master` unless the Product Owner explicitly authorizes a recovery operation.
- The current Golden Rollback Point is `stable/2026-08-27-full-recovery`, fixed at commit `070b28fd4eae4e2cc397584201d0bb149468fae7`.
- This checkpoint must never be replaced by a newer one. When a later state is manually verified by the Product Owner as stable, create a new `stable/...` checkpoint and preserve all prior checkpoints.
- Before any high-risk change (broad recovery, major UI replacement, schema/security change, or other change with material regression risk), identify and preserve the latest Product-Owner-verified stable state before implementation.
- A rollback to a `stable/*` checkpoint requires explicit Product Owner authorization and must follow `docs/runbooks/rollback.md`.

## Non-negotiable safety rules

- Never expose, print, commit, or copy secrets.
- Never bypass or weaken RLS.
- Never introduce a tenant fallback.
- Never invent database tables, fields, policies, functions, or production state.
- Never modify production manually to compensate for missing migrations.
- Never duplicate financial formulas.
- Never perform unrelated refactoring.
- Never change tenancy, RLS, financial semantics, or deployment architecture without a Product Owner gate.
- Keep each migration, its corresponding RLS, and its tests together.
- Every change must be reversible.
- Treat the publishable Supabase key as public configuration, but never expose service-role keys, database passwords, access tokens, webhook secrets, patient data, or production dumps.
- Do not use production data in tests.
- Fail closed when tenant identity or authorization is missing.

## Scope discipline

Preserve production behavior unless the task explicitly authorizes a behavior change. Prefer small, reviewable commits. Document assumptions and stop when required facts cannot be obtained without guessing. Schema and security claims require repository evidence or read-only production extraction approved by the Product Owner.

## Completion checklist

Before handoff: inspect the diff, verify scope, run proportionate checks, record exact results, list database and deployment impact, document rollback, update `current-task.md`, and append a complete handoff.
