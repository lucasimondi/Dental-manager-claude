# Poliedra agent rules

These rules are mandatory for every coding agent, including Codex, Gemini and Claude Code.

## Required reading order

Before any work:
1. Read `AGENTS.md`.
2. Read `docs/POLIEDRA_MASTER_CONTEXT.md`.
3. Read `docs/coordination/current-task.md`.
4. Read the architecture documents relevant to the task.
5. Read the latest entry in `docs/coordination/handoffs.md`.
6. If the task touches Supabase, schema, migrations, RLS, tenancy or security-sensitive database access, also read:
   - `docs/runbooks/runbook-sviluppo-sicuro.md`
   - `docs/runbooks/runbook-rls-nuove-tabelle.md`
7. If the task touches the Physiotherapy vertical, also read:
   - `docs/verticals/physio/POLIEDRA_PHYSIO_SCHEMA.md`
   - the relevant `docs/architecture/pol-fis-*` documents.

Do not rely on chat history, Claude Projects, Gemini sessions or another provider's memory as project memory. The repository is the source of truth.

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
- If two authorization models conflict, do not choose silently: stop with `PRODUCT_OWNER_DECISION_REQUIRED`.

## Scope discipline

Preserve production behavior unless the task explicitly authorizes a behavior change. Prefer small, reviewable commits. Document assumptions and stop when required facts cannot be obtained without guessing. Schema and security claims require repository evidence or read-only production extraction approved by the Product Owner.

## Completion checklist

Before handoff: inspect the diff, verify scope, run proportionate checks, record exact results, list database and deployment impact, document rollback, update `current-task.md`, and append a complete handoff.
