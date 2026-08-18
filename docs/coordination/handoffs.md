# Handoffs

## POL-001 handoff

- Task ID: POL-001
- Previous agent: CODEX
- Branch: `chore/POL-001-repository-source-of-truth`
- Objective: establish repository-based coordination and a safe Supabase source-of-truth capture plan.
- Completed work: documented mandatory agent workflow, audited as-is architecture, tenancy, security, financial logic, verticals, deployment, backlog, quality strategy, local/deploy/rollback/incident runbooks, and read-only Supabase extraction plan.
- Files changed: `AGENTS.md`, `CLAUDE.md`, `README.md`, and documentation under `docs/architecture`, `docs/coordination`, `docs/quality`, `docs/runbooks`, and `docs/adr`.
- Database changes: none.
- Tests executed: repository content review and remote file/branch verification only; no application tests exist and application code was unchanged.
- Test results: documentation commit created on the task branch; no production behavior validation was required.
- Unresolved issues: complete production Supabase schema/RLS/RPC/triggers/grants/Storage/Edge Functions/configuration remain unavailable; financial lifecycle awaits Product Owner validation; hosting authority and operational owners are unconfirmed.
- Risks: production drift, incomplete tenant proof, sensitive-data handling during extraction, unversioned functions/policies, and financial semantic ambiguity.
- Exact next action: Product Owner reviews POL-001, supplies/authorizes the read-only access listed in `docs/runbooks/migrations.md`, identifies the authorized operator and secure artifact location, and approves or revises the proposed POL-002. No agent should start POL-002 before that approval.


## POL-002A handoff

- Task ID: POL-002A
- Previous agent: CODEX
- Branch: `security/POL-002A-critical-hardening`
- Objective: prepare minimal versioned hardening for confirmed Supabase authorization issues without modifying production.
- Completed work: scanned 106 repository files; mapped all client RPC and Storage bucket references; confirmed client-side admin fallback; analyzed GDPR call parameters; classified known RPC candidates; documented missing function/grant/policy metadata; completed patient-files dependency and staged migration analysis; recorded required security test matrix and exact unblock metadata.
- Files changed: `docs/coordination/current-task.md`, `docs/security/pol-002a-hardening-assessment.md`, `docs/architecture/security.md`, `docs/coordination/backlog.md`, `docs/coordination/handoffs.md`.
- Database changes: none; no migration created because authoritative signatures, bodies, grants and dependencies are unavailable.
- Tests executed: complete repository text scan for affected function/table/bucket names; direct review of admin, membership, registration, GDPR and Storage client flows; branch diff verification. No SQL security tests could be run without a reproducible backend baseline.
- Test results: client admin fallback and public patient-files URL dependency confirmed; GDPR caller-controlled executor parameter confirmed; production SQL fixes and grants remain unverifiable and therefore unimplemented.
- Unresolved issues: all production function definitions/ACL, RLS/grants, trigger dependencies, membership bootstrap semantics, GDPR role requirements, Storage policies, and public-flow compatibility are missing.
- Risks: fail-open authorization remains in production; GDPR SECURITY DEFINER tenant authorization remains insufficient; public patient-files may expose PHI; speculative migrations could break public booking/consent or cause GDPR data loss.
- Exact next action: Product Owner provides the sanitized metadata listed in `docs/security/pol-002a-hardening-assessment.md`, confirms allowed GDPR roles and owner bootstrap semantics, and explicitly authorizes POL-002A to resume. Do not merge, deploy or apply a migration.
