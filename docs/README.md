# Poliedra Documentation

## Start here

The reading order for every agent is defined once, in `../AGENTS.md` ("Required reading
order"). It is not duplicated here. Read `../AGENTS.md` first; it is the authoritative agent
constitution for Copilot, Claude Code, Codex, Perplexity and any future contributor.

## Documentation map

Each document has exactly one job. Do not create a new document when one of these already
covers the function, and do not restate content that already lives elsewhere — link to it.

| Document | Role |
| --- | --- |
| `../AGENTS.md` | Mandatory operating rules for all agents: reading order, multi-agent coordination, workflow, truthfulness, Product Owner gates, safety. Single source of truth for process. |
| `../CLAUDE.md`, `../.github/copilot-instructions.md` | Tool-specific entry points only. Thin pointers to `../AGENTS.md`. |
| `POLIEDRA_MASTER_CONTEXT.md` | Stable Product Owner context: vision, architecture, cross-project decisions, roadmap, locks. |
| `mission/POLIEDRA_MISSION.md` | Living product mission and permanent behavioural principles (data quality, proactivity, Poliedron as operational intelligence). |
| `coordination/current-task.md` | Operational state of the task(s) being executed now: task, owner, branch, base, status. Not long-term product memory. |
| `coordination/handoffs.md` | Append-only chronological agent-to-agent execution history: work done, files, tests, risks, next action. |
| `coordination/decisions.md` | Coordination decisions log. Architectural decisions go to `adr/`. |
| `coordination/backlog.md` | Technical backlog derived from audits. Items are not authorized to start by being listed. |
| `architecture/POLIEDRON.md` | Poliedron architectural invariants: one agent, access points, Chat, activities, notifications. |
| `architecture/chat-polyedron.md` | Technical record of the persistent Chat implementation (migration, tables, RLS, UI). |
| `architecture/` (other) | Technical design, implementation plans, validation records and task-specific contracts. |
| `adr/` | One file per material architectural decision. |
| `quality/test-strategy.md` | Test layers and priorities. |
| `runbooks/` | Operational procedures: local development, migrations, deployment, rollback, incident response. |
| `security/` | Security assessments and hardening records. |
| `audits/` | Domain and feature audits. |

## Documentation roles

### `POLIEDRA_MASTER_CONTEXT.md`
Stable product context. It should change only when Product Owner vision, architecture, roadmap or cross-project decisions materially change. It states product direction; it does not restate agent process, which belongs to `../AGENTS.md`.

### `coordination/current-task.md`
Operational state for the task being executed now. Do not use it as long-term product memory. When several tasks are legitimately in flight in parallel, each entry carries its own TASK, OWNER, BRANCH, BASE and STATUS, and an agent may only rewrite its own entry.

### `coordination/handoffs.md`
Chronological agent-to-agent execution history, including tests, risks, unresolved issues and next action. Append-only: add at the end, never edit or delete another agent's entry, and resolve concurrent-append conflicts by keeping both entries in chronological order.

### `architecture/`
Technical design, implementation plans, validation notes and task-specific contracts. Documents named after a task ID (`pol-003*`, `POL-AI-*`, `pol-rbac-*`, …) are per-task records and are intentionally not merged together. `POLIEDRON.md` is different: it holds cross-task invariants.

## Source-of-truth rule

Do not rely on chat history as project memory. Repository documentation and code are the source of truth. If implementation evidence conflicts with the Master Context and the conflict represents a product decision rather than a technical correction, use `PRODUCT_OWNER_DECISION_REQUIRED`.

## Truthfulness in documentation

Every factual claim in a handoff, validation note or report must be labelled `VERIFIED`,
`INFERRED` or `NOT VERIFIABLE`, as defined in `../AGENTS.md`. Documents that record a state
observed at a point in time must say which commit or date they describe, so later readers can
tell current contracts from historical snapshots.
