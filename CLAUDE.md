# Claude Code entry point

Claude Code must follow `AGENTS.md` as the authoritative agent constitution.

Before acting, read in order:
1. `AGENTS.md`
2. `docs/POLIEDRA_MASTER_CONTEXT.md`
3. `docs/coordination/current-task.md`
4. Relevant files under `docs/architecture/`
5. Latest handoff in `docs/coordination/handoffs.md`

`docs/POLIEDRA_MASTER_CONTEXT.md` contains stable Product Owner vision, architectural decisions, roadmap and cross-project constraints.

`docs/coordination/current-task.md` contains the current operational task and branch.

Do not infer state from previous Claude sessions or conversation history. Work only on the recorded task and branch. If ownership is assigned to another agent, stop and request an explicit handoff. Product Owner gates in `AGENTS.md` are mandatory.

If implementation would conflict with the Master Context and the conflict cannot be resolved from repository evidence, record `PRODUCT_OWNER_DECISION_REQUIRED` rather than silently overriding Product Owner direction.
