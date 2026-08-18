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

## POL-002B handoff

- Task ID: POL-002B
- Previous agent: CODEX
- Branch: `security/POL-002B-private-patient-files-v2`
- Objective: make clinical files in `patient-files` private while preserving the verified legacy `<patient_id>/<filename>` workflow and enforcing active tenant membership.
- Completed work: replaced the patient-file public URL flow with 300-second signed URLs and fail-closed UI handling; moved the policy helper to the non-exposed `private` schema with least-required privileges; retained tenant-scoped SELECT/INSERT/UPDATE/DELETE policies and bucket privacy cutover; added a synthetic local baseline, SQL assertions and an executable Storage integration test; verified there are no other application `patient-files` public URL call sites.
- Files changed: `src/components/SchedaPaz.jsx`; `supabase/migrations/20260818190000_pol_002b_private_patient_files.sql`; `supabase/tests/pol_002b_private_patient_files.sql`; `supabase/tests/pol_002b_storage_integration.mjs`; `supabase/tests/fixtures/pol_002b_synthetic_baseline.sql`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one migration is prepared but was applied only to a disposable local Supabase/PostgreSQL 17 database. It creates an internal authorization helper, creates four tenant-scoped Storage policies and marks `patient-files` private. No remote or production database, Storage object, configuration or migration history was changed.
- Tests executed: fresh synthetic fixture load; migration with `ON_ERROR_STOP=1`; `supabase/tests/pol_002b_private_patient_files.sql`; `supabase/tests/pol_002b_storage_integration.mjs`; local `supabase db advisors --local`; repository search for `patient-files`/`getPublicUrl`; `npm run build`; `git diff --check`; targeted credential-pattern scan; final scope/status review.
- Test results: migration and SQL assertions passed; all synthetic two-tenant Storage authorization, signed-download and expiry checks passed; advisors found no issues; build passed with existing pdfjs eval and large-chunk warnings; diff check and secret scan passed. The disposable stack was stopped and deleted with `supabase stop --no-backup`.
- Unresolved issues: production cutover sequencing still requires an explicit Product Owner gate; existing production Storage policy interactions must be rechecked immediately before applying the migration; signed URLs remain usable until their five-minute expiry; no audit log, retention policy or tenant-prefixed object-path migration is included; the legacy numeric first segment remains dependent on the patient lookup; dependency audit findings and build warnings remain outside scope.
- Risks: applying the bucket privacy switch without deploying the compatible client in the approved sequence would break previews; rollback by making the bucket public would reintroduce PHI exposure and requires a security/Product Owner gate; stale JWT app metadata remains bounded by the active membership lookup but must still match the patient studio; synthetic coverage cannot replace a staged cutover and post-deploy verification; pre-existing permissive Storage policies could combine with new policies and must be verified before production application.
- Exact next action: Product Owner and Tech Lead review the branch and authorize or reject creation/review of the POL-002B PR and a separately controlled deployment/migration cutover plan. Do not merge, deploy or apply the migration remotely without that approval.

## POL-002B master-alignment handoff

- Task ID: POL-002B
- Previous agent: CODEX
- Branch: `security/POL-002B-private-patient-files-v2`
- Objective: align the completed POL-002B branch with current `master`, incorporating only changes that landed after POL-002B started, then repeat all relevant validation without changing POL-002B scope.
- Completed work: merged current `master` commit `f229e33` (POL-002C) without conflicts; verified the inherited delta is limited to removal of `netlify.toml` and documentation establishing Vercel as sole deployment authority; repeated the full local POL-002B security validation and build; retained `WAITING_PRODUCT_OWNER`.
- Files changed: inherited from `master`: `docs/architecture/deployment.md` and deletion of `netlify.toml`; coordination evidence updated in `docs/coordination/current-task.md` and `docs/coordination/handoffs.md`. No POL-002B application, migration or test implementation file changed during alignment.
- Database changes: none beyond reapplying the already prepared POL-002B migration to a fresh disposable local Supabase/PostgreSQL 17 database. No production or remote database, Storage object, configuration or migration history was changed.
- Tests executed: synthetic baseline load; POL-002B migration with `ON_ERROR_STOP=1`; `supabase/tests/pol_002b_private_patient_files.sql`; `supabase/tests/pol_002b_storage_integration.mjs`; `supabase db advisors --local`; `npm run build`; `git diff --check`; targeted credential-pattern scan; explicit absence check for `netlify.toml`; explicit presence check for `vercel.json`; Vercel deployment-authority documentation check.
- Test results: migration and SQL assertions passed; all synthetic two-tenant Storage checks passed; database advisors found no issues; build passed with the existing pdfjs eval and large-chunk warnings; diff and secret checks passed; `netlify.toml` is absent and Vercel remains the documented sole deployment authority. The disposable stack and volumes were removed with `supabase stop --no-backup`.
- Unresolved issues: all previously documented POL-002B production-cutover, signed-URL expiry, audit/retention, legacy-path and pre-existing Storage-policy risks remain open; no new issue was introduced by the master alignment.
- Risks: deploying the private-bucket migration and compatible client out of sequence could break previews; permissive production Storage policies must be rechecked before cutover; synthetic tests do not replace staged and post-deploy verification. POL-002C deployment architecture was inherited unchanged and was not reimplemented in this task.
- Exact next action: Product Owner and Tech Lead review the updated branch and approve or reject the POL-002B PR/cutover plan. Do not merge, deploy, or apply any remote migration before explicit approval.

## POL-003 handoff

