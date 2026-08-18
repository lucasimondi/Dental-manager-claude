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

Architectural changes must receive dedicated ADR files under `docs/adr/`; this log records coordination decisions only.
