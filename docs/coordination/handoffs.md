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
- Completed work: consumed verified Tech Lead metadata; prepared fail-closed admin function, internal tenant/admin guard, GDPR wrappers with trusted executor, targeted function grants, set_updated_at hardening, fail-closed UI gating, synthetic security tests, function access matrix, and patient-files private migration plan. Added a minimal test-only synthetic baseline, corrected transaction-safe/psql-portable assertions, installed an isolated WSL2 Supabase toolchain, and completed local migration/security/build validation.
- Files changed: `src/App.jsx`; `supabase/migrations/20260818143000_pol_002a_critical_security_hardening.sql`; `supabase/tests/pol_002a_critical_security.sql`; `supabase/tests/fixtures/pol_002a_synthetic_baseline.sql`; coordination/security documentation including verified metadata, assessment, function matrix, patient-files plan and local validation record.
- Database changes: one migration prepared but not applied. It replaces is_studio_admin, wraps both GDPR RPC, changes explicit EXECUTE grants, and secures set_updated_at search_path. No RLS, Storage, Auth, financial formula or production change.
- Tests executed: fresh local Supabase PostgreSQL 17 fixture load; POL-002A migration with `ON_ERROR_STOP=1`; full `pol_002a_critical_security.sql` suite using two synthetic tenants and transaction rollback; `npm ci --ignore-scripts`; `npm run build`; repository diff and secret-pattern review.
- Test results: migration passed; all authorization/security/financial/public-grant/search-path regression assertions passed; synthetic delete rolled back; production build passed. Existing warnings: 10 npm audit findings (2 moderate, 6 high, 2 critical), pdfjs eval warning and large chunks. Disposable database stopped with `--no-backup`; no remote request was made.
- Unresolved issues: full SECURITY DEFINER inventory remains incomplete; compatibility with unversioned production objects is proven only for the verified contracts represented by the test fixture; patient-files remains public; google_calendar_tokens and super_admins access model remains intentionally unchanged; leaked-password protection remains disabled; Physio tenant-safe FK work is deferred.
- Risks: migration relies on verified function identities and catalog-preserved scalar return types; GDPR business functions remain as renamed internal implementations; admin-only GDPR semantics requires Product Owner acceptance; synthetic contract coverage cannot substitute for a sanitized full production baseline; dependency vulnerabilities remain outside scope.
- Exact next action: Product Owner and Tech Lead review the migration, synthetic fixture/test changes and `docs/security/pol-002a-local-validation.md`, then authorize or reject opening/approving a PR. Do not merge, deploy or apply remotely.
