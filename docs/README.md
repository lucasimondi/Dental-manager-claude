# Poliedra Documentation

## Start here

For any substantial task, read in this order:

1. `../AGENTS.md` — mandatory agent operating rules.
2. `POLIEDRA_MASTER_CONTEXT.md` — stable Product Owner vision, architecture, roadmap and cross-project constraints.
3. `coordination/current-task.md` — current operational task, owner, branch and status.
4. Relevant documents under `architecture/` — task-specific technical specifications.
5. Latest entry in `coordination/handoffs.md` — recent agent handoff and exact next action.

## Documentation roles

### `POLIEDRA_MASTER_CONTEXT.md`
Stable product context. It should change only when Product Owner vision, architecture, roadmap or cross-project decisions materially change.

### `coordination/current-task.md`
Operational state for the task being executed now. Do not use it as long-term product memory.

### `coordination/handoffs.md`
Chronological agent-to-agent execution history, including tests, risks, unresolved issues and next action.

### `architecture/`
Technical design, implementation plans, validation notes and task-specific contracts.

## Source-of-truth rule

Do not rely on chat history as project memory. Repository documentation and code are the source of truth. If implementation evidence conflicts with the Master Context and the conflict represents a product decision rather than a technical correction, use `PRODUCT_OWNER_DECISION_REQUIRED`.
