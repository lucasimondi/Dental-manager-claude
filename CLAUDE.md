# Claude Code entry point

`AGENTS.md` is the authoritative agent constitution for every agent, including Claude Code.
Read it first and follow it exactly: required reading order, multi-agent pre-flight check,
concurrency rules, execution workflow, truthfulness labels, Product Owner gates and safety
rules all live there. This file adds nothing that overrides it and deliberately does not
restate it.

Claude Code specifics:

- Do not infer state from previous Claude sessions or conversation history. The repository is
  the only project memory.
- Work only on the task and branch recorded in `docs/coordination/current-task.md`. If
  ownership belongs to another agent, stop and request an explicit handoff.
- Claude Code normally carries the heavy implementation load (migrations, frontend, tests).
  That does not extend its authority: no merge, no production deploy, no remote migration,
  no backfill without explicit Product Owner approval.
- If implementation would conflict with `docs/POLIEDRA_MASTER_CONTEXT.md` and the conflict
  cannot be resolved from repository evidence, record `PRODUCT_OWNER_DECISION_REQUIRED`
  rather than silently overriding Product Owner direction.
- For any AI, Chat, activity or notification work, comply with
  `docs/architecture/POLIEDRON.md`: Poliedron is a single agent.
