# GitHub Copilot entry point

`AGENTS.md` at the repository root is the authoritative agent constitution for every agent,
including GitHub Copilot. Read it first and follow it exactly. This file exists only because
Copilot loads a tool-specific instructions file by convention; it must stay a pointer and
must never restate or fork the rules.

Mandatory before any work:

1. `AGENTS.md`
2. `docs/POLIEDRA_MASTER_CONTEXT.md`
3. `docs/mission/POLIEDRA_MISSION.md`
4. `docs/coordination/current-task.md`
5. relevant documents under `docs/architecture/`, including `docs/architecture/POLIEDRON.md`
   for AI, Chat, activity or notification work
6. latest entries in `docs/coordination/handoffs.md`

Non-negotiable reminders:

- Run the multi-agent pre-flight check in `AGENTS.md` (up-to-date `master`, open PRs, active
  branches, current task and owner, latest handoff, possible collisions).
- Never commit to `master`, `main` or `preview`; work on a dedicated branch from up-to-date
  `master`.
- Never overwrite another agent's work and never force push to a branch you do not own.
- No merge and no production deploy without explicit Product Owner approval.
- Label every factual claim `VERIFIED`, `INFERRED` or `NOT VERIFIABLE`; never claim a test,
  build, browser QA or database verification you did not actually perform.
- Poliedron is a single agent — see `docs/architecture/POLIEDRON.md`.
