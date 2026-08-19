# POL-FIS-001 implementation plan

This plan operationalizes the approved design without authorizing product changes. Every phase requires its own current-task record, migration/RLS/tests where applicable, local synthetic verification and Product Owner gate.

## Invariants for every phase

- Active tenant membership and explicit clinical capability are server-enforced.
- Relationships that carry `studio_id` are tenant-safe at database level.
- Finalized clinical records are immutable; corrections are attributable amendments.
- Clinical facts are never inferred from appointment status, AI output or copied prior notes.
- Attachments remain private under POL-002B and use signed URLs.
- Financial widgets consume POL-003/POL-003F canonical outputs only.
- No production schema, backfill, deploy or cutover occurs inside an implementation PR unless separately approved.

## FIS-001B — foundation

After verified metadata capture, define an additive episode-centric schema for episodes, assessments, problems, goals, measurements and session-note drafts/finalization. Include explicit author/finalizer timestamps, stable status constraints, same-tenant composite relationships, indexes, least-privilege grants, active-membership RLS and capability tests. Define a compatibility map for the seven legacy physio tables; do not backfill by assumption.

Gate: two-tenant tests, cross-tenant relationship rejection, role matrix, immutable finalization/amendment, idempotent migration/reset and rollback design.

## FIS-001C — workflow and timeline

Implement concise desktop/mobile session drafts, explicit finalization, controlled amendment, episode timeline and agenda deep links. A visit prompt may open a draft but may not auto-create findings or mark care delivered.

Gate: keyboard/touch usability, no silent copy-forward, authorship/audit assertions and unauthorized-role UI plus database denial.

## FIS-001D — outcomes, reassessment and discharge

Add reusable scale metadata without restricted form content, typed measurements, comparable score rules, reassessment decisions and structured discharge. Comparisons must expose source records and avoid causal claims.

Gate: unit/scale compatibility tests, baseline/previous comparisons, unavailable-state tests and immutable history.

## FIS-001E — collaborator permissions and handoff

Introduce explicit capabilities for administrative access, agenda, clinical read, clinical write, finalization, documents, finance and team management. Map owner/admin, physiotherapist, trainer, massage therapist, rehabilitation collaborator and front desk through studio-controlled assignments rather than job-title string matching. Handoffs carry minimum necessary context and an audit trail.

Gate: complete allow/deny matrix with two studios and multiple users; revoked/inactive membership fails closed.

## FIS-001F — widget pack

Register physio widgets through POL-UI-001 using tenant-safe server selectors. Start with today’s sessions, notes to finalize, reassessments due, active episodes and tasks. Add outcome/goal widgets only when authoritative comparison contracts exist. Reuse canonical finance selectors unchanged.

Gate: per-user layout, mobile/desktop rendering, tenant isolation and static test proving no financial formula duplication.

## FIS-001G — pilot hardening

Complete accessibility and responsive QA, private-attachment flow, audit review, performance/pagination, synthetic end-to-end pathways, incident/rollback runbooks and a pilot checklist. Exercises, patient app and AI/voice remain optional follow-on capabilities unless separately authorized.

## Proposed migration sequence

The exact object names and columns are intentionally deferred until the production metadata comparison is complete. The safe sequence is: authorization/capability foundation; episode/core clinical records; immutable finalization/audit; outcomes/reassessment/discharge; handoffs; compatibility views or explicit migration tooling; then UI cutover. Each migration travels with RLS and tests. No phase may silently modify legacy clinical history.
