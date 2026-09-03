# Decisions log

## POL-001-D01 — Repository is project memory
Status: accepted baseline. Agents must rely on versioned documentation and handoffs, not chat history.

## POL-001-D02 — One task owner
Status: accepted. Exactly one agent owns a task; ownership changes only through a recorded handoff.

## POL-001-D03 — No guessed backend
Status: accepted. Missing Supabase production definitions will be captured through Product Owner-approved read-only extraction, never reconstructed by inference.

## POL-001-D04 — Product Owner gates
Status: accepted. Tenancy, RLS, financial semantics, and deployment architecture require explicit Product Owner approval.

## POL-001-D05 — Financial lifecycle
Status: proposed, not accepted. The lifecycle in `financial-domain.md` requires Product Owner validation before implementation.

## POL-GOV-001-D06 — One rule set for all agents
Status: accepted. `AGENTS.md` is the single authoritative agent constitution for GitHub Copilot, Claude Code, Codex, Perplexity and any future contributor. Tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) are thin pointers and must not restate or fork the rules. Only genuine operational capability differences are documented.

## POL-GOV-001-D07 — Multi-agent concurrency safety
Status: accepted. Every agent runs the pre-flight check (up-to-date `master`, open PRs, active branches, current task and owner, latest handoff, collisions) before starting. No agent overwrites another agent's work, force pushes to a branch it does not own, or commits to `master`/`main`/`preview`. `handoffs.md` is append-only and concurrent-append conflicts are resolved by keeping both entries.

## POL-GOV-001-D08 — Truthfulness labels
Status: accepted. Every factual claim in a handoff, PR or report is labelled `VERIFIED`, `INFERRED` or `NOT VERIFIABLE`. Claiming an unexecuted test, build, browser QA or database verification is a rule violation, and code changed is not the same as bug fixed.

## POL-GOV-001-D09 — Poliedron is a single agent
Status: accepted. There is exactly one Poliedron. No second Poliedron, separate Poliedron chatbot, second orchestration layer, second memory, second context engine or parallel AI service. Chat is a persistent interface onto the same agent; notifications are a signal on that conversation, not a second conversational system. Activity states are `pending`/`completed`/`snoozed`/`cancelled` and `read != completed`. Contract: `docs/architecture/POLIEDRON.md`.

Architectural changes must receive dedicated ADR files under `docs/adr/`; this log records coordination decisions only.
