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

## POL-002 handoff

- Task ID: POL-002
- Previous agent: CODEX
- Branch: `chore/POL-002-supabase-baseline`
- Objective: capture and compare a verified metadata-only baseline of the production Supabase backend without modifying production.
- Completed work: read mandatory coordination and architecture documents; determined available local and connector access; confirmed the public project reference from repository configuration; stopped before production inventory because no safe metadata-only access is available; documented exact access requirements, repository-only evidence, preliminary finding classifications, and versioning categories.
- Files changed: `docs/coordination/current-task.md`, `docs/coordination/handoffs.md`, `docs/coordination/pol-002-access-audit.md`.
- Database changes: none.
- Tests executed: checked availability of Supabase CLI, `psql`, Git, GitHub CLI, Supabase connector tools, database-related environment-variable names, local project/link metadata, and GitHub repository documentation.
- Test results: Supabase CLI, `psql`, local repository link, credentials, Dashboard/API access, Storage metadata, Edge Function source, and production migration history are unavailable. No secret values were displayed. No production request was made.
- Unresolved issues: every production inventory category remains inaccessible; production/repository drift cannot be classified reliably; core RLS, grants, functions, triggers, Storage, Realtime, Auth and Edge Functions remain unverified; financial RPC definitions are unavailable.
- Risks: target ambiguity until the Product Owner confirms the project reference; accidental over-privilege if future credentials are not metadata-only; secret/PHI exposure through raw dumps; false confidence from repository references; production performance impact if extraction is not reviewed.
- Exact next action: Product Owner supplies or authorizes the access enumerated in `docs/coordination/pol-002-access-audit.md`, names the operator, quarantine location and sanitization reviewers, then explicitly authorizes POL-002 to resume. Do not begin POL-003.
