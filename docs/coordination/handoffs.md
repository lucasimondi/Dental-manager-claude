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
- Completed work: consumed verified Tech Lead metadata; prepared fail-closed admin function, internal tenant/admin guard, GDPR wrappers with trusted executor, targeted function grants, set_updated_at hardening, fail-closed UI gating, synthetic security tests, function access matrix, and patient-files private migration plan.
- Files changed: `src/App.jsx`; `supabase/migrations/20260818143000_pol_002a_critical_security_hardening.sql`; `supabase/tests/pol_002a_critical_security.sql`; coordination/security documentation including verified metadata, assessment, function matrix and patient-files plan.
- Database changes: one migration prepared but not applied. It replaces is_studio_admin, wraps both GDPR RPC, changes explicit EXECUTE grants, and secures set_updated_at search_path. No RLS, Storage, Auth, financial formula or production change.
- Tests executed: repository diff and content verification only. SQL security tests were authored but not run because no local Supabase/psql/isolated fixture environment is available.
- Test results: static scope checks passed; behavioral database results remain pending isolated execution. No production request was made.
- Unresolved issues: full SECURITY DEFINER inventory remains incomplete; test fixture creation must match the future sanitized baseline; patient-files remains public; google_calendar_tokens and super_admins access model remains intentionally unchanged; leaked-password protection remains disabled; Physio tenant-safe FK work is deferred.
- Risks: migration relies on verified function identities and catalog-preserved scalar return types; GDPR business functions remain as renamed internal implementations; admin-only GDPR semantics must be accepted; unexecuted SQL may contain environment-specific incompatibilities.
- Exact next action: Tech Lead reviews migration/test SQL and runs them against a disposable isolated Supabase clone with synthetic fixtures. Product Owner then decides whether to open/approve a PR. Do not merge, deploy or apply remotely.
