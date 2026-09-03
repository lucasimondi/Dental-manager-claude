# Poliedra agent rules

These rules are mandatory for every coding agent working on this repository, without
exception: GitHub Copilot, Claude Code, Codex, Perplexity, and any future agent or human
contributor.

This file is the authoritative agent constitution. Agent-specific entry-point files
(`CLAUDE.md`, `.github/copilot-instructions.md`) exist only because some tools load a
tool-specific file by convention. They must stay thin pointers to this file and must never
restate or fork these rules.

## Required reading order

Before any work:
1. Read `AGENTS.md`.
2. Read `docs/POLIEDRA_MASTER_CONTEXT.md`.
3. Read `docs/mission/POLIEDRA_MISSION.md`.
4. Read `docs/coordination/current-task.md`.
5. Read the architecture documents relevant to the task, including
   `docs/architecture/POLIEDRON.md` for any work that touches Poliedron, AI, Chat,
   activities or notifications.
6. Read the latest entries in `docs/coordination/handoffs.md`.

Do not rely on chat history as project memory. The repository is the source of truth.

## Product Master Context

`docs/POLIEDRA_MASTER_CONTEXT.md` contains the stable Product Owner vision, architectural decisions, product roadmap and cross-project constraints.

Do not override it silently. If an implementation requires a conflicting product decision, mark:

`PRODUCT_OWNER_DECISION_REQUIRED`

The Master Context is stable product direction. `docs/coordination/current-task.md` remains the source of truth for the current operational task and branch.

## Multi-agent development

Poliedra is developed concurrently by several agents. All of them are bound by this file;
none of them has private rules that override it.

| Agent | Typical role | Notes |
| --- | --- | --- |
| GitHub Copilot | implementation, targeted fixes, review | reads this file; entry point `.github/copilot-instructions.md` |
| Claude Code | heavy implementation, migrations, frontend, tests | entry point `CLAUDE.md` |
| Codex | review and targeted tasks | reads `AGENTS.md` natively |
| Perplexity | audit, documentation, research, implementation when tools allow | reads this file; no separate rule set |
| ChatGPT | Product Owner assistant: architecture, roadmap, mission definition, review | not a repository writer by default |
| Gemini | may produce code, but every output must be reviewed before acceptance | never authoritative |

Operational capability differs between agents (repository write access, ability to run a
browser, ability to run a database engine, ability to open a PR). Document only the
differences that actually change what an agent may claim or do — see "Truthfulness" below.
Never create a parallel rule set for a single agent.

### Mandatory pre-flight check

Before starting any task, every agent must verify and record:

- `master` is fetched and up to date, and the working branch is based on current `master`;
- open pull requests and their target files;
- active remote branches, especially recent ones;
- the task currently recorded in `docs/coordination/current-task.md` and its owner;
- the latest handoff entries;
- possible collisions: files, migrations, RLS policies, tests or documents already being
  changed by another agent's open PR or active branch.

If a collision exists, do not proceed silently. Either narrow the scope to
collision-free files, or stop and record `PRODUCT_OWNER_DECISION_REQUIRED`.

### Concurrency safety rules

- Never overwrite, revert or "clean up" another agent's work.
- Never force push to a branch you do not own. `--force-with-lease` on your own branch is
  allowed only when the Product Owner has explicitly asked for that realignment.
- Never commit directly to `master`, `main` or `preview`.
- A new task normally starts from up-to-date `master` on a dedicated branch.
- Branch naming: `<type>/<TASK-ID>-<short-slug>` — for example
  `feature/POL-AI-006-chat-persistence`, `docs/POL-GOV-001-governance-consolidation`.
- Do not modify files owned by another agent's open PR unless the task explicitly requires
  it and the collision is recorded.
- `docs/coordination/handoffs.md` is append-only. Add new entries at the end; never edit or
  delete entries written by another agent. When two branches append concurrently, resolve
  the conflict by keeping both entries in chronological order.
- `docs/coordination/current-task.md` records the operational task being executed. When
  several tasks are legitimately in flight in parallel, each entry must carry its own
  TASK, OWNER, BRANCH, BASE and STATUS, and an agent may only rewrite its own entry.

## Ownership and task control

- Exactly one agent owns a task at a time.
- Work only on the task and branch recorded in `current-task.md`.
- Never work directly on `master` or `main`.
- Do not merge without Product Owner approval.
- A handoff transfers ownership only when it is complete and recorded.
- Do not start a backlog task without Product Owner authorization.

Every handoff must record: task ID, previous agent, branch, objective, completed work, files changed, database changes, tests executed, test results, unresolved issues, risks, and exact next action.

## Execution workflow

When the available tools allow it, an agent runs the full loop without stopping midway:

`audit → plan → implementation → test → commit → push → pull request → Product Owner review`

- Do not stop automatically after the plan when the task is sufficiently defined. Continue
  to implementation, tests and PR.
- Stop only for a genuine `PRODUCT_OWNER_DECISION_REQUIRED`, for a blocking collision, or
  when a required fact cannot be obtained without guessing.
- Open the PR as a draft and set the task status to `WAITING_PRODUCT_OWNER`.
- **Never merge without explicit Product Owner authorization.**
- **Never deploy to production without explicit Product Owner authorization.** Vercel is
  the only approved deployment authority; preview builds are not production.
- Never apply remote migrations, backfills or manual production changes without an explicit
  Product Owner gate.

If a tool an agent lacks makes a step impossible (no write access, no browser, no database
engine), the agent must say exactly which capability is missing and deliver the proposed
change instead. It must never simulate a step it could not perform.

## Truthfulness

Never claim:

- a test was executed when it was not;
- browser/visual QA was performed when it was not;
- the database or production state was verified without real access;
- the build is green without having run it;
- a bug is fixed merely because code was changed.

Every factual claim in a handoff, PR or report must carry one of three labels:

- `VERIFIED` — actually executed or directly observed in this session; include the command,
  the environment and the result.
- `INFERRED` — derived from repository evidence or code reading, not executed. Say what the
  inference is based on.
- `NOT VERIFIABLE` — could not be checked with the available tools. Say which capability was
  missing (for example: no production access, no Docker, no browser).

A bug is `fixed` only when there is a reproduction, a corrective change and a `VERIFIED`
check that the reproduction no longer fails. Otherwise it is `change applied, effect NOT
VERIFIED`.

## Poliedron — one agent only

Poliedron is a single agent. This is an architectural invariant, not a preference.

Never create a second Poliedron, a separate Poliedron chatbot, a second orchestration
layer, a second memory, a second context engine or a parallel AI service. New surfaces
(central AI button, Chat, bell, activities, management modules, future automations) are
additional entry points into the same agent and must share its identity, context, memory,
tools and orchestration.

The full contract, including the Chat, activity and notification model, is in
`docs/architecture/POLIEDRON.md`. Any AI, Chat, activity or notification work must comply
with it.

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

Before handoff: inspect the diff, verify scope, run proportionate checks, record exact results with `VERIFIED`/`INFERRED`/`NOT VERIFIABLE` labels, list database and deployment impact, document rollback, update your own entry in `current-task.md`, and append a complete handoff.

Proportionate checks for an application change normally include `npm test`, `npm run build`,
`git diff --check`, a secret-pattern scan over the full diff and a scope check. Migrations
additionally require the migration chain, RLS two-tenant assertions and their tests.
Documentation-only changes require a diff review and a link/reference check; they must not
claim application test results they did not need to run.