- Task ID: POL-003
- Previous agent: CODEX
- Branch: `design/POL-003-financial-source-of-truth`
- Objective: turn the approved financial source-of-truth design into a versioned, tenant-safe and locally verifiable canonical server-side engine without changing production or selecting unresolved business semantics.
- Completed work: merged current `master` into the task branch; completed FIN-001 across frontend formulas, known tables and verified RPC contracts; documented duplicated, divergent and client-side calculations; prepared an additive event-based financial engine with explicit lifecycle stages, effective-dated costs, hourly inputs, snapshot and drill-down RPCs; added synthetic regression coverage for all requested scenarios; recorded every unresolved semantic as `PRODUCT_OWNER_DECISION_REQUIRED`.
- Files changed: `docs/architecture/pol-003-fin-001-inventory.md`; `docs/architecture/pol-003-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`; `supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql`; `supabase/tests/fixtures/pol_003_synthetic_baseline.sql`; `supabase/tests/pol_003_financial_engine.sql`. The two pre-existing POL-003 design documents remain the governing specification. No application source file was changed.
- Database changes: one additive migration prepared and applied only to a disposable local Supabase/PostgreSQL 17 database. It adds seven canonical v1 event/input tables, tenant-safe composite relationships, indexes, RLS SELECT policies, least-privilege grants, an internal security-invoker allocation view and versioned snapshot/drill-down RPCs. It does not alter legacy financial tables or RPCs. Nothing was applied remotely or in production.
- Tests executed: synthetic fixture; migration with `ON_ERROR_STOP=1`; full `pol_003_financial_engine.sql` transaction; `supabase db lint --local --schema public,private --level warning --fail-on error`; `npm ci --ignore-scripts`; `npm run build`; `git diff --check`; targeted secret scan; final scope and deployment-diff review.
- Test results: migration passed; every requested synthetic lifecycle and margin assertion passed; two-tenant RLS isolation, fail-closed membership, RPC grants, direct-write revocation and drill-down reconciliation passed; database lint reported no schema errors; build passed. Npm retained 10 pre-existing audit findings (2 moderate, 6 high, 2 critical). No production/remote action occurred.
- Unresolved issues: production SQL bodies for `get_kpi_periodo` and `get_costo_orario` are still absent; legacy adapters and old/new reconciliation are blocked by that backend gap and by the FIN-001 Product Owner decisions; no canonical ingestion service exists yet; the frontend intentionally remains on legacy calculations until reconciliation and cutover approval.
- Risks: synthetic tests cannot prove compatibility with unversioned production rows; incorrect selection of quote, credit, VAT, cancellation, refund, payment-allocation, external-reconciliation, cost-taxonomy/date or capacity semantics would materially alter reports; production rollout requires ordered migration, ingestion, parallel reconciliation, UI cutover and rollback gates.
- Exact next action: Product Owner and Tech Lead review FIN-001, the migration contract and local validation; decide or explicitly defer each `PRODUCT_OWNER_DECISION_REQUIRED` item; then authorize a metadata-safe production reconciliation plan and legacy adapter design. Do not apply remotely, deploy, merge or start the next task without explicit approval.

## POL-003A handoff

- Task ID: POL-003A
- Previous agent: CODEX
- Branch: `design/POL-003-financial-source-of-truth`
- Objective: encode the Product Owner-approved financial semantics in the canonical server-side engine and prove them locally without production, deployment or merge actions.
- Completed work: locked net preventivato with gross/discount separation; proportional discount allocation to accepted/produced lines; invoice taxable/VAT/gross separation; distinct portfolio, produced-to-invoice, customer-receivable and unallocated-cash balances; explicit allocation plus deterministic patient-level FIFO; current-period cancellation/refund/credit-note/production-reversal ledgers; reconciled-only external cash; management margin/EBITDA/break-even rules; available versus worked hours; removed quote/credit basis parameters; updated design, inventory and validation documentation.
- Files changed: `docs/architecture/pol-003-financial-source-of-truth.md`; `docs/architecture/pol-003-implementation-plan.md`; `docs/architecture/pol-003-fin-001-inventory.md`; `docs/architecture/pol-003a-product-owner-semantics-lock.md`; `docs/architecture/pol-003-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`; `supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql`; `supabase/tests/pol_003_financial_engine.sql`. No application or deployment file changed.
- Database changes: the unpublished additive POL-003 migration now creates eight tenant-isolated canonical tables, an allocation-integrity trigger, line-value and effective-allocation security-invoker views, and two least-privilege RPCs. Invoice and payment allocation contracts were expanded; no legacy table/RPC was modified and nothing was applied remotely.
- Tests executed: fresh local Supabase/PostgreSQL 17 start; synthetic fixture; migration with `ON_ERROR_STOP=1`; complete POL-003A SQL regression transaction; database lint; local security/performance advisors; `npm run build`; `git diff --check`; targeted secret scan; branch scope review.
- Test results: migration and all synthetic financial/security assertions passed; lint and advisors found no issues; build passed with existing pdfjs eval/large-chunk warnings; diff and secret checks passed; local stack removed. No production, remote migration, deploy or merge action occurred.
- Unresolved issues: unallocated-refund reversal policy, optional stock opening/movement outputs and broader hourly structure-cost category inclusion still require Product Owner decisions; legacy ingestion mapping and old/new reconciliation remain blocked by missing production SQL/backend definitions.
- Risks: automatic FIFO currently applies only to remaining reconciled positive cash, while refund allocation must be explicit; FIFO is patient-scoped and therefore requires a trustworthy patient identity in future adapters; synthetic tests cannot prove compatibility with unversioned production rows; rollout still requires ingestion, parallel reconciliation, UI cutover and rollback gates.
- Exact next action: Product Owner and Tech Lead review the locked semantics, migration and local evidence; answer or explicitly defer the three remaining decisions; then authorize or reject the next reconciliation/adapter step. Do not apply remotely, deploy, merge or start another task without explicit approval.
