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

## POL-003A final-review handoff

- Task ID: POL-003A
- Previous agent: CODEX
- Branch: `design/POL-003-financial-source-of-truth`
- Objective: implement the three final Product Owner decisions submitted in the latest review of PR #6.
- Completed work: prohibited automatic FIFO reversal for unallocated refunds and retained them as signed unallocated cash; added opening, signed period movements and closing outputs plus drill-down modes for all four stock metrics, with unsuffixed headlines equal to closing; narrowed hourly structure cost to fixed operating structure and base-personnel costs while excluding direct variable, depreciation/amortization, interest, tax and extraordinary categories; updated synthetic assertions and documentation.
- Files changed: `supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql`; `supabase/tests/pol_003_financial_engine.sql`; `docs/architecture/pol-003a-product-owner-semantics-lock.md`; `docs/architecture/pol-003-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`. No application or deployment file changed.
- Database changes: the unpublished additive migration expands snapshot/drill-down outputs only; no legacy object is modified. Nothing was applied remotely or in production.
- Tests executed: fresh local Supabase/PostgreSQL 17 fixture and migration; complete SQL regression suite including RLS/two-tenant assertions; database lint; local security/performance advisors; application build; diff check; targeted secret scan; scope review.
- Test results: migration and the complete synthetic suite passed, including unallocated-refund non-allocation, opening-plus-movements-equals-closing for every stock, headline-equals-closing, hourly-cost inclusion/exclusion, RLS and two-tenant isolation; lint found no schema errors; advisors found no issues; build passed with the existing pdfjs eval and large-chunk warnings; diff and secret checks passed. Production, deployment and merge remain untouched.
- Unresolved issues: no POL-003A Product Owner semantic remains unresolved. Legacy ingestion and reconciliation still depend on the missing versioned production backend baseline.
- Risks: snapshot return shape is intentionally expanded and requires coordinated future consumers; FIFO depends on trustworthy patient identity; synthetic validation does not prove legacy production compatibility.
- Exact next action: Product Owner and Tech Lead review the final commit and validation evidence, then authorize or reject the next adapter/reconciliation action. Do not apply remotely, deploy, merge or start another task without explicit approval.

## POL-003B handoff

- Task ID: POL-003B
- Previous agent: CODEX
- Branch: `finance/POL-003B-legacy-adapter-reconciliation`
- Objective: map only evidenced legacy finance records into POL-003A, prepare deterministic idempotent ingestion and produce a no-PHI shadow reconciliation before any cutover.
- Completed work: completed the source inventory/classification; installed a restricted but non-executed adapter definition for safe contracts, lines, produced events and settled positive payments; made unsupported records fail closed with aggregate counters; added a tenant/period read-only shadow query; performed an authorized aggregate-only production observation; documented implementation, variance classes and validation.
- Files changed: `docs/architecture/pol-003b-legacy-source-mapping.md`; `docs/architecture/pol-003b-adapter-implementation.md`; `docs/architecture/pol-003b-shadow-reconciliation.md`; `docs/architecture/pol-003b-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`; `supabase/migrations/20260819104143_pol_003b_legacy_financial_adapter.sql`; `supabase/reconciliation/pol_003b_shadow_reconciliation.sql`; `supabase/tests/pol_003b_local_bootstrap.sql`; `supabase/tests/pol_003b_legacy_adapter.sql`. No application or deployment file changed.
- Database changes: one additive migration is prepared. It creates only `private.run_pol_003b_legacy_adapter_v1(uuid)`, does not invoke it, and revokes execution from API roles and `service_role`. It was applied and executed only in a disposable local PostgreSQL 17 environment with synthetic data. No remote migration or production row/configuration change occurred.
- Tests executed: clean synthetic bootstrap; POL-003A engine migration; POL-003B adapter migration; adapter regression; complete pre-existing POL-003A regression; read-only shadow query; `plpgsql_check`; attempted Supabase CLI lint; read-only production security/performance advisors; application build; targeted secret scan; `git diff --check`; scope/deployment diff review.
- Test results: migrations passed; adapter tests passed for discounts, partial execution/payment, advances/overpayment, cancellation/refund/credit-note/external/cost/operator exclusions, idempotency and two tenants; POL-003A regression passed unchanged; shadow query returned four aggregate rows; static PL/pgSQL check returned zero findings; build, secret scan and diff check passed. Supabase CLI lint could not traverse the WSL-to-Docker Desktop local port, so executable tests plus `plpgsql_check` were used and the tooling limitation is documented. Production advisors still show pre-existing repository-wide security/performance findings; none was introduced or changed by the unapplied adapter.
- Unresolved issues: acceptance history has no event date; fiscal document VAT/gross and legacy `rimborso` semantics remain unresolved; external payments have no reconciliation evidence; current cost/personnel/material/machinery values cannot reconstruct history; appointment duration and current capacity cannot establish worked/available hours; no verified durable operator mapping exists. These block canonical accepted, invoiced, cost, margin/EBITDA and hour backfill.
- Risks: executing the adapter before a reviewed per-tenant dry run would create canonical rows even though the function is idempotent; source JSON ordinality must remain stable; patient identity is required for future FIFO; negative payments, cancelled status and fiscal refunds must not be silently reclassified; aggregate reconciliation cannot expose row-level data-quality defects; synthetic coverage does not prove production backfill safety. Production advisors also retain unrelated pre-existing warnings for RLS policy gaps, executable `SECURITY DEFINER` functions and policy-performance patterns; remediation requires separately scoped security work.
- Exact next action: Product Owner and Tech Lead review the adapter exclusions and the aggregate variance report, decide the remaining fiscal/acceptance/external/cost/hour/operator source semantics or approve explicit deferral, then authorize or reject a separate controlled dry-run/backfill task. Do not run the adapter remotely, deploy, merge, or change frontend KPI reads without that approval.

## POL-003C handoff

- Task ID: POL-003C
- Previous agent: CODEX
- Branch: `finance/POL-003C-management-modes`
- Objective: persist Base/Advanced per studio and prepare both experiences over one canonical POL-003 read path without activating KPI cutover.
- Completed work: added the constrained `management_control_mode` setting and Setup selector; added a canonical snapshot RPC loader, shared metric catalog and visibility-only Base/Advanced selectors; prepared but did not mount a canonical management component; made unsupported metrics explicitly unavailable; documented architecture, rollback and local evidence.
- Files changed: `package.json`; `src/components/Impostazioni.jsx`; `src/components/CanonicalManagementView.jsx`; `src/lib/utils.js`; `src/lib/canonicalFinancialSelectors.js`; `tests/canonicalFinancialSelectors.test.mjs`; `supabase/migrations/20260819112433_pol_003c_management_control_mode.sql`; `supabase/tests/pol_003c_local_bootstrap.sql`; `supabase/tests/pol_003c_management_modes.sql`; `docs/architecture/pol-003c-management-modes.md`; `docs/architecture/pol-003c-implementation.md`; `docs/architecture/pol-003c-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one additive migration adds a non-null constrained `management_control_mode` column to existing `studio_info`, default `base`. It does not change RLS or financial objects. Applied only to a disposable local PostgreSQL 17 database; nothing remote or production was changed.
- Tests executed: clean synthetic bootstrap; migration with `ON_ERROR_STOP=1`; tenant/persistence SQL regression; `npm test`; `npm ci --ignore-scripts`; `npm run build`; targeted secret scan; `git diff --check`; branch scope and legacy-cutover checks.
- Test results: default/persistence/constraint/two-tenant SQL assertions passed; all four selector tests passed; Base and Advanced preserve identical canonical values while changing visibility only; RPC error is fail-closed with no legacy fallback; build passed with existing warnings; secret and diff checks passed. Ten pre-existing npm audit findings remain (2 moderate, 6 high, 2 critical).
- Unresolved issues: canonical snapshot lacks combined operating costs, distance from break-even, trends, target progress, saturation, budget comparison, forecast and authoritative attributed profitability; these stay unavailable. Production migration ordering, reconciliation acceptance, canonical backfill and Base/Advanced cutover remain gated.
- Risks: deploying the Setup code before the column migration would make saves fail; the existing `studio_info` RLS contract relies on signed `app_metadata.studio_id` and was not changed; a future developer could accidentally mount the dormant component before reconciliation; unavailable metrics must never be filled from legacy client formulas.
- Exact next action: Product Owner and Tech Lead review the PR #9 implementation and authorize or reject the ordered migration/reconciliation/cutover plan. Do not apply remotely, deploy, merge, backfill or mount the canonical component without explicit approval.

## POL-003D handoff

- Task ID: POL-003D
- Previous agent: CODEX
- Branch: `finance/POL-003D-controlled-backfill-reconciliation`
- Objective: correct the verified legacy `sconto_tipo='eur'` eligibility mismatch, reconcile the compatible financial targets and prepare—but not execute—a second controlled production backfill attempt.
- Completed work: added the narrow `eur -> FIXED` normalization while preserving fail-closed handling for unknown non-zero types; aligned the versioned shadow query with canonical proportional fixed-discount allocation; added synthetic fixed-euro/produced-line fixtures; proved adapter idempotency and two-tenant isolation; recalculated aggregate production targets read-only; updated architecture and validation evidence.
- Files changed: `supabase/migrations/20260819123457_pol_003d_eur_discount_normalization.sql`; `supabase/reconciliation/pol_003b_shadow_reconciliation.sql`; `supabase/tests/pol_003b_legacy_adapter.sql`; `supabase/tests/fixtures/pol_003d_shadow_synthetic.sql`; `docs/architecture/pol-003b-adapter-implementation.md`; `docs/architecture/pol-003b-legacy-source-mapping.md`; `docs/architecture/pol-003b-shadow-reconciliation.md`; `docs/architecture/pol-003d-controlled-backfill-findings.md`; `docs/architecture/pol-003d-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`. No application or deployment file changed.
- Database changes: one migration replaces only the restricted `private.run_pol_003b_legacy_adapter_v1(uuid)` definition and preserves its `SECURITY INVOKER`, empty search path and revoked API/service-role execution. It was applied only to disposable local PostgreSQL 17. It does not execute the adapter. No remote migration, adapter/backfill, production row/configuration change or deployment occurred.
- Tests executed: POL-003B synthetic bootstrap; POL-003A engine migration; POL-003B adapter migration; POL-003D replacement migration; updated adapter regression; complete POL-003A financial regression; synthetic versioned shadow reconciliation; `plpgsql_check`; Supabase CLI database lint; local security/performance advisors; `npm test`; `npm run build`; `git diff --check`; targeted secret scan; scope/deployment/current-branch review. An aggregate-only production query was separately executed inside a read-only transaction.
- Test results: all migrations and SQL regressions passed; the EUR 30 fixed discount allocated EUR 10/EUR 20 across EUR 100/EUR 200 produced lines; repeat execution inserted zero rows; tenant B did not alter tenant A; local shadow totals matched exactly at EUR 270 Preventivato, EUR 270 Prodotto and EUR 150 Incassato; POL-003A regression passed unchanged; `plpgsql_check` returned zero findings; lint found no schema errors; performance advisors found no issues; security advisors reported only the minimal synthetic fixture's intentionally non-RLS legacy tables and public `plpgsql_check`; four Node tests and production build passed with existing pdfjs/chunk warnings. Diff and secret checks passed. Production read-only evidence recalculated EUR 6,954 Preventivato, EUR 2,181 Prodotto and EUR 5,102 Incassato and reconfirmed zero canonical contracts, lines, line events and payments.
- Unresolved issues: `ACCETTATO` remains blocked by missing acceptance dates; fiscal invoice/VAT/refund semantics, external-payment reconciliation, historical cost versions, actual/available hours and durable operator attribution remain unsupported. The canonical UI remains dormant and legacy dashboards remain active.
- Risks: synthetic validation cannot prove every production row; a future controlled execution must compare all three revised aggregates and roll back on any mismatch; unknown discount encodings must remain fail closed; migration rollback must restore the prior adapter definition; no frontend cutover is safe before approved backfill and reconciliation gates pass. Existing dependency advisories and build warnings remain outside scope.
- Exact next action: Product Owner and Tech Lead review the POL-003D PR, migration, revised aggregate evidence and rollback conditions. If explicitly approved, schedule a separately controlled production migration/backfill attempt with exact provenance cleanup and mandatory reconciliation against EUR 6,954 / EUR 2,181 / EUR 5,102. Do not apply remotely, backfill, deploy, mount the canonical dashboard, merge or start another task without that approval.

## POL-UI-001 Phase 1 handoff

- Task ID: POL-UI-001
- Previous agent: CODEX
- Branch: `ui/POL-UI-001-modular-widget-dashboard`
- Objective: implement the approved Phase 1 modular Home foundation with tenant-safe per-user persistence, registry, responsive grid, customization, add/remove, reorder, resize, reset and desktop/mobile preview without changing existing widget semantics.
- Completed work: replaced local widget-order storage with a normalized registry and Supabase persistence service; created a responsive shared workspace; added native drag/drop and registry-constrained size controls; implemented Personalizza Home with draft/save/cancel, widget catalog, reset and desktop/mobile preview; wrapped the unchanged existing Dashboard widget renderers; added RLS migration, synthetic two-tenant tests and implementation/validation documentation.
- Files changed: `src/components/Dashboard.jsx`; `src/components/WidgetWorkspace.jsx`; `src/components/WidgetWorkspace.css`; `src/lib/homeWidgetRegistry.js`; `src/lib/homeLayoutPersistence.js`; `tests/homeWidgetRegistry.test.mjs`; `supabase/migrations/20260819150436_pol_ui_001_user_home_layouts.sql`; `supabase/tests/pol_ui_001_local_bootstrap.sql`; `supabase/tests/pol_ui_001_user_home_layouts.sql`; `docs/architecture/pol-ui-001-phase-1-implementation.md`; `docs/architecture/pol-ui-001-phase-1-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one additive migration creates `public.user_home_layouts` keyed by studio and user, with JSON array/size constraints, RLS on every operation, active membership check, own-user check and authenticated-only grants. Applied only to disposable local PostgreSQL 17 with synthetic rows; nothing remote changed.
- Tests executed: local bootstrap/migration/RLS SQL regression; Supabase lint and security/performance advisors; `npm test`; `npm run build`; desktop/mobile CSS/DOM contract tests; attempted temporary local browser harness; targeted secret scan; `git diff --check`; application/deployment scope review.
- Test results: own-user persistence and two-tenant/suspended-membership isolation passed; lint had no errors and performance advisor had no issues; security advisor only flagged synthetic bootstrap `studio_users`; 9/9 Node tests passed; build passed with existing warnings; responsive desktop/mobile contract passed. Interactive Browser control was blocked before navigation by the Codex runtime `trusted code path` error; temporary harness removed.
- Unresolved issues: touch-first reordering needs a later accessible control; editable studio-level defaults are not part of this per-user Phase 1; interactive visual regression should be repeated when the Browser runtime is available; production migration/client ordering remains gated.
- Risks: deploying client before the table migration produces a fail-closed persistence error; current schedule of registry changes must preserve stable widget IDs; layout visibility is not authorization; synthetic RLS tests do not replace staged rollout; existing widget semantics remain legacy until their separately approved migration phases.
- Exact next action: Product Owner and Tech Lead review PR #13 and decide whether the browser-runtime limitation requires a manual visual pass before approval. Do not apply the migration remotely, deploy, merge or start Phase 2 without explicit Product Owner approval.

## POL-UI-001 pre-merge residual-risk handoff

- Task ID: POL-UI-001
- Previous agent: CODEX
- Branch: `ui/POL-UI-001-modular-widget-dashboard`
- Objective: close touch-first reorder and studio-default inheritance risks before merge without changing widget semantics.
- Completed work: added accessible 44 px move-up/down controls independent of HTML5 drag/drop; added user → studio → platform resolution; made reset delete the personal override; added an admin-only studio-default action; kept studio and user persistence separate and presentation-only.
- Files changed: `src/components/Dashboard.jsx`; `src/components/WidgetWorkspace.jsx`; `src/components/WidgetWorkspace.css`; `src/lib/homeWidgetRegistry.js`; `src/lib/homeLayoutPersistence.js`; `tests/homeWidgetRegistry.test.mjs`; `supabase/migrations/20260819174435_pol_ui_001_studio_home_layout_default.sql`; `supabase/tests/pol_ui_001_local_bootstrap.sql`; `supabase/tests/pol_ui_001_user_home_layouts.sql`; `docs/architecture/pol-ui-001-phase-1-implementation.md`; `docs/architecture/pol-ui-001-phase-1-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one additive migration creates `studio_home_layouts`, keyed by `studio_id`, with active-member SELECT and active-admin writes. The per-user table is unchanged. Nothing was applied remotely.
- Tests executed: 11 Node tests; clean synthetic migration/RLS regression on Supabase/PostgreSQL `17.6.1.159`; Supabase database lint; production build; targeted secret scan; `git diff --check`; branch/scope/deployment review.
- Test results: Node 11/11 passed; studio default, personal override, reset, platform fallback resolver, two tenants, non-admin and suspended-user checks passed; lint reported no schema errors; build passed with only pre-existing pdfjs eval and chunk-size warnings; secret/diff/scope checks passed.
- Unresolved issues: interactive visual regression remains blocked by the recorded Codex browser trust-path issue; deterministic DOM/CSS contracts cover 375/768 touch behavior but do not replace a later device pass.
- Risks: client deployment must follow both layout migrations; registry IDs must remain stable; layout visibility is presentation, not authorization; synthetic tests do not replace staged rollout.
- Exact next action: Product Owner and Tech Lead review the updated PR #13. Do not apply migrations remotely, deploy, merge or begin another task without explicit approval.

## POL-003F handoff

- Task ID: POL-003F
- Previous agent: CODEX
- Branch: `finance/POL-003F-canonical-costs-hours`
- Objective: add a deterministic tenant-scoped canonical adapter for verified operating costs and available capacity hours, with local regression and aggregate shadow reconciliation, without production execution or KPI cutover.
- Completed work: inventoried verified cost/hour sources and production function semantics; implemented a restricted idempotent adapter for valid fixed/variable expenses, active personnel and configured available hours; kept machinery depreciation and confirmed appointments blocked; added two-tenant synthetic regression and read-only aggregate shadow reconciliation; verified canonical margin, EBITDA, break-even and structure-hour metrics; documented local and compatible production aggregate evidence.
- Files changed: `docs/architecture/pol-003b-legacy-source-mapping.md`; `docs/architecture/pol-003f-source-inventory.md`; `docs/architecture/pol-003f-adapter-implementation.md`; `docs/architecture/pol-003f-shadow-reconciliation.md`; `docs/architecture/pol-003f-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`; `supabase/migrations/20260819144256_pol_003f_canonical_costs_available_hours_adapter.sql`; `supabase/reconciliation/pol_003f_costs_hours_shadow_reconciliation.sql`; `supabase/tests/pol_003f_local_bootstrap.sql`; `supabase/tests/pol_003f_costs_hours_adapter.sql`; `supabase/tests/fixtures/pol_003f_shadow_synthetic.sql`. No application or deployment file changed.
- Database changes: one additive migration creates two private versioned `SECURITY INVOKER` functions with empty search paths and revoked execution for public/API/service roles. Installation never invokes the adapter. It writes only existing canonical cost/hour tables when separately executed. Applied/executed only against disposable local PostgreSQL 17 with synthetic data; nothing remote changed.
- Tests executed: clean synthetic bootstrap; POL-003A/B/D/F migrations; POL-003F regression; POL-003D adapter regression; full POL-003A regression; synthetic shadow reconciliation; `plpgsql_check`; Supabase lint and security/performance advisors; `npm ci --ignore-scripts`; `npm test`; `npm run build`; targeted secret scan; `git diff --check`; scope and deployment diff review.
- Test results: all migration and SQL regressions passed; idempotency and two-tenant isolation passed; exact shadow metrics matched; canonical fixed/variable costs, contribution margin, EBITDA, break-even, available hours and structure hourly cost passed; worked-hour metrics remained unavailable; static PL/pgSQL check and lint had zero findings; performance advisor had no issues; security advisor findings were limited to deliberately minimal synthetic bootstrap objects; 4/4 Node tests and build passed. Ten pre-existing npm audit findings remain.
- Unresolved issues: personnel and schedule sources are not effective-dated/versioned; variable expense classification is not record-attributable to a service/patient; no authoritative worked-hours source exists; unknown recurrence values fail closed; production execution/rollback requires a separately approved controlled runbook.
- Risks: current source values cannot reconstruct historical changes; running for overlapping ranges is idempotent but uses current personnel/config state; production backfill before review could make canonical trends misleading; provenance cleanup must target exact source rows; synthetic tests cannot prove all production data shapes.
- Exact next action: Product Owner and Tech Lead review PR #12, the compatible targets and blocked-source counts. If approved, define a separate controlled production dry-run/backfill task with preflight, read-only reconciliation, exact rollback and post-run gates. Do not apply remotely, backfill, deploy, merge or start another task without explicit approval.

## POL-003F corrective handoff

- Task ID: POL-003F
- Previous agent: CODEX
- Branch: `finance/POL-003F-canonical-costs-hours`
- Objective: remove retroactive projection of `personale.costo_mensile`, introduce authoritative temporal personnel-cost evidence, and prove that historical canonical costs and KPIs remain immutable.
- Completed work: added append-only effective-dated personnel cost versions; replaced the restricted adapter so it reads only those versions and never the mutable current-cost field; made uncovered active personnel-months fail closed through `personnel_skipped`; updated shadow reconciliation, source inventory and adapter contract; preserved all expense, available-hour, machinery and worked-hour semantics; verified history immutability and unknown-history behavior locally.
- Files changed: `docs/architecture/pol-003f-adapter-implementation.md`; `docs/architecture/pol-003f-local-validation.md`; `docs/architecture/pol-003f-shadow-reconciliation.md`; `docs/architecture/pol-003f-source-inventory.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`; `supabase/migrations/20260819152445_pol_003f_personnel_cost_history_fix.sql`; `supabase/reconciliation/pol_003f_costs_hours_shadow_reconciliation.sql`; `supabase/tests/fixtures/pol_003f_shadow_synthetic.sql`; `supabase/tests/pol_003f_costs_hours_adapter.sql`. No application or deployment file changed.
- Database changes: one additive, unapplied migration creates `financial_personnel_cost_versions_v1` with tenant RLS, least-privilege grants and append-only enforcement, then replaces only the private POL-003F adapter definition. It was applied exclusively to disposable local Supabase/PostgreSQL 17 with synthetic data. No production or remote database/configuration was read or changed during the correction.
- Tests executed: POL-003A/B/D/F migration chain; POL-003F regression; POL-003D regression; POL-003A regression in its isolated base-engine database; synthetic shadow reconciliation; `plpgsql_check`; Supabase database lint; `npm ci --ignore-scripts`; `npm test`; `npm run build`; `git diff --check`; targeted secret scan; branch/scope/deployment review.
- Test results: POL-003F and POL-003D passed in the combined stack; POL-003A passed unchanged in its original eight-policy stack; two-tenant, idempotency, zero-denominator and fail-closed paths passed. January-March remained EUR 1,500/month and April EUR 1,800 after legacy current cost changed to EUR 2,000; the historical total remained EUR 6,300 and the unknown collaborator remained unavailable. Shadow exact metrics matched; both PL/pgSQL functions had zero findings; database lint had no schema errors; 4/4 Node tests and build passed. Ten pre-existing npm audit findings and existing pdfjs/chunk warnings remain.
- Unresolved issues: production has no task-approved authoritative personnel cost-version history; no workflow yet appends future versions when compensation changes; schedule configuration remains non-effective-dated; attributable variable-cost evidence and authoritative worked hours remain unavailable; unknown recurrence values still fail closed.
- Risks: inventing an initial historical `valid_from` would silently falsify past KPIs; deploying the replacement before an approved version-capture workflow would leave personnel costs unavailable by design; synthetic validation cannot prove every legacy production shape; any future production execution requires ordered migration, aggregate preflight, exact provenance rollback and Product Owner approval.
- Exact next action: Product Owner and Tech Lead review the corrected PR #12 and approve or reject the temporal contract. If approved, define a separate controlled plan for authoritative first-version capture and future version writes before any remote migration or cost/hour backfill. Do not apply remotely, backfill, deploy or merge under POL-003F.

## POL-UI-001 master realignment handoff

- Task ID: POL-UI-001
- Previous agent: CODEX
- Branch: `ui/POL-UI-001-modular-widget-dashboard`
- Objective: realign PR #13 with current `master` after POL-003F while preserving both workstreams and all coordination history.
- Completed work: merged `master` commit `c01564c`; resolved only `current-task.md` and `handoffs.md`; kept POL-UI-001 as the active task; retained both POL-UI-001 handoffs and both POL-003F handoffs; verified the POL-003F files match master and the PR delta remains scoped to POL-UI-001.
- Files changed: merge integration includes the POL-003F files already present on master; conflict resolution changes only `docs/coordination/current-task.md` and `docs/coordination/handoffs.md`. No new application behavior was introduced during realignment.
- Database changes: no new migration was authored. Existing POL-UI-001 migrations were reapplied only to disposable local Supabase/PostgreSQL 17 with synthetic data. No remote or production database change occurred.
- Tests executed: POL-UI-001 local bootstrap, both layout migrations and RLS regression; Supabase database lint; 11 Node tests; production build; targeted secret scan; `git diff --check`; final master-delta, deployment and scope review.
- Test results: migration/RLS passed for user override, studio default, reset, two tenants, non-admin and suspended user; lint reported no schema errors; Node 11/11 passed; build passed with existing pdfjs eval and chunk-size warnings; secret/diff/scope checks passed.
- Unresolved issues: interactive device visual regression remains desirable when the recorded browser trust-path issue is resolved; no production rollout has been authorized.
- Risks: both POL-UI layout migrations must precede client rollout; registry IDs must remain stable; layout visibility is not authorization; synthetic tests do not replace staged rollout.
- Exact next action: Product Owner and Tech Lead review the now-realigned PR #13. Do not apply migrations remotely, deploy, merge or begin another task without explicit approval.

## POL-UI-002 implementation handoff

- Task ID: POL-UI-002
- Previous agent: CODEX
- Branch: `ui/POL-UI-002-canonical-financial-widgets-presets`
- Objective: implement canonical financial Home widgets, a shared period context, role/vertical presets and permission-aware catalog while preserving POL-UI-001 personalization and a single POL-003/POL-003F financial source of truth.
- Completed work: registered the canonical widget pack; added direct-field selectors over one `get_financial_snapshot_v1` request; added current month/previous month/current year propagation; implemented Titolare, Segreteria and Clinico/Fisio presets; added user → studio → role/vertical → platform resolution; prevented role changes from replacing overrides; filtered catalog/rendering by active membership and management-control capability; ensured unauthorized users cause zero financial snapshot and legacy financial hook calls; removed ad-hoc Home reads of legacy Fisio tables; added unavailable states and responsive 375/768/1024/1440 contracts.
- Files changed: `src/App.jsx`; `src/components/Dashboard.jsx`; `src/components/WidgetWorkspace.css`; `src/components/CanonicalFinancialWidget.jsx`; `src/components/CanonicalFinancialWidget.css`; `src/lib/homeDashboardModel.js`; `src/lib/homeFinancialWidgets.js`; `src/lib/homeLayoutPersistence.js`; `src/lib/homeWidgetRegistry.js`; `src/lib/useControlloDati.js`; `tests/homeFinancialWidgets.test.mjs`; `tests/homeWidgetRegistry.test.mjs`; `docs/architecture/pol-ui-002-canonical-financial-widgets-presets.md`; `docs/architecture/pol-ui-002-implementation-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. The existing POL-UI-001 migrations were applied only to a new loopback-only disposable Supabase/PostgreSQL `17.6.1.159` container with synthetic identities/layouts. No remote or production database was read or changed.
- Tests executed: 20 Node tests; POL-UI-001 bootstrap, both existing layout migrations and complete RLS regression; Supabase database lint; Vite production build from an isolated Linux temporary directory; targeted secret scan; `git diff --check`; changed-file, migration and deployment scope review.
- Test results: Node 20/20 passed; canonical-only/no-fallback, shared period, three presets, full precedence, role-change preservation, zero unauthorized calls, two-tenant permission behavior, explicit unavailable states, responsive widths and POL-UI-001 regression passed. Local RLS passed for studio/user separation, two tenants, non-admin and suspended users. Database lint found no schema errors. Build passed with only existing pdfjs eval and chunk-size warnings. Secret/diff/scope checks passed.
- Unresolved issues: authoritative membership currently distinguishes only `admin` and generic `utente`, so finer front-desk versus clinician assignment is unavailable; authoritative worked hours, canonical trend series and stable Fisio Home selectors remain unavailable; no interactive physical-device pass was performed.
- Risks: frontend visibility is not authorization and the canonical RPC/RLS remains the authoritative boundary; a richer role model requires Product Owner approval and tenant-safe DB changes; existing user/studio overrides can contain hidden widget IDs but permission filtering prevents rendering/calls; ten pre-existing dependency audit findings remain (2 moderate, 6 high, 2 critical).
- Exact next action: Product Owner and Tech Lead review PR #15, validate the preset/permission mapping and decide whether a manual device pass is required. Do not modify production, apply remote migrations, deploy, merge or begin another task without explicit approval.

## POL-RBAC-001 authoritative capabilities handoff

- Task ID: POL-RBAC-001
- Previous agent: CODEX
- Branch: `security/POL-RBAC-001-authoritative-capabilities`
- Objective: extend legacy `admin`/`utente` membership with authoritative tenant-scoped capabilities; enforce the approved Fisio responsibility matrix in RLS; align POL-UI-002 presets and widget access with server capabilities only.
- Completed work: created an additive explicit capability assignment table and server-side effective-capability RPC; preserved active admin as owner/management without clinical inference; added admin-only assignment UI; removed role/vertical preset inference; made financial access depend on `finance.management.read`; split Fisio full versus operational UX; replaced broad Fisio tenant policies with capability, active-membership, relationship and author checks; added server-enforced activity authorship and RLS indexes.
- Files changed: `supabase/migrations/20260819200029_pol_rbac_001_authoritative_capabilities.sql`; `supabase/tests/pol_rbac_001_local_bootstrap.sql`; `supabase/tests/pol_rbac_001_authoritative_capabilities.sql`; `src/App.jsx`; `src/components/Dashboard.jsx`; `src/components/GestioneUtenti.jsx`; `src/components/Impostazioni.jsx`; `src/components/Pazienti.jsx`; `src/components/PhysioCartella.jsx`; `src/components/SchedaPaz.jsx`; `src/lib/homeDashboardModel.js`; `tests/homeFinancialWidgets.test.mjs`; `tests/rbacCapabilities.test.mjs`; `docs/architecture/pol-rbac-001-authoritative-capabilities.md`; `docs/architecture/pol-rbac-001-local-validation.md`; `docs/architecture/pol-ui-002-canonical-financial-widgets-presets.md`; `docs/architecture/pol-ui-002-implementation-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one unapplied additive migration creates `studio_user_capabilities`, three capability/membership helper functions, one tenant relationship helper, one author trigger function/two triggers, explicit grants, indexes and replacement policies for seven existing Fisio tables. It inserts no assignments and modifies no production data. Applied only to disposable local PostgreSQL 17 with synthetic data.
- Tests executed: clean synthetic bootstrap; existing Fisio schema; POL-RBAC-001 migration; complete SQL regression; Supabase database lint; original 20 POL-UI-002 Node tests; 6 new RBAC Node tests; lockfile-based Vite production build; targeted secret scan; `git diff --check`; migration/deployment/scope review.
- Test results: SQL passed for two tenants, suspended user, multi-role, negative self-escalation, cross-tenant relationship rejection, owner non-clinical, front desk, general clinician without inferred Fisio rights, physiotherapist, PT and massage therapist. PT/massage plan changes returned no rows, evaluation reads returned none and own diary authorship was server-forced. Node 26/26 passed. Database lint found no schema errors. Build passed with existing pdfjs/chunk warnings. Secret/diff/scope checks passed.
- Unresolved issues: `clinical.general` has no Fisio rights and awaits future vertical-specific contracts; production capability assignments and ordered rollout are not prepared or authorized; legacy `studio_users` policy behavior remains a production prerequisite; no manual physical-device pass was performed.
- Risks: client-before-migration fails closed because the RPC/table are absent; migration-before-explicit assignment leaves legacy non-admin users with no preset/clinical access by design; incorrect manual assignments could grant sensitive access, so only tenant admin RLS and explicit PO-reviewed rollout are acceptable; rollback must restore prior Fisio policies before removing capability objects.
- Exact next action: Product Owner and Tech Lead review the stacked POL-RBAC-001 PR, capability matrix, migration and rollout ordering. Do not apply remotely, deploy, merge this branch into POL-UI-002, or merge PR #15 without explicit Product Owner approval.

## POL-RBAC-001A patient/care assignment handoff

- Task ID: POL-RBAC-001A
- Previous agent: CLAUDE (new follow-up task; POL-RBAC-001 itself, owned by CODEX, stays `WAITING_PRODUCT_OWNER` and untouched in ownership terms — this is an additive continuation on the same branch/PR #16, opened directly by the Product Owner directive that started this session)
- Branch: `security/POL-RBAC-001-authoritative-capabilities` (PR #16, still stacked on PR #15; POL-UI-002 preserved intact, no rebase)
- Objective: close the residual risk the Product Owner flagged in POL-RBAC-001 — `clinical.personal_trainer`/`clinical.massage_therapist` capability alone granted tenant-wide Fisio patient access. Separate CAPABILITY from ASSIGNMENT; require an active per-patient assignment for PT/massage_therapist; leave physiotherapist's already-approved tenant-wide access unchanged; add a minimal "Team del percorso" UI.
- Completed work: added `patient_care_assignments` (studio/patient/nullable episode/user/type/active/audit fields) with tenant-safety, author-enforcement and immutability trigger, and RLS (admin-or-physiotherapist manage, target capability+membership eligibility check, no DELETE grant, history preserved on termination); redefined `physio_patient_in_studio_v1` in place so every existing caller becomes assignment-aware for PT/massage_therapist while staying tenant-wide for physiotherapist; re-scoped the three Fisio READ policies that granted tenant-wide access on capability alone (`physio_piani_read`, `physio_obiettivi_read`, `physio_prescrizioni_read`) to patient level; added server-enforced authorship to `physio_esecuzioni` (previously had no `created_by` and no PT/massage_therapist access at all) with matching assignment-gated policies; extended `studio_user_capabilities` SELECT so a physiotherapist can browse teammate capabilities for the assignment picker; added a "Team del percorso" section + assign/terminate modal to `PhysioCartella.jsx`, gated client-side by capability only (never by assignment or patient count) for UX, with RLS as the authoritative boundary; threaded `currentUserId`/`isStudioAdmin` through `App.jsx` → `Pazienti.jsx`/`SchedaPaz.jsx` → `PhysioCartella.jsx`. POL-FIS-001 (PR #14) is not merged/stable relative to this branch (older base, removes files this branch depends on), so `episode_id` is a nullable, isolated adapter onto the existing `physio_piani` table, not a dependency on POL-FIS-001 — documented for future convergence.
- Files changed: `supabase/migrations/20260819210000_pol_rbac_001a_patient_care_assignment.sql`; `supabase/tests/pol_rbac_001a_local_bootstrap.sql`; `supabase/tests/pol_rbac_001a_patient_care_assignment.sql`; `supabase/tests/pol_rbac_001_authoritative_capabilities.sql` (updated fixtures for the new assignment-gated contract); `src/App.jsx`; `src/components/Pazienti.jsx`; `src/components/SchedaPaz.jsx`; `src/components/PhysioCartella.jsx`; `tests/rbacCapabilities.test.mjs`; `docs/architecture/pol-rbac-001a-patient-care-assignment.md`; `docs/architecture/pol-rbac-001a-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: one unapplied additive migration stacked after POL-RBAC-001's — creates `patient_care_assignments`, four helper functions, one trigger, indexes (including two partial-unique constraints), and replacement/extended policies for `physio_piani`/`physio_obiettivi`/`physio_prescrizioni`/`physio_esecuzioni`/`studio_user_capabilities`. Adds one column (`created_by`) to `physio_esecuzioni`. Inserts no assignments and modifies no production data. Applied only to a disposable local PostgreSQL 16 database with synthetic data (Docker was unavailable in this sandbox; Postgres 17 via Docker was not used, but nothing in this migration is version-specific).
- Tests executed: clean synthetic bootstrap (extended with a second patient and two additional synthetic users); existing Fisio schema; POL-RBAC-001 migration; POL-RBAC-001A migration; updated POL-RBAC-001 regression; full new POL-RBAC-001A regression; `npm test`; `npm run build`; ad hoc RLS/policy sanity query; targeted secret scan; `git diff --check`; scope review.
- Test results: POL-UI-002 20/20 and POL-RBAC-001 6/6 (updated fixtures) passed. POL-RBAC-001A: PT1/Massage1 correctly scoped to their own assigned patient and denied on the other; unassigned PT2 and front desk/non-clinical-owner have zero clinical access; physiotherapist keeps unrestricted tenant-wide access (contract preserved); multi-role capability alone grants nothing without a matching assignment; cross-tenant access denied; suspended membership denies access even with capability+assignment; revocation is immediately effective and records `ended_by`/`ended_at`; author spoofing corrected server-side on both `physio_esecuzioni` and the assignment table itself; front desk/PT cannot manage assignments, target-eligibility and cross-tenant assignment attempts rejected, duplicate `responsible_physiotherapist` rejected by unique index, identity fields immutable, no DELETE path. Node 30/30 passed. Build passed with only pre-existing warnings. Secret/diff checks passed.
- Unresolved issues: Docker-based Supabase lint/advisors/`plpgsql_check` could not be run in this sandbox (no Docker daemon) — recommend running them before merge if available. `episode_id`/POL-FIS-001 convergence is `PRODUCT_OWNER_DECISION_REQUIRED`. Team-roster visibility for an assigned PT/massage therapist (sees the *active* roster of any patient they are themselves actively assigned to, not just their own row — see follow-up entry below) is a judgment call beyond the mission's literal text — flagged for Product Owner review.
- Risks: rolling back only part of this migration (e.g. the table but not the tightened Fisio read policies) leaves PT/massage_therapist with zero patients rather than fail-open — safe, but breaks the feature; a full rollback must restore POL-RBAC-001's prior policies/function definitions before removing POL-RBAC-001A's objects, in the order documented in `pol-rbac-001a-patient-care-assignment.md`.
- Exact next action: Product Owner and Tech Lead review the stacked POL-RBAC-001 + POL-RBAC-001A commits together on PR #16, in particular the `episode_id` adapter decision and the team-visibility judgment call. Do not apply remotely, deploy, merge POL-RBAC-001A/POL-RBAC-001, or merge PR #15/#16 without explicit Product Owner approval.

## POL-RBAC-001A post-push hardening follow-up

- Task ID: POL-RBAC-001A (continuation, same session)
- Previous agent: CLAUDE
- Branch: `security/POL-RBAC-001-authoritative-capabilities` (PR #16, unchanged base)
- Objective: after the initial POL-RBAC-001A push, run independent self-review passes before Product Owner review lands, and close the "no manual UI pass" gap without touching production.
- Completed work: (1) a medium-effort code-review pass found `studio_user_capabilities_select`'s physiotherapist extension exposed every capability row in the studio (finance/admin/front-desk included, not just clinical ones) — narrowed to `capability LIKE 'clinical.%'`, with a negative regression assertion. (2) A dedicated security-review pass (background sub-agent, scoped to only the POL-RBAC-001A diff) found `patient_care_assignments_select`'s "shared patient" branch checked the *caller's* active assignment but never filtered the *row being read* by `active`, letting any teammate with an active assignment to a patient read every historical row for that patient — including another professional's ended assignment, its free-text `reason`, and `ended_by`/`ended_at` — beyond the policy's own documented "active roster" intent. Fixed by requiring the read row's own `active` flag in that branch; added a regression assertion (an active teammate cannot see another professional's just-ended row) confirmed to fail without the fix and pass with it. (3) Verified the "Team del percorso"/"Gestisci team"/"Assegna professionista" UI at 375/768/1024/1440px: the live app cannot be run in this sandbox without connecting to the real Supabase project hardcoded in `src/lib/supabase.js`, which the task's "no production access" rule forbids, so the shipped component's exact inline styles were reproduced as static markup and screenshotted headlessly with the sandbox's pre-installed Chromium — confirmed single-column stacking with ≥40px touch targets at 375px, a 2-3 column roster grid with no overflow at 768/1024/1440px, and the shared `Modal` behaving as a full-width bottom sheet on mobile / centered 480px-capped sheet on desktop at every width, with no horizontal scroll.
- Files changed: `supabase/migrations/20260819210000_pol_rbac_001a_patient_care_assignment.sql`; `supabase/tests/pol_rbac_001a_patient_care_assignment.sql`; `docs/architecture/pol-rbac-001a-patient-care-assignment.md`; `docs/architecture/pol-rbac-001a-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: same migration file amended in place (still unapplied anywhere but the disposable local database) — one policy narrowed (`studio_user_capabilities_select`), one policy tightened (`patient_care_assignments_select`). No new objects, no production/remote change.
- Tests executed: full local chain re-run after each fix (synthetic bootstrap → Fisio schema → POL-RBAC-001 → POL-RBAC-001A → both bootstrapped extensions → both regression files); `npm test`; `npm run build`; `git diff --check`.
- Test results: all SQL regression green after each fix, including the two new negative assertions; Node 30/30 (unchanged, no frontend touched in this follow-up); build clean.
- Unresolved issues: unchanged from the prior entry (Docker toolchain, `episode_id` convergence, team-visibility judgment call) — none introduced by this follow-up. The responsive check above is markup-level, not a live end-to-end app session (no auth, no real data).
- Risks: none new. Both fixes narrow existing policies (strictly more restrictive), so they cannot have widened access anywhere; re-validated by full regression.
- Exact next action: unchanged — Product Owner and Tech Lead review PR #16 at its current head. Do not apply remotely, deploy, merge, or begin another task without explicit Product Owner approval.

## POL-RBAC-001A PostgreSQL 17 final validation

- Task ID: POL-RBAC-001A (continuation, same session)
- Previous agent: CLAUDE
- Branch: `security/POL-RBAC-001-authoritative-capabilities` (PR #16, unchanged base)
- Objective: Product Owner instruction — PostgreSQL 16 is preliminary development only; re-run the complete required checklist against PostgreSQL 17/a Supabase-local-equivalent environment before treating `WAITING_PRODUCT_OWNER` as backed by final validation, with the report clearly distinguishing the two engines.
- Completed work: confirmed Docker and `apt.postgresql.org` are both denied by this sandbox's network policy (concrete 403s from the egress proxy against three independent hosts: PGDG apt, the Supabase Docker image's ECR/CloudFront blob storage, and plain Docker Hub's blob storage — `dockerd` itself started fine and image manifests resolved, only blob downloads were blocked, so this is a policy denial, not a transient failure). Obtained a genuine PostgreSQL 17 engine anyway via `@electric-sql/pglite@0.4.6` (real Postgres compiled from unmodified source to WASM, distributed on the allowlisted npm registry) — verified `PostgreSQL 17.5` via `select version()` and confirmed real RLS/role/`set_config` enforcement with a two-user isolation smoke test before trusting it. Re-ran the entire migration chain and both regression files unmodified against this engine (one persistent instance, sequential `db.exec()`, abort-on-first-error) — full transcript shows all 7 files applying cleanly, meaning every `pg_temp.assert_true` assertion in both regression files (RLS two-tenant, assignment/revoke, suspended membership, author spoofing, cross-tenant, unassigned PT, unassigned massage therapist, physiotherapist flow, assignment-management authorization) passed on real PostgreSQL 17.5. Also installed `postgresql-16-plpgsql-check` from Ubuntu's own archive (unrelated, reachable host) and ran the actual Supabase CLI (`supabase db lint --db-url ...`) for real — "No schema errors found" — though only achievable against PostgreSQL 16, since every `@electric-sql/pglite-socket` release (needed to expose PGlite over the wire protocol for the CLI to connect to) requires the PostgreSQL-18-line PGlite as an exact peer dependency; forcing it against the 17.5 line produced a TCP listener that hung on the handshake (confirmed with a 2-minute `psql` timeout, not assumed). Re-ran `npm test` (30/30) and `npm run build` (clean) after the PG17 pass for a complete final record, plus `git diff --check` and a secret-pattern scan.
- Files changed: `docs/architecture/pol-rbac-001a-local-validation.md` (restructured into explicit "PostgreSQL 16 — preliminary" and "PostgreSQL 17 — final validation" sections, with the exact hosts/errors, engine version proof, full checklist-to-result mapping and the lint residual gap); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`. No SQL/frontend files changed — this round only re-validated already-committed code.
- Database changes: none. No schema/policy edits in this round; the PGlite/PostgreSQL 17.5 database and the PostgreSQL 16 lint database were both disposable, local, and destroyed at the end of the session (or destroyable on request) — no production/remote access at any point.
- Tests executed: full migration + regression chain on PostgreSQL 17.5 (PGlite); `supabase db lint` on PostgreSQL 16 with `plpgsql_check`; `npm test`; `npm run build`; `git diff --check`; secret-pattern scan.
- Test results: PostgreSQL 17.5 — migration chain, POL-RBAC-001 regression (6/6), POL-RBAC-001A regression (all assertions), all pass. `db lint` (PostgreSQL 16): no schema errors. Node 30/30. Build clean. Diff/secret checks clean.
- Unresolved issues: `supabase db lint` was not achieved against literal PostgreSQL 17 — flagged `PRODUCT_OWNER_DECISION_REQUIRED` if that specific combination is required before merge (would need Docker or PGDG apt access, i.e. a different network policy or environment). Security/performance advisors remain unavailable on any engine in this sandbox. All other residual risks unchanged from the prior entries (`episode_id`/POL-FIS-001 convergence, team-visibility judgment call).
- Risks: none new — this round only added validation coverage, no code changes.
- Exact next action: unchanged — Product Owner and Tech Lead review PR #16 at its current head, now backed by PostgreSQL 17 validation as instructed. Do not apply remotely, deploy, merge, or begin another task without explicit Product Owner approval.

## POL-RBAC-001A Product Owner decisions applied

- Task ID: POL-RBAC-001A (continuation, same session)
- Previous agent: CLAUDE
- Branch: `security/POL-RBAC-001-authoritative-capabilities` (PR #16, unchanged base)
- Objective: apply the two Product Owner decisions on the open questions from prior rounds — (1) `episode_id → physio_piani` approved as a transitional compatibility layer only; (2) PT/massage therapist roster visibility restricted to identity/role/status of the active team via data minimization, with the physiotherapist keeping the full contractual view — and only if the current implementation does not already satisfy them exactly, apply the minimum fix and re-test RLS/direct API, per instruction.
- Completed work: checked both decisions against the implementation before changing anything. Decision 1 was already exactly satisfied (nullable `episode_id`, patient-level-only RLS gating, no second episode model, no backfill) — applied as a documentation-only change: migration table/column comments and header, plus the architecture doc, now say "TRANSITIONAL COMPATIBILITY LAYER" explicitly and record the Product Owner's wording verbatim. Decision 2 was **not** satisfied: found `patient_care_assignments_select`'s "shared teammate" branch granted full-row SELECT (including `created_by`, timestamps, `ended_by`, `reason`) to an active teammate on the same patient, exceeding "identità, ruolo, stato" — removed that branch from the base table policy (now admin/physiotherapist/own-row only) and added `patient_care_team_roster_v1(studio_id, patient_id)`, a `SECURITY DEFINER` function returning exactly `id, user_id, assignment_type, active` for the active team, structurally unable to leak more columns regardless of caller. `PhysioCartella.jsx` now reads the roster exclusively through this RPC. Also found, while rebuilding this path, that `caller_has_active_patient_assignment_v1` never re-checked the caller's own `studio_users.stato = 'attivo'` — a suspended user with a still-`active=true` assignment row could still pass it; fixed with a `studio_users` join, and applied the same membership check to the *listed* rows in the roster function so a suspended team member's still-active assignment no longer counts as part of "the active team" either. Both fixes are strictly narrowing.
- Files changed: `supabase/migrations/20260819210000_pol_rbac_001a_patient_care_assignment.sql`; `supabase/tests/pol_rbac_001a_patient_care_assignment.sql` (nine new assertions); `src/components/PhysioCartella.jsx`; `tests/rbacCapabilities.test.mjs` (one test updated for the RPC change); `docs/architecture/pol-rbac-001a-patient-care-assignment.md`; `docs/architecture/pol-rbac-001a-local-validation.md`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: same migration file amended in place (still unapplied anywhere but disposable local/PGlite databases) — one SELECT policy narrowed (removed a branch), one function hardened (membership re-check), one new `SECURITY DEFINER` function added. No production/remote change.
- Tests executed: full chain re-run on PostgreSQL 16 (dev) then PostgreSQL 17.5 via PGlite (final gate, per established process) after the fix — synthetic bootstrap → Fisio schema → POL-RBAC-001 → POL-RBAC-001A → both bootstrap extensions → both regression files; `supabase db lint` re-run on PostgreSQL 16; `npm test`; `npm run build`; `git diff --check`; secret-pattern scan.
- Test results: both engines applied the full chain cleanly, including nine new roster/suspension assertions (active-teammate base-table restriction, roster RPC minimal-column/active-only/patient-scoped results, front-desk/unassigned-PT/admin authorization tiers, suspended-caller denial). `db lint`: no schema errors, unchanged. Node: one test initially failed (it asserted the now-removed raw-table select pattern) — updated to assert the RPC call and assert the raw table is never selected from directly; re-ran clean at 30/30. Build clean. Diff/secret checks clean.
- Unresolved issues: unchanged — `supabase db lint` on literal PostgreSQL 17 remains `PRODUCT_OWNER_DECISION_REQUIRED` if required before merge (Docker/PGDG access this sandbox doesn't have); physiotherapist Fisio access stays tenant-wide (not requested to change by either decision). The `episode_id`/POL-FIS-001 convergence and roster-visibility items are no longer open questions — both are now decided and implemented.
- Risks: none new — both fixes strictly narrow existing access, verified by full regression on both engines; nothing that had access before gained more.
- Exact next action: unchanged — Product Owner and Tech Lead review PR #16 at its current head, now incorporating both decisions. Do not apply remotely, deploy, merge, or begin another task without explicit Product Owner approval.

## POL-RBAC-001A rebase onto master (PR #15 squash-merged)

- Task ID: POL-RBAC-001A (continuation, same session)
- Previous agent: CLAUDE
- Branch: `security/POL-RBAC-001-authoritative-capabilities` (PR #16) — base changed from `ui/POL-UI-002-canonical-financial-widgets-presets` to `master`
- Objective: PR #15 was squash-merged to master as `1348dd9801dad882ad0a370cbb08e89066af7c31`; GitHub retargeted PR #16 onto master, but it still carried the old stacked POL-UI-002 history and was unmergeable. Realign the branch onto the current master, preserving only the POL-RBAC-001/POL-RBAC-001A-specific work, without duplicating POL-UI-002 content already on master.
- Completed work: confirmed `git diff b9370ad 1348dd9` (old POL-UI-002 branch tip vs. the new master squash commit) was byte-empty before touching anything — the squash preserved content exactly, meaning the seven RBAC-specific commits could be replayed cleanly. Ran `git rebase --onto origin/master b9370ad security/POL-RBAC-001-authoritative-capabilities`; all seven commits applied with zero conflicts. Verified: post-rebase tree is byte-identical to pre-rebase tree (`git diff <old-tip> <new-tip>` empty — nothing lost or duplicated); `master` is now a direct ancestor of the branch tip (clean, fast-forwardable stack, no longer unmergeable); the `origin/master..HEAD` diff contains only POL-RBAC-001/POL-RBAC-001A-owned files plus exactly two pre-existing, already-necessary POL-UI-002 touch-ups (from the original POL-RBAC-001 commit, predating this session: `tests/homeFinancialWidgets.test.mjs`'s capability-array test signature, `pol-ui-002-implementation-validation.md`'s prose) — no POL-UI-002 feature file duplicated. Re-ran the entire required checklist after the rebase, before pushing.
- Files changed: no source/migration/test file content changed (tree is identical to before the rebase) — only `docs/coordination/current-task.md` (base/rebase record) and this handoffs entry. Git history itself was rewritten (rebased), which is the substantive change in this round.
- Database changes: none.
- Tests executed (post-rebase, pre-push): `npm test` (30/30 — 20 original POL-UI-002 + 10 POL-RBAC-001/POL-RBAC-001A); full migration/regression chain on PostgreSQL 16 (dev); `supabase db lint` on PostgreSQL 16; full chain re-run on **PostgreSQL 17.5 via PGlite** (final gate, per established process) — migration chain, POL-RBAC-001 regression, POL-RBAC-001A regression including two-tenant RLS/assignment-revoke/suspended-user/author-spoofing/cross-tenant/roster-minimization assertions; `npm run build`; `git diff --check`; secret-pattern scan over the full `origin/master..HEAD` diff; explicit scope check for POL-UI-002 duplication.
- Test results: all green on both engines, no regressions, no duplication found. Full detail and exact commands: `docs/coordination/current-task.md` ("Rebase onto master" section).
- Unresolved issues: unchanged from the prior entry (`supabase db lint` on literal PostgreSQL 17 remains `PRODUCT_OWNER_DECISION_REQUIRED` if required before merge; physiotherapist Fisio access stays tenant-wide by design).
- Risks: history rewrite (rebase) on a shared branch — mitigated by verifying byte-identical resulting tree before pushing, and by tagging the pre-rebase tip locally (`backup/pol-rbac-001a-pre-rebase-0c675e9`, not pushed) as a safety net. Push uses `--force-with-lease`, not `--force`, so it aborts instead of clobbering if anyone else pushed to this branch first.
- Exact next action: Product Owner and Tech Lead review PR #16 — now cleanly based on `master`, mergeable, with no POL-UI-002 duplication. Do not apply remotely, deploy, merge, or begin another task without explicit Product Owner approval.

## POL-UX-001 Poliedra Visual System & Dashboard Experience

- Task ID: POL-UX-001
- Previous agent: CLAUDE
- Branch: `ui/POL-UX-001-visual-system-dashboard-experience`, based on `master@7a0c490` (POL-UI-003 already merged)
- Objective: complete the Poliedra UI/UX as one organic design-system mission — shared tokens, header/Home integration, real Quick Booking with authoritative slots, customizable quick actions with a workflow contract, a unified Pannello Economico on the canonical contract only, and app-wide propagation of shared primitives.
- Completed work: audited the repo first — confirmed no prior POL-UX-001/Gemini work exists anywhere, and that local `master` was a stale unrelated lineage (rebuilt the branch from `origin/master` directly). Added `src/styles/designTokens.css` (shared blue/indigo/azzurro/turchese/teal tokens, formalizing `PremiumVisualSystem.css`'s existing `--pol-premium-*` block as aliases onto it, not a second palette). Redesigned the mobile header to the same dark gradient/depth as `PremiumSidebar` (`.app-mobile-header`). Simplified the greeting to "{Saluto}, {Nome} 👋" with a real operational subtitle (today's appointment count). Investigated the "Home menu not visible" report: found and fixed a real gap in `mergeDockSettings` (a saved 5-slot dock customization with no home-inclusion guarantee could drop it entirely) and strengthened `MobileDock`'s active-state contrast (an almost-imperceptible tint pill); could not reproduce a literal "invisible" defect under default configuration via static analysis alone (documented, not claimed fixed with false certainty). Replaced the three-pill period selector with labeled Mese/Anno dropdowns on a solid surface (the prior translucent-pill unselected state was the likely real contrast defect). Split "Nuovo appuntamento" from "Apri agenda": added `src/lib/agendaSlots.js` (`computeFreeSlots`, derived only from real `appointments`/`impegni`/`agenda_settings` — no invented availability) and `src/components/QuickBookingModal.jsx` (patient search, prestazione, data/durata, operatore/poltrona when `multi_operatore` is on, real slot picker, note), writing appointments through the same `setAppointments` sync setter Agenda.jsx already uses — one more entry point into the existing agenda, not a second one. Investigated the "Personalizza Home persistence" report in depth (RLS, upsert conflict target, `normalizeHomeLayout`'s backward-compatible fallback, the user→studio→role→platform resolution order) and found the mechanism structurally sound; no reproducible defect found without live data — flagged rather than silently patched. Extended the widget-layout contract with an optional, backward-compatible `config` field (`setHomeWidgetConfig`) and built `src/lib/quickActionsCatalog.js` (the 10 actions from the mission, RBAC/feature/vertical-gated, a documented `workflow` step-contract) plus a customizer sub-panel (add/remove/reorder, reusing the existing widget-list UI pattern) so quick actions persist through the same, already-tested layout hierarchy. Redesigned `CanonicalManagementView.jsx` (Controllo di Gestione → Panoramica, i.e. the actual "Pannello Economico") to reuse the exact `.canonical-financial-widget` gradient card family already shipped for Home's canonical KPIs — pure presentation change, `createCanonicalManagementModel` and its output untouched. Propagated shared depth/radius app-wide by tuning the two already-centralized primitives (`Btn`, `Crd` in `src/components/ui/`) rather than touching each page individually — every page that already uses them inherits the update with no per-page risk.
- Files changed: `src/App.jsx`; `src/components/CanonicalFinancialWidget.css`; `src/components/CanonicalManagementView.jsx`; `src/components/Dashboard.jsx`; `src/components/MobileDock.jsx`; `src/components/PremiumVisualSystem.css`; `src/components/QuickBookingModal.jsx` (new); `src/components/ui/Btn.jsx`; `src/components/ui/atoms.jsx`; `src/lib/agendaSlots.js` (new); `src/lib/homeWidgetRegistry.js`; `src/lib/quickActionsCatalog.js` (new); `src/lib/utils.js`; `src/styles/designTokens.css` (new); `tests/agendaSlots.test.mjs` (new); `tests/quickActionsCatalog.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No migration, RLS policy, or `supabase/` file touched — verified empty diff against `origin/master` for the entire `supabase/` tree.
- Tests executed: `npm test` (full suite, including 13 new tests across the two new test files); `npm run build`; `git diff --check`; secret-pattern scan on the diff; explicit diff against `origin/master` for the canonical financial/RBAC/Fisio files listed under Safety boundaries above (all empty); Playwright-driven headless-Chromium responsive QA at 375/768/1024/1440 of Home, the redesigned Pannello Economico, and the Quick Booking modal (real viewport widths — this sandbox's raw Chromium CLI clamps `--window-size` below 500px, so Playwright was used instead), each with a `document.body.scrollWidth === window.innerWidth` check.
- Test results: all Node tests pass; build clean; diff-check clean; secret scan clean; zero horizontal overflow at any width in the mock QA; touch targets on the changed surfaces confirmed ≥44px. No lint script is configured in this project.
- Unresolved issues / residual scope: full multi-step workflow auto-chaining (e.g. "nuovo paziente" auto-flowing into a pre-filled booking) is defined as a contract in `quickActionsCatalog.js` but only demonstrated for the booking half — the patient-creation step still opens the existing Pazienti page rather than an inline quick-create form; Agenda/Pazienti/SchedaPaz/Setup/Fisio and Controllo di Gestione's non-Panoramica tabs received only the shared-primitive (`Btn`/`Crd`) consistency pass, not a full visual migration or dedicated responsive QA screenshots — deliberately scoped to avoid touching large, high-traffic files without live verification; the "Home menu not visible" report has a real, defensible fix applied but could not be reproduced/confirmed root-caused with certainty; "Personalizza Home persistence" likewise found no defect on static review. All flagged explicitly in the final report rather than claimed complete.
- Risks: none introduced beyond the above — every safety-boundary check listed came back clean, and the `Btn`/`Crd` primitive changes are additive style-value tuning on components whose call sites were not touched.
- Exact next action: Product Owner reviews the draft PR for `ui/POL-UX-001-visual-system-dashboard-experience`. Do not deploy, merge, or begin another task without explicit Product Owner approval.

## POL-AI-001 Poliedron Universal Operating Interface (Phase 1)

- Task ID: POL-AI-001
- Previous agent: CLAUDE
- Branch: `feature/POL-AI-001-poliedron-universal-interface`, based on `master@d1d4024` (POL-UI-010 already merged) — PR #35 (draft)
- Objective: implement the first architecture of Poliedron, Poliedra's native AI operating interface, following USER → POLIEDRON → POLIEDRA AI CORE → SEARCH/NAVIGATION/ACTIONS/DATA → MODEL PROVIDER (when needed): a global draggable Orb, a Spotlight-style command panel (search/actions first, not chatbot-first), a provider-independent Model Gateway, deterministic-first intent classification and federated search, an Action Registry reusing existing workflows, and a Permission Engine reusing existing RBAC — without any database migration, RLS change, or new financial formula.
- Note on task provenance: the POL-AI-001 specification was issued directly in-session (not pre-recorded in this file); `docs/coordination/current-task.md` was updated mid-session to record it as the active task/branch before continuing, per AGENTS.md's ownership rules — see that file's "Ownership note" for the full explanation. POL-UX-001 (previously the recorded current task, still `WAITING_PRODUCT_OWNER` with its own open PR) was moved to the historical section, not abandoned.
- Completed work: built `src/lib/poliedron/` (navigationIndex, permissionEngine, actionRegistry, intentEngine, searchEngine, contextEngine, modelGateway, poliedraCore — pure, UI-independent orchestration) and `src/components/poliedron/` (PoliedronOrb, PoliedronPanel, PoliedronSearchResults, PoliedronActionPreview, PoliedronConversation, usePoliedronPosition hook, Poliedron container). Reused, rather than duplicated: `cercaPazienti`/`normalizza` (patient search), `quickActionsCatalog`'s `isQuickActionAllowed`/`getQuickAction`/`run(ctx)` (create actions + permission gate), `buildHomePermissions` (capability model), `canonicalFinancialSelectors`'s `loadCanonicalFinancialSnapshot`/`selectCanonicalMetrics` (ANALYZE intent, real numbers only), and the existing `agente-assistente` Supabase Edge Function (adapted behind `modelGateway.js`, the sole caller — no new provider SDK, no API key). Wired into `App.jsx`: `MobileDock`'s render call replaced with `<Poliedron>` (now mounted unconditionally, mobile+desktop, once in the app shell); `MobileDock.jsx` itself is **not deleted** since `AssistenteAI.jsx` still imports its `MOBILE_FLOAT_BOTTOM` constant. `AssistenteAI.jsx` is otherwise untouched — documented scope decision. CREATE/UPDATE actions are Phase-1 Level 1 (navigate to the existing unchanged form; the human still submits it) rather than a direct Level-2 write, since no existing form component accepts patient/amount pre-fill props yet — documented as a FUTURE_PHASES item, not silently narrowed. Found and fixed a real bug during QA (not caught by static review): `usePoliedronPosition`'s drag-tracking `window` listeners were attached inside a `useEffect` gated on `isDragging`, but `isDragging` only ever became `true` from inside the very listener that effect was supposed to attach — a deadlock where dragging could never start. Fixed by attaching/removing the listeners directly on `pointerdown`/`pointerup` instead.
- Files changed: `src/App.jsx`; `src/components/PremiumVisualSystem.css` (idle Orb + panel-open animations, `prefers-reduced-motion`-guarded); `src/components/poliedron/*` (new, 8 files); `src/lib/poliedron/*` (new, 8 files); `tests/poliedron.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No `supabase/` file touched, no migration, no RLS policy change, no new table/RPC — verified by inspection of the diff (no `supabase/` paths appear in it).
- Tests executed: `npm test` (full suite, 98/98 — 58 pre-existing + 40 new in `tests/poliedron.test.mjs` covering intent classification, navigation search, action registry, permission filtering, context binding, partial match, safe fallback, provider independence); `npm run build`; `git diff --check`; a secret-pattern scan over the full diff; a real-render Playwright QA pass (temporary `qa-harness.html`/`src/qa-entry.jsx`, deleted before commit — the actual git history for this task never carries them) mounting the real `Poliedron` component at 375/390/430/768/1024/1440px × Light/Dark, driving: rest-state overflow, orb-inside-viewport, orb-vs-AgenteAI-corner non-collision, tap-to-open, panel-inside-viewport, input autofocus, live grouped search, keyboard Up/Down/Enter, Esc-close, Ctrl/Cmd+K (desktop only), pointer-drag-moves-the-orb, dragged-orb-stays-clamped, and drag's trailing click not re-opening the panel.
- Test results: Node 98/98 pass. Build clean. `git diff --check` clean. Secret scan clean (only benign false-positive matches on the word "token" in unrelated architecture prose). Playwright QA: 12/12 breakpoint×theme combinations all-green on first pass after the drag-listener fix (the same 12/12 initially failed the two drag-related checks before the fix, confirming the bug was real and the fix resolved it).
- Unresolved issues / residual scope: Level-2 direct-write actions with true entity pre-fill (would require adding pre-fill props to `Pagamenti.jsx`/`Richiami.jsx`/`Piani.jsx`, out of scope for Phase 1); voice input (predisposed per §27 but not implemented); Poliedra long-term memory (predisposed per §28 but no new persistence added); telemetry events (§29 — no safe existing analytics pipe was found to hook into in this session, so only documented as a future interface, not implemented); additional federated-search adapters for appointments/documents/invoices/settings (documented in `searchEngine.js`'s header comment — no queryable client-side index exists yet for any of these); model-router tiering beyond the single deployed edge function (§16 — nothing to tier between yet). All listed explicitly, not claimed complete.
- Risks: none introduced beyond the fixed drag-deadlock bug (caught and closed within this same round, before commit). `MobileDock.jsx` is now dead code from a rendering standpoint but is deliberately kept (not deleted) for its shared `MOBILE_FLOAT_BOTTOM` export — flagged so a future cleanup pass doesn't delete it without first extracting that constant.
- Exact next action: Product Owner reviews the draft PR (#35) for `feature/POL-AI-001-poliedron-universal-interface`. Do not deploy, merge, or begin another task without explicit Product Owner approval.

## POL-AI-001 Product Owner review round 2 — single AI entry point

- Task ID: POL-AI-001 (continuation, same branch)
- Previous agent: CLAUDE
- Branch: `feature/POL-AI-001-poliedron-universal-interface` — PR #35 (draft, not merged)
- Objective: Product Owner review required Poliedron to be the app's single AI entry point — no second floating AI button. PR #35's first round mounted `AssistenteAI.jsx` (a separate, pre-existing chat widget) alongside Poliedron and the QA even asserted the two coexisted without overlapping; the Product Owner rejected that coexistence.
- Legacy AI entrypoint audit (repo-wide search for AssistenteAI/Agente/AI/chat/floating references):
  - `AssistenteAI.jsx` — a floating, bottom-right chat widget with a real tool-confirmation loop (crea_appuntamento/modifica_appuntamento/elimina_appuntamento/registra_pagamento/crea_paziente), calling the same `agente-assistente` edge function Poliedron's `modelGateway.js` also calls. **REMOVE FROM UI** (unmounted from `App.jsx`) + **KEEP INTERNAL** (file and logic not deleted — real, working code a future round can port into Poliedron's ASK/ANALYZE path behind the Model Gateway, rather than being rewritten).
  - `AgenteAISetup.jsx` — an admin-only Setup/Impostazioni page (istruzioni/FAQ/documenti/azioni/livello tabs) for configuring the backend agent's knowledge base and permitted actions. Not a floating chat launcher, not a duplicate entry point — it configures the same backend Poliedron's Model Gateway calls. **KEEP INTERNAL**, unchanged, still reachable via Setup as before.
  - `MobileDock.jsx` — already unmounted in round 1 (superseded by Poliedron); kept only because `AssistenteAI.jsx` imports its `MOBILE_FLOAT_BOTTOM` constant. **DEPRECATED** (dead from a rendering standpoint on both counts now that AssistenteAI is also unmounted).
  - `richiamiBot.js` — deterministic, rule-based recall/reminder generation (no model call, no UI, not an AI chat entry point at all). Not in scope, excluded from this audit's action list.
- Completed work: removed `AssistenteAI`'s import and `<AssistenteAI isMobile={isMobile} />` render call from `App.jsx` — it now mounts only `<Poliedron>` as the single floating AI element, on both mobile and desktop. Since AssistenteAI's own corner button no longer exists, removed the now-purposeless `avoidBottomRight` corner-reservation special case from `usePoliedronPosition.js`'s edge-snap logic (Poliedron can now snap flush into any corner, including bottom-right — general viewport clamping is untouched and still applies). Updated every comment across `App.jsx`, `AssistenteAI.jsx`, `MobileDock.jsx`, `PremiumVisualSystem.css`, `modelGateway.js` and `intentEngine.js` that described AssistenteAI as a still-mounted, "separate working chat surface" — all now accurately describe it as unmounted, kept for a future convergence, with the convergence path spelled out (Poliedron Command Panel → ASK/ANALYZE → Conversation view → Model Gateway → the same `agente-assistente` function, never a second chatbot). No change to `modelGateway.js`'s actual behavior — it was already, and remains, the sole caller of the edge function for anything Poliedron does; the only change was making that "sole caller" claim true in practice too (AssistenteAI's now-dormant call site no longer executes since its component is never mounted). Added 3 regression tests to `tests/poliedron.test.mjs` asserting `App.jsx` never imports/mounts `AssistenteAI` and mounts `<Poliedron>` exactly once, so re-introducing a second floating AI launcher would fail CI.
- Files changed: `src/App.jsx`; `src/components/AssistenteAI.jsx` (header comment only — no logic changed); `src/components/MobileDock.jsx` (comment only); `src/components/PremiumVisualSystem.css` (comments only, no CSS values changed); `src/components/poliedron/PoliedronOrb.jsx`; `src/components/poliedron/usePoliedronPosition.js`; `src/lib/poliedron/intentEngine.js` (comment only); `src/lib/poliedron/modelGateway.js` (comment only); `tests/poliedron.test.mjs`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: `npm test` (full suite, 101/101 — 58 pre-existing + 43 in `tests/poliedron.test.mjs`, including the 3 new single-AI-entry-point regression tests); `npm run build`; `git diff --check`; a real-render Playwright QA pass (temporary harness, deleted before commit) at 375/390/430/768/1024/1440px × Light/Dark, re-asserting every check from round 1 plus a new "exactly one fixed-position AI-labelled button exists on screen" check and a "the orb can now snap flush into the bottom-right corner" check (previously blocked by the removed `avoidBottomRight` reservation).
- Test results: Node 101/101 pass. Build clean. `git diff --check` clean. Playwright QA: 12/12 breakpoint×theme combinations all green, including the new single-launcher and unrestricted-corner-snap checks.
- Unresolved issues / residual scope: AssistenteAI's tool-confirmation loop (propose action → confirm → execute) is not yet ported into Poliedron's ASK/ANALYZE path — Poliedron's `modelGateway.js` call currently only surfaces a text answer, not a multi-turn tool-use confirmation UI. This is explicitly flagged as the next FUTURE_PHASES item, not silently dropped — the Product Owner's instruction allowed keeping this logic "temporarily as a non-directly-mounted component, documenting the convergence" rather than requiring a full port in this round.
- Risks: none introduced. All changes are either UI-shell wiring (one import/render removed), comment accuracy fixes, or a strictly-simplifying removal of dead special-case logic (the corner reservation) — no new behavior surface, no migration, no RLS/RBAC change, no new provider dependency.
- Exact next action: Product Owner re-reviews PR #35 at its current head (single AI entry point). Do not deploy, merge, or begin another task without explicit Product Owner approval.

## POL-AI-002A Poliedron Adaptive Interface (Mobile Orb + Desktop Edge Dock + Precise Drag + Prefix Navigation)

- Task ID: POL-AI-002A
- Previous agent: CLAUDE
- Branch: `fix/POL-AI-002A-adaptive-poliedron`, based on `master@e504e52` (POL-AI-001 merged as PR #35's squash commit — verified via empty tree-diff against the PR branch tip before starting)
- Objective: give Poliedron the same identity but different interaction per device — a larger (96-108px), precisely-draggable, freely-positionable mobile Orb with a unified safe-bounds model and "where I drop it is where it stays" release behavior; a discreet desktop Poliedron Edge Dock (52-60px collapsed) anchored to the left/right screen edge, vertically draggable with magnetic side-switching, expanding on hover/focus — both opening the exact same Poliedron instance/Model Gateway, never two AI systems. Also: deterministic prefix/command-alias navigation for immediate direct-open of real, verified destinations.
- Root cause found for the reported mobile drag bug (verified, not assumed): `usePoliedronPosition`'s `onPointerUp` computed a horizontal snap target and applied it **unconditionally on every release**, regardless of where the user actually dropped the orb — every drag ended in a visible "teleport" to the nearest edge. This is exactly the Product Owner's complaint ("Al rilascio NON deve... essere spinto automaticamente verso un bordo"). Fixed: snapping is now gated by a 48px threshold (`decideSnapX`), and a release outside that threshold leaves the orb exactly where dropped.
- Completed work:
  - **Safe bounds model**: `src/lib/poliedron/poliedronSafeBounds.js` — `getPoliedronSafeBounds()` (pure, testable) combining viewport, orb size, real safe-area-inset-* (read via the standard DOM "probe element" technique — env() has no direct JS API), and a 16-24px safety margin; `readSafeAreaInsets()`. A `bottomReservedExtra` parameter is kept for a future Poliedra mobile nav (none exists today).
  - **Drag/snap/persistence math**: `src/lib/poliedron/poliedronDragMath.js` — `computeDragPosition` (grabOffset-based, exact pointer tracking), `decideSnapX` (threshold-gated, never central), `fractionFromPosition`/`positionFromFraction` (exact round-trip fraction-of-safe-range persistence — always reconstructible to a valid position on any viewport), `decideSideSwitch` (desktop magnetic side switch). Extracted out of the hooks specifically so this logic is unit-testable without a DOM.
  - **Mobile hook rewrite**: `usePoliedronPosition.js` — grabOffset captured on `pointerdown`; listeners attached/removed directly on `pointerdown`/`pointerup`/`pointercancel` (the last one previously unhandled — an interrupted gesture now cleanly aborts without leaving stuck listeners); storage key bumped to `poliedron_position_v2` (v1 stored a different coordinate system — silently reinterpreting it would place the orb somewhere the user never chose, so it's versioned, not migrated).
  - **Mobile Orb visuals**: `computeMobileOrbSize()` (new, `src/lib/poliedron/poliedronOrbSize.js`) scales 96-108px by viewport width, smaller specifically at 375px to avoid disproportion. `PoliedronOrb.jsx` gained a genuine layered gradient base disc (reusing the existing `--gradient-brand` token, not a new palette) with an offset highlight and rim shadow, on top of the existing contact-shadow/halo/idle-animation/press-feedback from POL-AI-001 — no neon.
  - **Desktop Edge Dock**: new `PoliedronEdgeDock.jsx` + `usePoliedronEdgePosition.js` — collapsed at 56px, partially embedded in the edge (translate-based), two-stage hover/focus expansion ("Poliedron" then, after continued hover, the command-bar placeholder text), vertical-only drag via the same safe-bounds model, magnetic left/right side switching (`decideSideSwitch`, 120px drag threshold), `{side, verticalFrac}` persisted and reclamped on resize. Shares the mobile Orb's exact gradient/halo/gem visual language (§16 same identity).
  - **Adaptive mount**: `Poliedron.jsx` now renders `PoliedronOrb` when `isMobile` and `PoliedronEdgeDock` otherwise — both call the identical `onToggle`, opening the one shared panel/state. No new breakpoint was invented: `isMobile` is the same prop App.jsx already computes via the existing `useIsMobile()` hook (720px breakpoint) — reused, not duplicated.
  - **Prefix/command-alias navigation**: new `src/lib/poliedron/commandAliases.js` — an explicit, exact-match-only lookup table (`resolveCommandAlias`), deliberately separate from `navigationIndex.js`'s fuzzy search aliases so a normal query like "ross" or "mario rossi" is never intercepted. Every target was verified against the real `NAV` array in `src/lib/utils.js` before being registered (a dev-time uniqueness assertion also guards against an accidental duplicate key). **Finding, not invented**: "Ricette" and "Fatture" are NOT standalone pages in this app — verified by reading `ArchivioDocs.jsx`, which loads all documents across `documenti_fiscali`/`documenti_medici` and filters them client-side via its own `filtroTipo` state (whose values already include `'ricetta'`/`'fattura'`). Their commands (`ric`/`rice`/`ricetta`/`ricette` and `fat`/`fatt`/`fattura`/`fatture`) therefore open the real `archivio` route pre-filtered, via a small additive `initialFiltroTipo` prop threaded through `App.jsx` → `ArchivioDocs.jsx` (and an `onArchivioFilterHint` callback threaded into `Poliedron.jsx`) — not an invented route. `ric`/`rice` vs `rich`/`richi` (Richiami) never collide, per the task's own explicit disambiguation design.
  - `poliedraCore.js`'s `processQuery` now checks `resolveCommandAlias` **before** `classifyIntent` — an exact match returns `directNavigation` instantly, no model call, no intermediate results screen; `Poliedron.jsx`'s `runQuery` acts on it by navigating and closing the panel immediately.
- Files changed: `src/App.jsx`; `src/components/ArchivioDocs.jsx`; `src/components/PremiumVisualSystem.css` (reduced-motion guard for the Edge Dock's hover transition); `src/components/poliedron/Poliedron.jsx`; `src/components/poliedron/PoliedronEdgeDock.jsx` (new); `src/components/poliedron/PoliedronOrb.jsx`; `src/components/poliedron/usePoliedronEdgePosition.js` (new); `src/components/poliedron/usePoliedronPosition.js`; `src/lib/poliedron/commandAliases.js` (new); `src/lib/poliedron/poliedraCore.js`; `src/lib/poliedron/poliedronDragMath.js` (new); `src/lib/poliedron/poliedronOrbSize.js` (new); `src/lib/poliedron/poliedronSafeBounds.js` (new); `tests/poliedronAdaptive.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: `npm test` (full suite, 142/142 — 101 pre-existing + 41 new in `tests/poliedronAdaptive.test.mjs` covering safe-bounds clamping on all four sides, grab-offset preservation, exact-pointer-release, snap threshold/no-central-snap, reload/resize reclamp via fraction round-trip, mobile orb sizing, desktop side-switch decision logic, vertical clamp, and every command-alias/ambiguity/partial-search-survives scenario); `npm run build`; `git diff --check`; a secret-pattern scan on the diff; a real-render Playwright QA pass (temporary harness, deleted before commit) at 375/390/430/768/1024/1440px × Light/Dark plus a dedicated live-browser navigation pass driving `Ctrl/Cmd+K` and typing each real command.
- Test results: Node 142/142 pass. Build clean. `git diff --check` clean. Secret scan clean. Playwright QA: 12/12 breakpoint×theme combinations green — mobile (orb size in range, slow-drag pointer-precision, fast-drag edge-snap, bottom safe-margin respected, safe-area CSS reference present, reload persistence), desktop (collapsed size, hover/focus expansion, click and Ctrl/Cmd+K both open the single shared panel, vertical drag + clamp, side switch, no second orb rendered, modal-stacking priority correct), and 768px confirmed to resolve to desktop mode (Edge Dock only, zero Orbs) — coherent with the app's real 720px `useIsMobile` breakpoint. A live-browser navigation pass separately confirmed `ric`→archivio/ricetta, `fat`→archivio/fattura, `pag`→paga, `age`→agenda, `paz`→paz, `rich`→richiami (never colliding with `ric`), each closing the panel immediately with no intermediate screen, and `ross` still returning live patient search results without navigating away. One real test-authoring mistake was caught and fixed along the way (not a product bug): an initial QA script dragged the mobile orb past its already-bottom-parked default Y position and mis-read the resulting (correct) safe-bounds clamp as a drag failure.
- Unresolved issues / residual scope: WORK MODE (persistent side-panel, §15) is explicitly not implemented this round, per the task's own instruction — only QUICK MODE (the existing command palette) ships; the architecture (`Poliedron.jsx`'s single state/panel, unchanged `PoliedronPanel.jsx`) does not preclude adding a work-mode variant later, but no new API surface for it was added since that would be speculative. Voice input, telemetry, and Poliedra memory remain out of scope, unchanged from POL-AI-001's FUTURE_PHASES. Real iOS Safari device confirmation for `env(safe-area-inset-*)` is not possible in this sandbox (headless Chromium always resolves these to 0px) — the structural CSS-reference check is the honest ceiling of what could be verified here, consistent with this session's established norm for this exact category of limitation.
- Risks: none introduced. The mobile drag fix and the `avoidBottomRight` type of dead-behavior removal are both strictly-narrowing/correctness fixes verified by both unit tests and live-browser QA; the desktop Edge Dock and prefix navigation are net-new, additive surfaces that don't touch any existing page's business logic beyond the small, backward-compatible `initialFiltroTipo` prop on `ArchivioDocs.jsx` (defaults to its original 'tutti' behavior when omitted).
- Exact next action: Product Owner reviews the draft PR for `fix/POL-AI-002A-adaptive-poliedron`. Do not deploy, merge, or begin another task without explicit Product Owner approval.

## POL-UI-011 ownership transfer

- Task ID: POL-UI-011
- Previous agent: CLAUDE (POL-AI-001 was the stale recorded task; its work is merged in `origin/master@e504e52`)
- Branch: `lucasimondi-hotfix-pol-ui-011-mobile-edge-to-edge-sh`
- Objective: implement a global mobile edge-to-edge application shell with no retired-dock bottom reservation while preserving floating Poliedron behavior and all business/security semantics.
- Completed work: Product Owner explicitly authorized this session to replace the stale current-task record and take ownership of POL-UI-011; the branch was confirmed byte-identical to latest `origin/master@e504e52`.
- Files changed: `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: none at ownership-transfer time.
- Test results: not yet applicable.
- Unresolved issues: mobile shell audit and implementation pending.
- Risks: none introduced; coordination-only change.
- Exact next action: audit the required shell/page CSS and dependencies, implement and validate POL-UI-011, then append the complete final handoff and stop at `WAITING_PRODUCT_OWNER`.

## POL-UI-011 mobile edge-to-edge shell

- Task ID: POL-UI-011
- Previous agent: COPILOT
- Branch: `lucasimondi-hotfix-pol-ui-011-mobile-edge-to-edge-sh`, based on `origin/master@e504e52`
- Objective: remove all retired-dock mobile bottom reservation and make the shared Poliedra shell reach the physical viewport edge while Poliedron remains a fixed overlay.
- Completed work: established explicit `html`/`body`/`#root` height and zero-spacing roots; made the app shell a definite `100dvh` chain; added the `app-main` flex/min-height/overflow contract; made `#app-scroll` a width-safe `flex: 1 1 auto` surface with safe-area-only bottom padding and non-layout `scroll-padding-bottom`; preserved Agenda's dedicated inner scroll while removing its stale 84px dock subtraction; removed Home's three `92px` `!important` padding overrides. No viewport library was added because the existing stack has none and native `100dvh`, `env(safe-area-inset-*)`, flex sizing, and Agenda's existing `ResizeObserver` fully cover the requirement.
- Files changed: `src/App.jsx`; `src/styles/designTokens.css`; `src/components/PremiumVisualSystem.css`; `src/components/Agenda.jsx`; `tests/mobileShell.test.mjs`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase, migration, schema, RLS, RBAC, financial, clinical, routing, Poliedron, or AI behavior change.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; retired-reservation scan; temporary browser geometry harness (deleted before commit) covering Home, Agenda, Pazienti, Piani, Pagamenti, Documenti, Controllo Gestione, WhatsApp, and Impostazioni at 375x812, 390x844, and 430x932.
- Test results: 105/105 Node tests pass; production build passes; `git diff --check` passes; no conflict markers; no `92px` padding or Agenda `dockH`/84px reservation remains. Browser geometry: 27/27 page-size combinations pass with `window.innerHeight = visualViewport.height = documentElement.clientHeight = body/root/shell/#app-scroll bottom`, computed mobile bottom padding and margin `0px` in the non-notched harness, no horizontal overflow, last control reachable, Poliedron fixed, and its command panel opening.
- Unresolved issues: none in POL-UI-011 scope. The build retains pre-existing warnings from `pdfjs-dist` eval, a malformed legacy CSS comment token in `designTokens.css`, and existing large chunks; none is caused by this layout change.
- Risks: real iPhone Safari remains the release authority, but the implementation uses the requested WebKit-safe definite flex chain and native dynamic viewport/safe-area primitives. The repository's current single AI entry point is Poliedron; the legacy separate `AssistenteAI` button remains intentionally unmounted per merged POL-AI-001 and was not reintroduced.
- Rollback: revert the POL-UI-011 commit; there is no data or deployment rollback.
- Deployment impact: frontend bundle only; no deployment performed.
- Exact next action: Product Owner reviews draft PR #37. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-002A Product Owner review round 4 — dragMath-only refactor, additional test coverage, expanded QA

- Task ID: POL-AI-002A (continuation, same branch)
- Previous agent: CLAUDE
- Branch: `fix/POL-AI-002A-adaptive-poliedron` — PR #36 (draft, not merged)
- Objective: Product Owner asked to confirm the shared drag-math refactor, add explicit safe-zone/reclamp tests, reconfirm mobile Orb/desktop Edge Dock/command aliases, and expand browser QA with an off-center grab.
- Completed work:
  - Re-exported `clampToBounds` from `poliedronDragMath.js` so the desktop Edge Dock uses the same clamp primitive as mobile; `usePoliedronEdgePosition.js` now applies it to vertical coordinates.
  - Added explicit bottom safe-zone, inset-heavy home-indicator, out-of-viewport persistence/reclamp, non-alias navigation-result, and alias/real-route consistency tests.
  - Expanded browser QA with an off-center Orb grab verifying that the grabbed point, rather than the Orb center, tracks the pointer.
- Files changed: `src/components/poliedron/usePoliedronEdgePosition.js`; `src/lib/poliedron/poliedronDragMath.js`; `tests/poliedronAdaptive.test.mjs`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; secret scan; Playwright QA at 375/390/430/768/1024/1440 in Light/Dark.
- Test results at that commit: 147/147 Node tests pass; build/diff/secret checks clean; 12/12 browser viewport-theme combinations and 9/9 command checks pass.
- Unresolved issues / risks: no new gaps; WORK MODE, voice input, telemetry, and memory remained out of scope.
- Exact next action at that point: Product Owner re-review. Superseded by the compact-mobile-dock continuation below.

## POL-AI-002A Product Owner revision — compact mobile dock

- Task ID: POL-AI-002A
- Previous agent: CLAUDE/COPILOT continuation on the existing task; ownership remained on `fix/POL-AI-002A-adaptive-poliedron`.
- Branch: `fix/POL-AI-002A-adaptive-poliedron`; draft PR #36. Existing commits `a6113e8` and `2eac136` were preserved. Latest `master@d95af43` (POL-UI-011) was incorporated with merge commit `1b320ab`; the revision implementation is `8a70bda`.
- Objective: preserve the adaptive Poliedron, desktop Edge Dock, precise Pointer Events drag, direct aliases, real Archivio filters, and tests while reintroducing a small overlay mobile navigation dock with the Poliedron Orb as its central elevated hero.
- Completed work:
  - Added `PoliedronMobileDock.jsx` with exactly Home (`home`), Agenda (`agenda`), central Poliedron, Pazienti (`paz`), and Setup (`set`). The four 44px icon buttons use 22px icons, labels, `aria-current`, semantic tokens, active states, and a centered 84vw/max-390px frosted pill above the physical safe area.
  - Kept the POL-UI-011 edge-to-edge shell: the dock is fixed overlay chrome and adds no global bottom layout strip. The same existing `scroll-padding-bottom` keeps programmatic focus targets visible.
  - Resized the mobile Orb to the approved `clamp(88px, 24vw, 104px)` model. It renders through a body portal so the dock's centering transform cannot become the fixed Orb's containing block; Chromium QA caught and verified this correction.
  - Reworked the mobile position controller around the existing Pointer Events semantics: `pointerStart`, `orbStart`, exact `grabOffset`, pointer capture/release, `pointercancel`, safe clamp, detached fraction persistence, resize/orientation reclamp, and click suppression. Default state has no persisted override and resolves to the physical center hero slot.
  - Added `poliedronMobileDock.js`, a pure layout/redock model covering viewport, Orb size, safe areas, dock geometry, protected bottom zone, docked position, redock/attraction regions, and a continuous protection ramp. Attraction tapers to zero at the boundary and is clamped, so crossing into detached space is continuous; releases outside remain exact subject only to safe clamp, while releases in the magnetic zone clear detached storage and redock.
  - Removed the obsolete mobile edge-snap helper/path. Mobile releases never randomly snap to an edge.
  - Preserved desktop Edge Dock-only behavior at widths >=720px, including 768px tablet. Persistence now writes the requested `{side, verticalPosition}` shape while reading the previous `verticalFrac` shape for compatibility. Side-switch state is captured synchronously on pointer move, removing a fast-release race.
  - Kept one Poliedron instance and one Phase-1 panel/model gateway. Opening the mobile panel recedes and disables the dock; modal/document viewer z-indexes remain above the command panel, and the panel remains above Orb/dock/content.
  - Tightened direct aliases so exact aliases direct-open only when their real target survives the existing permission/feature-filtered navigation index. `ric`/`fat` still open real Archivio filters, and no provider/model path is touched for allowed local aliases.
  - Mobile back-navigation audit and scoped fixes: `SchedaPaz`, `DocMedico`, and `DocFiscale` already use explicit page-level `onClose` back flows; `PdfView`, `PdfViewerModal`, and shared modal flows already close to their owning page. Their page-level back/close targets are now labelled and at least 44px. Main-dock navigation is not overloaded with Back; navigating from Poliedron closes and clears the persisted dashboard patient overlay. Multi-step patient consent/history forms retain their existing explicit Indietro transitions, and Setup remains a single page with internal sections rather than a browser-history route.
- Mobile drag root cause: the original implementation unconditionally edge-snapped on release. The first revision removed that, but placing a fixed Orb beneath a transformed dock created a new containing-block offset, and an abrupt protected-bound switch could jump during horizontal detach. The final fix portals the Orb to `document.body` and continuously interpolates dock protection while tapering/clamping magnetic attraction.
- Files changed in `8a70bda`: `src/App.jsx`; `src/components/DocFiscale.jsx`; `src/components/DocMedico.jsx`; `src/components/PdfView.jsx`; `src/components/PremiumVisualSystem.css`; `src/components/SchedaPaz.jsx`; `src/components/poliedron/Poliedron.jsx`; `src/components/poliedron/PoliedronMobileDock.jsx` (new); `src/components/poliedron/PoliedronOrb.jsx`; `src/components/poliedron/usePoliedronEdgePosition.js`; `src/components/poliedron/usePoliedronPosition.js`; `src/components/ui/Modal.jsx`; `src/components/ui/PdfViewerModal.jsx`; `src/lib/poliedron/poliedraCore.js`; `src/lib/poliedron/poliedronDragMath.js`; `src/lib/poliedron/poliedronMobileDock.js` (new); `src/lib/poliedron/poliedronOrbSize.js`; `src/lib/poliedron/poliedronSafeBounds.js`; `tests/poliedronAdaptive.test.mjs`. Coordination files are updated in the follow-up handoff commit.
- Database changes: none. No Supabase, migration, schema, RLS, RBAC, finance, clinical, auth, production, API-key, provider-SDK, or dependency-manifest change.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; secret-pattern scan; full scope/diff inspection; repeated high-confidence code-review passes; temporary real-Chromium CDP harness (removed before commit).
- Test results: 163/163 Node tests pass after reconciling the concurrent review-round-4 clamp/test commit. Production build passes with only the pre-existing `pdfjs-dist` eval warning, existing malformed CSS-comment warning in `designTokens.css`, and existing chunk-size warnings. `git diff --check`, conflict scan, and secret scan pass.
- Visual QA: real Chrome 151 covered 375x812, 390x844, and 430x932 in Light and Dark (6/6): exact dock order, 84vw geometry, 64px/999px pill, semantic glass/blur, 90/94/103px centered Orb, tap navigation, active state, command-panel stacking, dock recession/non-interactivity, no horizontal overflow, detached exact release, persisted reload, magnetic redock, and reduced-motion `animation-name:none`. 768, 1024, and 1440 in Light and Dark (6/6) rendered Edge Dock only and verified focus expansion, click, Ctrl+K, panel stacking, no overflow; a dedicated desktop drag verified left/right switch, vertical movement, and persisted `{side, verticalPosition}`. The final attraction-boundary taper/clamp refinement followed this browser matrix and is covered by a dedicated pure continuity regression plus the final full suite/build. Screenshots are session artifacts only, not repository files.
- Unresolved issues: no implementation blocker. Real hardware remains the final authority for non-zero iOS `env(safe-area-inset-*)`; Chromium verified the CSS/JS contract and zero-inset geometry, while unit tests cover synthetic non-zero safe-area values.
- Risks: detachable drag intentionally preserves exact outside-zone placement only after applying viewport/dock safe clamps; inside the center magnetic zone it redocks by design. Existing build warnings are unchanged and out of scope.
- Rollback: revert the final reconciliation merge, the coordination handoff commit, and `8a70bda`; revert merge commit `1b320ab` only if POL-UI-011 must also be removed from this branch. No data rollback is required.
- Deployment impact: frontend bundle only; no deploy performed.
- Product Owner decision required: none. `768px` is documented and tested as Desktop Edge Dock because the authoritative existing breakpoint is `<720px`.
- Exact next action: Product Owner reviews draft PR #36. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-002A Product Owner visual refinement — standalone mobile polyhedron

- Task ID: POL-AI-002A (continuation on existing draft PR #36).
- Previous agent: COPILOT continuation; ownership remained on `fix/POL-AI-002A-adaptive-poliedron`.
- Branch: `fix/POL-AI-002A-adaptive-poliedron`.
- Objective: refine only the mobile `<720px` center Poliedron visual so the official polyhedron asset is the visible button, with no circular container, while preserving the dock, navigation, drag/redock architecture, commands, command panel, and desktop Edge Dock exactly.
- Completed work:
  - Removed the mobile Orb's gradient circular base, circular halo plate, and highlight layer. The existing official `icon-poliedra-gem.png` now renders as the standalone visible object over a restrained contact shadow.
  - Made the interaction surface explicitly transparent and borderless with no box shadow or appearance styling. The hit area follows `clamp(58px, 17vw, 72px)`, producing 64px at 375, 66px at 390, and 72px at 430; all remain above the 44px accessibility minimum.
  - Left `PoliedronMobileDock.jsx`, dock CSS/geometry, navigation, `usePoliedronPosition.js`, mobile dock/redock math, commands, panel behavior, and every desktop Edge Dock file unchanged.
  - Added regression coverage for the responsive size model, accessible hit target, official asset, transparent interaction surface, full-size standalone gem, and absence of mobile base/halo elements.
- Files changed: `src/components/poliedron/PoliedronOrb.jsx`; `src/lib/poliedron/poliedronOrbSize.js`; `tests/poliedronAdaptive.test.mjs`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase, migration, RLS, RBAC, finance, clinical, auth, AI, provider, production, or dependency change.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; added-secret/scope inspection; real headless Chrome QA using a temporary exact-component harness that was deleted before commit.
- Test results: 164/164 Node tests pass. Production build passes with only the pre-existing `pdfjs-dist` eval warning, malformed legacy CSS-comment warning, and chunk-size warnings.
- Visual QA: 375x812, 390x844, and 430x932 in Light and Dark all pass. Computed transparent hit/visual boxes are 64px, 66px, and 72px; circular base/halo counts are zero; button background is transparent, border width is zero, and box shadow is none. Dock remains 84vw by 64px, navigation order/routes pass, click opens the real Phase-1 panel and recedes the dock, drag persists detached state with no circle, magnetic redock clears detached persistence, safe bounds remain active, and no horizontal overflow occurs. At 768px the existing 56px desktop Edge Dock remains the only launcher.
- Unresolved issues: none.
- Risks: the visible asset is portrait-proportioned inside its square transparent hit box, as supplied by the official repository asset; no asset replacement or crop was introduced.
- Rollback: revert this visual-refinement commit. No data rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews updated draft PR #36. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-002A Product Owner visual adjustment — mobile polyhedron 1.5 mm lower

- Task ID: POL-AI-002A (continuation on existing draft PR #36).
- Previous agent: COPILOT continuation; ownership remained on `fix/POL-AI-002A-adaptive-poliedron`.
- Branch: `fix/POL-AI-002A-adaptive-poliedron`.
- Objective: move only the docked mobile Poliedron center 1.5 mm lower.
- Completed work: reduced the shared mobile center elevation by exactly `1.5 * 96 / 25.4` CSS pixels (approximately 5.67px), from 26px to approximately 20.33px. Because the existing docked/redock geometry shares this constant, the resting position and magnetic redock target remain aligned. No size, dock, navigation, drag, command, panel, or desktop code changed.
- Files changed: `src/lib/poliedron/poliedronMobileDock.js`; `tests/poliedronAdaptive.test.mjs`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: `npm test`; `npm run build`; `git diff --check`.
- Test results: 164/164 Node tests pass; production build passes with only the pre-existing warnings; diff check passes.
- Unresolved issues: none.
- Risks: none identified; the adjustment is isolated to the shared mobile docked-center Y coordinate.
- Rollback: revert this adjustment commit. No data rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews updated draft PR #36. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-002B Poliedron Conversational Actions & Workflows

- Task ID: POL-AI-002B
- Previous agent: Product Owner-authorized new task after COPILOT completed POL-AI-002A and PR #36 merged.
- Branch: `lucasimondi-pol-ai-002b-workflows`, based on `master@1faa9bb` (merged PR #36).
- Objective: restore Poliedron as the application's single conversational AI and action surface, add premium permission-filtered suggestions, route supported natural-language actions through the existing Action Registry/application workflows, and make Ricetta requests open the real clinical form with safe patient resolution and supported-field-only prefill.
- Completed work:
  - Preserved the merged standalone mobile polyhedron/dock, drag/redock behavior, stacking/recede behavior, and desktop Edge Dock. Poliedron remains mounted exactly once.
  - Added a premium responsive suggestion board with permission-filtered Navigate and Create/Workflow cards for real application sections and Action Registry entries. The panel clearly distinguishes Ask, Navigate, Create, Workflow, confirmation, and result states.
  - Kept deterministic live search/local navigation fast. Exact safe aliases and permitted section names open locally; explicit unknown/open questions invoke only the existing `modelGateway.js` contract and show the returned answer. No provider SDK or second AI path was added.
  - Reserved `ric`/`rice`/`ricetta`/`ricette` for the real prescription workflow rather than Archivio filtering while preserving `rich`/`richi` as Richiami aliases.
  - Added `prescription.create` through the existing Action Registry. Patient matching uses real RLS-scoped patients, exact token-bound full names, safe surname ambiguity, and explicit selection. Alternative drugs are rejected as ambiguous. Medication extraction stops before posology/duration, including numeric dose-frequency wording.
  - Wired `Poliedron -> App.openPrescription -> SchedaPaz -> DocMedico`. The real Ricetta form receives only the supported medication field; posology and duration remain empty; no clinical data is invented and no document is generated/finalized automatically. The one-time request is consumed after application and patient-specific form state remains isolated.
  - Routed supported create language (`appuntamento`, `paziente`, `preventivo`/`piano di cura`, `pagamento`, `richiamo`, `spesa`, `documento`) to the matching permitted registry actions. Appointment creation opens the existing `QuickBookingModal`; patient/preventivo/payment/richiamo/spesa actions use the existing application form-opening contract. Generic document creation safely opens the existing document-choice surface rather than guessing a document type.
  - Made explicit Ask supersede in-flight live previews through request sequencing; stale responses cannot overwrite newer results or loading state.
  - Added regression coverage for single-AI/model-gateway boundaries, permission filtering, exact navigation, create mapping, prescription parsing/ambiguity/clinical guardrails, stale request handling, real handler wiring, one-shot prefill consumption, and the preserved adaptive dock behavior.
- Files changed:
  - Application/workflows: `src/App.jsx`; `src/components/DocMedico.jsx`; `src/components/SchedaPaz.jsx`; `src/components/Spese.jsx`; `src/lib/quickActionsCatalog.js`.
  - Poliedron UI: `src/components/PremiumVisualSystem.css`; `src/components/poliedron/Poliedron.jsx`; `src/components/poliedron/PoliedronActionPreview.jsx`; `src/components/poliedron/PoliedronPanel.jsx`; `src/components/poliedron/PoliedronSearchResults.jsx`; `src/components/poliedron/PoliedronSuggestionBoard.jsx` (new).
  - Poliedron core: `src/lib/poliedron/actionRegistry.js`; `src/lib/poliedron/commandAliases.js`; `src/lib/poliedron/intentEngine.js`; `src/lib/poliedron/permissionEngine.js`; `src/lib/poliedron/poliedraCore.js`; `src/lib/poliedron/prescriptionWorkflow.js` (new); `src/lib/poliedron/searchEngine.js`.
  - Tests/coordination: `tests/poliedron.test.mjs`; `tests/poliedronAdaptive.test.mjs`; `tests/quickActionsCatalog.test.mjs`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase migration, schema, RLS, RBAC, auth, financial formula, clinical storage, production data, or deployment change.
- Dependency changes: none.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; added-secret scan; changed-path/scope inspection; repeated high-confidence code-review passes; real Chromium browser interaction QA with temporary harnesses removed before commit.
- Test results: 179/179 Node tests pass. Production build passes. Only pre-existing warnings remain: `pdfjs-dist` eval, malformed legacy CSS-comment syntax in `designTokens.css`, and existing large chunks. Final code review found no remaining high-confidence workflow, race, permission, security, patient-matching, or clinical-prefill defect.
- Browser QA:
  - Responsive visual matrix passed at 375x812, 390x844, 430x932, 768x1024, 1024x900, and 1440x900 in Light and Dark: no horizontal overflow; mobile full-screen and desktop bounded panels; 48-50px minimum interactive heights; permitted section/action cards present; existing mobile dock and desktop Edge Dock preserved.
  - Real interaction QA passed for permission-filtered suggestions, explicit Model Gateway answer, exact prescription, ambiguous Rossi selection, and real `DocMedico` opening.
  - Final targeted pass after review fixes confirmed natural-language `crea appuntamento` opens the real `QuickBookingModal`; a request containing `Amoxicillina 875mg una compressa ogni 8 ore per 7 giorni` previews and prefills only `Amoxicillina 875mg`; posology and duration are empty; the request is consumed immediately.
- Unresolved issues: none in POL-AI-002B scope.
- Risks: patient and drug language is intentionally conservative; unrecognized or ambiguous wording asks for user input rather than guessing. Browser QA uses synthetic patients and a mocked response behind the unchanged Model Gateway contract; no production patient data or provider call was used. Existing build warnings are unchanged and out of scope.
- Rollback: revert the POL-AI-002B commits. No database, data, RLS, deployment, or dependency rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews draft PR #41. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AGD-WA-001 Agenda — allow cancelling a WhatsApp send

- Task ID: POL-AGD-WA-001 (new task; opened directly from a Product Owner chat report, not from the backlog).
- Previous agent: none — first work on this branch.
- Branch: `claude/whatsapp-agenda-cancel-rql7fg`, based on `master@1faa9bb` (POL-AI-002A already merged via PR #36).
- Objective: Product Owner reported "Quando clicco il bottone WhatsApp sul agenda poi non si può annullare, deve esserci possibilità di annullare" (after clicking the WhatsApp button in the Agenda there's no way to cancel).
- Investigation: audited every WhatsApp entry point in `src/components/Agenda.jsx`. The single-patient send modal (`waModal`) and the bulk pre-send composer (`waMassModal`) already had a working "Annulla" button that aborts before anything opens. The one uncancellable step was `inviaWAMassivo` itself: once "Invia a tutti (N)" is pressed, it scheduled one `setTimeout` per selected appointment to open a `wa.me` popup 350ms apart, with no way to stop the ones not yet fired.
- Completed work: added `waBatch` state (`{ totale, aperti }`) and a `waBatchTimersRef` holding the scheduled timer ids. `inviaWAMassivo` now records the timer ids and updates `waBatch` as each send fires; a new `annullaWABatch` function `clearTimeout`s every timer not yet fired and resets the state, with a toast reporting how many were already opened (a window already opened cannot be recalled — the UI does not claim otherwise). A persistent bottom bar ("Invio WhatsApp: aperti/totale" + "Annulla invio" button) renders while a batch is in flight. No change to the single-send or pre-send-composer flows, which already worked correctly.
- Files changed: `src/components/Agenda.jsx`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase, migration, RLS, RBAC, finance, clinical, auth, AI, provider, or production change.
- Tests executed: `npm test`; `npm run build`.
- Test results: 164/164 Node tests pass (pre-existing suite; none WhatsApp-specific, no regression). Production build passes with only the pre-existing chunk-size/pdfjs warnings.
- Unresolved issues: not manually exercised in a live browser in this session (no UI test harness available); verified by tracing every code path from each WhatsApp button to the eventual `wa.me` open.
- Risks: none identified; change is isolated to the bulk-send scheduling/cancel state, additive to existing behavior.
- Rollback: revert this commit. No data rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: push to `claude/whatsapp-agenda-cancel-rql7fg`. No PR was requested in this turn — open one only if the Product Owner asks.

## POL-AGD-WA-001 continuation — dedicated PR, cancel logic made testable, real-browser check

- Task ID: POL-AGD-WA-001 (continuation on the same branch, no new task).
- Previous agent: same session, continuing directly from the entry above.
- Branch: `claude/whatsapp-agenda-cancel-rql7fg`, still on `master@1faa9bb`.
- Objective: Product Owner asked for a dedicated PR for this fix with no further functional changes, a re-run of build/tests, an added test specific to the cancel behavior if useful, and a real browser check of the flow if the environment allows it.
- Completed work:
  1. Extracted the timer scheduling/cancellation from `inviaWAMassivo`/`annullaWABatch` into a new pure module, `src/lib/waBatchSender.js` (`pianificaInvioWABatch`, `annullaInvioWABatch`), so it can be unit-tested without mounting React. Behavior is byte-for-byte identical (same `i * 350` spacing, same state machine) — this is a refactor of the code added in this task, not a new feature, and it does not touch any other part of the Agenda or the app.
  2. Added `tests/waBatchSender.test.mjs` with Node's built-in fake timers (`node:test`'s `t.mock.timers`), covering: sequential scheduling, the `onInviato` progress callback, cancelling mid-batch (some sends already fired, the rest must never fire even after advancing time well past their scheduled moment), cancelling before anything fires, and an empty batch.
  3. Real-browser verification: this sandbox cannot log into the live app (it is hardcoded to a real production Supabase project — driving it here would violate this repo's own safety rules, same constraint already recorded for POL-RBAC-001A). Instead, built a temporary local HTML page (deleted after the run, never committed) that imported the actual `src/lib/waBatchSender.js` module and reproduced the exact bar markup used in `Agenda.jsx`, with only `window.open` stubbed to record calls instead of opening real WhatsApp windows. Served over a plain local HTTP server and driven with Playwright/Chromium (pre-installed in this environment) using real DOM clicks and real, unmocked timers.
- Real-browser results: clicking "Invia a tutti" opened sends 1 and 2 (at ~0ms and ~350ms) and the bar showed "Invio WhatsApp: 2/4"; clicking "Annulla invio" and then waiting 1.5s — well past the 700ms/1050ms when sends 3 and 4 were scheduled — confirmed no further `window.open` calls occurred, the cancel bar disappeared, and the "Invia a tutti" control was interactive again (UI returns to a coherent state). This matches the four behaviors the Product Owner asked to keep: the in-progress counter, immediate stop of not-yet-started sends, no attempt to close/recall already-opened WhatsApp windows, and a usable UI afterward.
- Files changed: `src/components/Agenda.jsx` (now delegates to the new module; no behavior change); `src/lib/waBatchSender.js` (new); `tests/waBatchSender.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none.
- Tests executed: `npm test`; `npm run build`; real-browser check as above.
- Test results: 169/169 Node tests pass (164 pre-existing + 5 new, all green). Production build clean (only pre-existing chunk-size/pdfjs warnings). Real-browser check passed as described; the harness was not part of any commit.
- Unresolved issues: the single-patient send modal and the pre-send bulk composer were re-audited for regressions and are unchanged in this round — not re-verified in a live browser for the same production-Supabase reason above; reviewed by re-reading the diff and confirming no lines outside the batch-cancel path changed.
- Risks: none identified. The refactor is behavior-preserving and isolated to the bulk-send cancel path; no other Agenda feature was touched.
- Rollback: revert this commit (and the prior one on this branch, if reverting the whole fix). No data rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: PR opened for this branch against `master`, not merged. Product Owner reviews; merge only on explicit approval.

## POL-AI-002B reconciliation with current master

- Task ID: POL-AI-002B (draft PR #41 reconciliation).
- Previous agent: COPILOT; ownership remained on `lucasimondi-pol-ai-002b-workflows`.
- Branch: `lucasimondi-pol-ai-002b-workflows`.
- Objective: incorporate current `origin/master@e5b24d4` after PR #39 merged, resolve GitHub's conflicting/dirty state without rewriting POL-AI-002B commits, preserve the newer Agenda WhatsApp batch-cancel behavior, and return draft PR #41 to a clean reviewable state.
- Completed work: fetched current `origin/master`, merged it with `--no-ff`, and resolved the two documentation-only conflicts in `docs/coordination/current-task.md` and `docs/coordination/handoffs.md`. The active task remains POL-AI-002B while POL-AGD-WA-001 is retained as a merged historical record. The incoming source files match `origin/master` exactly, and every POL-AI-002B implementation/test file matches pre-merge head `6f1c27c` exactly.
- Files changed by the incoming master merge: `src/components/Agenda.jsx`; `src/lib/waBatchSender.js` (new); `tests/waBatchSender.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Conflict resolution files: `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`. No source-code conflict occurred.
- Database changes: none. No migration, schema, RLS, RBAC, auth, financial formula, clinical storage, production data, dependency, or deployment change.
- Tests executed: `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; secret-pattern scan; changed-path/scope inspection; exact tree comparisons for incoming Agenda files and pre-merge POL-AI-002B files.
- Test results: 184/184 Node tests pass, including all 179 POL-AI-002B/pre-existing tests and the five merged Agenda batch-cancel tests. Production build passes with only the unchanged `pdfjs-dist` eval, malformed legacy CSS-comment, and large-chunk warnings. Incoming Agenda files are byte-identical to `origin/master`; POL-AI-002B implementation/test files are byte-identical to pre-merge head `6f1c27c`.
- GitHub verification: reconciliation merge head `187b901` reports `MERGEABLE/CLEAN`; the required `verify` workflow, Vercel deployment/status, and Netlify deploy preview completed successfully (Netlify header/pages/redirect checks were neutral/skipped as expected).
- Unresolved issues: none in reconciliation scope.
- Risks: none introduced by the merge. The only manual resolution was coordination prose; both code lines were preserved exactly from their authoritative parent commits.
- Rollback: revert the reconciliation merge commit to return to pre-merge POL-AI-002B head `6f1c27c`. No data or deployment rollback is required.
- Deployment impact: frontend bundle only through the already-merged Agenda change plus the existing POL-AI-002B work; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews draft PR #41 after GitHub reports it mergeable/clean with required checks green. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-002B Product Owner input/intent revision — suggest first

- Task ID: POL-AI-002B (continuation on existing draft PR #41).
- Previous agent: COPILOT continuation; ownership remained on `lucasimondi-pol-ai-002b-workflows`.
- Branch: `lucasimondi-pol-ai-002b-workflows`, containing current `origin/master@e5b24d4`.
- Objective: preserve the Product Owner-approved Poliedron visual UI exactly while changing input semantics so bare nouns, prefixes, entities, and section names remain permission-filtered suggestions; reserve navigation and application workflows for explicit verbs.
- Root cause:
  - `poliedraCore.js` resolved exact `commandAliases` before intent classification and returned `directNavigation`.
  - `intentEngine.js` promoted exact bare navigation labels/aliases to `NAVIGATE`.
  - `Poliedron.jsx` correctly executed any returned `directNavigation`, so those two upstream paths closed the panel for bare input.
  - `prescriptionWorkflow.js` accepted bare `ric`/`ricetta` as create requests.
  - `navigationIndex.js` incorrectly treated `fattura`/`fatture` as Pagamenti aliases.
- Completed work:
  - Removed the bare-alias execution shortcut and the bare-label `NAVIGATE` classification. Exact aliases remain reusable for deterministic target resolution only after an explicit navigation verb.
  - Added ranked, permission-filtered alias suggestions behind the existing approved suggestion board. Typing dynamically reranks the existing Navigate and Create/Workflow cards without CSS, layout, dock, Orb, or Edge Dock redesign.
  - Added real virtual destinations for Fatture (`archivio` + `filtroTipo=fattura`) and Ricette (`archivio` + `filtroTipo=ricetta`). Selecting either card applies the existing Archivio filter hint before navigation.
  - Removed Fatture aliases from Pagamenti. `fat`/`fatture` rank Fatture first; Pagamenti remains a separate concept.
  - Made `ric` deliberately return both permitted Ricette and Richiami, with Ricette first for `ric`/`ricetta` and Richiami first for `richiamo`.
  - Gated direct navigation behind `apri`, `vai`, `portami`, `mostra`, or `mostrami`, including Italian articles/prepositions (`vai ai pagamenti`, `vai in agenda`). Explicit Fatture/Ricette navigation retains real Archivio filter metadata.
  - Gated create/update behavior behind `crea`, `nuovo/a`, `aggiungi`, `inserisci`, `prepara`, `registra`, `modifica`, `aggiorna`, or `segna`. Bare `ricetta Rossi` and `pagamento Rossi` remain non-writing searches.
  - Preserved the real Action Registry workflows, Quick Booking, patient ambiguity handling, medication-only Ricetta prefill, clinical review/confirmation, permission filtering, request sequencing, and the sole existing `modelGateway.js` fallback. Live deterministic search never calls the model; unresolved submitted questions still use the existing gateway.
  - Preserved the approved top universal input, “Dove vuoi lavorare?”, Navigate and Create/Workflow sections, premium cards, responsive panel layout, mobile standalone polyhedron/dock/recede behavior, and desktop Edge Dock.
- Files changed:
  - Core/ranking: `src/lib/poliedron/commandAliases.js`; `src/lib/poliedron/intentEngine.js`; `src/lib/poliedron/navigationIndex.js`; `src/lib/poliedron/poliedraCore.js`; `src/lib/poliedron/prescriptionWorkflow.js`; `src/lib/poliedron/searchEngine.js`.
  - Existing UI routing only: `src/components/poliedron/Poliedron.jsx`; `src/components/poliedron/PoliedronPanel.jsx`.
  - Regression coverage: `tests/poliedron.test.mjs`; `tests/poliedronAdaptive.test.mjs`.
  - Coordination: `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No migration, schema, Supabase, RLS, RBAC, auth, financial formula, clinical storage, production data, or production-state change.
- Dependency changes: none. A browser runner was installed transiently with `--no-save` for QA; package manifests and lockfile are unchanged.
- Tests executed: `npm test`; targeted Poliedron tests; `npm run build`; `git diff --check`; conflict-marker scan; added-secret scan; dependency-manifest check; changed-path/scope inspection; real Chrome browser interaction and visual QA through a temporary exact-component harness removed before handoff.
- Test results: 188/188 Node tests pass. Production build passes with only the unchanged `pdfjs-dist` eval, malformed legacy CSS-comment, and large-chunk warnings.
- Browser QA: 13/13 Chrome runs pass. The responsive matrix covered 375x812, 390x844, 430x932, 768x1024, 1024x900, and 1440x900 in Light and Dark. Every run verified the approved visual headings/cards, `fat` Fatture suggestion without closure, `ric` Ricette/Richiami ambiguity, Rossi patient result, no navigation side effects, panel bounds, no horizontal overflow, mobile dock recede, and desktop Edge Dock expanded state. A separate real interaction run verified `apri fatture` closes only after explicit navigation and emits `filtroTipo=fattura`, while `crea ricetta per Rossi Amoxicillina 875mg` shows clinical review and invokes the existing prescription handler with only the real patient id and medication text. Screenshots are retained outside the repository in the session artifacts; the harness and Playwright result files were deleted.
- Unresolved issues: none in this revision's scope.
- Risks: alias and clinical interpretation remain intentionally conservative. Ambiguous or unsupported language stays inside Poliedron or reaches the existing Model Gateway only after explicit submit rather than guessing or writing.
- Rollback: revert the suggest-first revision commit. No database, data, RLS, dependency, deployment, or production rollback is required.
- Deployment impact: frontend bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews the updated existing draft PR #41. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-UI-012 Mobile Document KPI sizing

- Task ID: POL-UI-012.
- Previous agent: COPILOT on the merged POL-AI-002B task; Product Owner authorized this new hotfix directly after PR #41 merged.
- Branch: `lucasimondi-pol-ui-012-mobile-document-kpis`, based on `master@c82b69a`.
- Objective: correct the three top Documenti KPI tiles so monetary values remain proportionate and contained at 375px, 390px, and 430px without changing tablet/desktop presentation or shared `StatCard` behavior elsewhere.
- Completed work:
  - Replaced ArchivioDocs' inline fixed three-column wrapper with a page-scoped `.pol-document-stats` contract.
  - Preserved three equal `minmax(0, 1fr)` columns above 520px and switched only narrow phones to one full-width KPI row per card, matching the Product Owner's mobile one-column direction.
  - Added Documenti-scoped `max-width`, `overflow-wrap`, and tabular-number protection for unusually long currency values. The shared `.pol-stat-card` mobile icon, spacing, typography, and all other callers remain unchanged.
  - Added a focused source/CSS regression test covering the page-scoped class, desktop/tablet columns, narrow-phone column switch, overflow containment, and absence of a global `StatCard` override.
- Files changed: `src/components/ArchivioDocs.jsx`; `src/components/PremiumVisualSystem.css`; `tests/archivioDocsResponsive.test.mjs`; `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase, schema, migration, RLS, RBAC, auth, clinical, financial, tenant, production-data, or production-state change.
- Dependency changes: none. `npm ci --ignore-scripts` restored the existing lockfile dependencies locally after the build reported the repository checkout had no installed Vite binary; manifests and lockfile are unchanged.
- Tests executed: `node --test tests/archivioDocsResponsive.test.mjs`; `npm test`; `npm run build`; `git diff --check`; conflict-marker scan; added-secret scan; changed-path/scope inspection; real Chrome DevTools device-emulation QA using a temporary local synthetic harness and the shipped `PremiumVisualSystem.css`.
- Test results: focused tests 2/2 pass; full Node suite 190/190 passes; production Vite build passes. Only the pre-existing `pdfjs-dist` eval warning, malformed legacy CSS-comment warning, large-chunk warnings, and existing npm audit findings remain unchanged and out of scope. Diff, conflict-marker, added-secret, and changed-path checks pass.
- Browser QA: Chrome passed 375x812, 390x844, and 430x932 in both Light and Dark (six runs). Each exact emulated viewport rendered one KPI column, no page-level horizontal overflow, and all synthetic long currency values and labels inside their card bounds. Theme colors were asserted from computed styles. No production data or remote backend was used; the temporary harness and Chrome profile were removed.
- Unresolved issues: none in POL-UI-012 scope.
- Risks: the 520px breakpoint intentionally changes only narrow-phone Documenti KPI layout. Devices above it retain the prior three-column design; shared `StatCard` consumers are unaffected.
- Rollback: revert the POL-UI-012 commit. No database or data rollback is required.
- Deployment impact: frontend CSS/markup bundle only; no deployment performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews draft PR #42. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-004 Poliedron Proactive Intelligence Engine

- Task ID: POL-AI-004.
- Previous agent: COPILOT completed POL-UI-012; the Product Owner authorized
  POL-AI-004 through the coordinating session and transferred ownership to
  this dedicated worktree.
- Branch: local app-managed
  `lucasimondi-feature-pol-ai-004-proactive-intelligenc`, based on
  `master@93dfe6a` with merged PR #43. The exact requested remote branch is
  `feature/POL-AI-004-proactive-intelligence`.
- Objective: implement a reusable deterministic, explainable,
  permission-aware and tenant-safe Poliedron intelligence layer that audits
  canonical data, identifies patient opportunities and data-quality gaps,
  separates priority from confidence, exposes non-clinical Studio Data Health,
  consumes zero model tokens while scanning, and renders grouped results
  inside the approved Poliedron UI.
- Mission alignment: implementation follows
  `docs/mission/POLIEDRA_MISSION.md`: facts first, deterministic scanners and
  scoring second, Poliedron presentation third, model interpretation only
  where it adds language value. The scanner is READ + RECOMMEND only.
- Completed work:
  - audited the existing App/DB contracts for patients, plans and plan voices,
    appointments, recalls, configured prevention/hygiene and activities;
  - added tenant-filtered, indexed scanners for future appointments,
    reliably unfinished accepted care, recalls, prevention, explicit/unique
    patient activities, required workflow completeness and stale quote
    follow-up;
  - made missing/ambiguous execution state Data Quality rather than unfinished
    treatment, and made no-future-appointment evidence supporting only;
  - added exact transparent weights, confidence and missing-data penalties,
    human-readable reasons, source/sourceId context, stable grouping and
    deterministic ordering;
  - added explicitly non-clinical Studio Data Health, including `Non
    disponibile` for unauthorized/unevaluable scope rather than a false 100;
  - added a bounded five-minute in-memory cache keyed by studio, scanner
    version, date, vertical, permissions and relevant source fingerprint;
  - added semantic deterministic routing for appointment candidates,
    callbacks, at-risk/lost patients, unfinished care, no next appointment,
    incomplete records and Studio Data Health;
  - added `DA CONTATTARE` / `DATI DA COMPLETARE` patient cards, visible
    reasons, priority/confidence and `Apri paziente` inside the existing panel;
  - preserved mobile Orb/dock and desktop Edge Dock architecture with no
    Poliedron redesign and no scanner write/action path.
- Permission/security review:
  - a dedicated security review found that the first implementation collapsed
    PT/massage `clinicalContent` into tenant-wide facts. Fixed by deriving
    intelligence permission from exact capabilities: only
    `clinical.general`/`clinical.physiotherapist` can expose plans; assignment-
    bound PT/massage capabilities fail closed without authoritative patient
    scope;
  - a high-confidence code review found ordinary calendar commitments could
    become contact recommendations, unrelated recalls could suppress hygiene,
    unevaluable Data Health could report 100, and UTC date boundaries could
    shift Italian-day classification. Fixed with explicit open-task state,
    same-window clinical recall de-duplication, unavailable health state and
    local calendar-date derivation;
  - the final correctness pass also found optimistic inserts were not merging
    authoritative `studio_id`, statusless plans skipped independent execution
    quality, unrelated clinical recalls could still suppress hygiene, and an
    undated hygiene record could make chronology ambiguous. Fixed by merging
    complete saved rows, continuing status-independent checks, requiring an
    explicit hygiene recall subject, and downgrading ambiguous chronology to
    Data Quality. The closure pass also made unresolved explicit activity
    patient IDs fail closed without name fallback and corrected hygiene due
    today so only strictly past dates are called overdue.
- Files changed:
  - wiring/routing/permissions: `src/App.jsx`,
    `src/lib/poliedron/poliedraCore.js`,
    `src/lib/poliedron/permissionEngine.js`,
    `src/components/poliedron/Poliedron.jsx`,
    `src/components/poliedron/PoliedronPanel.jsx`;
  - approved-panel result UI:
    `src/components/poliedron/PoliedronIntelligenceResults.jsx`;
  - intelligence engine: all files under
    `src/lib/poliedron/intelligence/`;
  - regression coverage: `tests/poliedronIntelligence.test.mjs`;
  - architecture/source/scoring/cache/permission documentation:
    `docs/architecture/POL-AI-004-proactive-intelligence.md`;
  - coordination: `docs/coordination/current-task.md`,
    `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase schema, migration, RLS, RBAC, auth,
  financial formula, production data or production state changed.
- Dependency changes: none. `npm ci --ignore-scripts` restored locked local
  dependencies after the initial build found Vite absent. `playwright-core`
  was installed transiently with `--no-save --package-lock=false` for Chrome
  QA; package manifests and lockfile are unchanged.
- Tests executed:
  - focused POL-AI-004/Poliedron suites throughout implementation;
  - final full `npm test`;
  - final `npm run build`;
  - `git diff --check`, conflict-marker scan, added-secret scan,
    dependency-manifest/schema/scope inspection and `npm audit`;
  - real Chrome synthetic-component QA at 390x844, 768x1024 and 1440x900 in
    Light and Dark;
  - dedicated security review and high-confidence code review.
- Test results: final full Node suite passes 225/225. It includes all required
  A-N cases, explainability, complete workflow/no optional-field penalty,
  deterministic Studio Data Health, tenant/cache separation, capability and
  5,000-patient indexed performance coverage. The production Vite/PWA build
  passes. Only the pre-existing `pdfjs-dist` eval warning, malformed legacy
  CSS comment warning and large-chunk warnings remain.
- Performance: the 5,000-patient/plans synthetic scan, including future
  appointment and name-indexed activity data, completes in the observed local
  range of approximately 0.82–2.36 seconds under concurrent load, below the
  five-second regression ceiling.
  Complexity is linear for filtering/indexing/scanning plus `O(K log K)`
  result ordering; no patient-by-plan or activity-by-patient full nested scan.
- Browser QA: six of six Chrome cases pass. Every case verifies both result
  groups, two patient actions, panel/article bounds, no horizontal overflow,
  and correct theme. 390 verifies the full-screen mobile panel and receded,
  non-interactive mobile dock; 768/1440 verify desktop panel mode and the
  existing expanded-state Edge Dock. Screenshots are retained only in session
  artifacts; the temporary harness and runner files were deleted.
- Dependency/security result: `npm audit` reports the repository's unchanged
  existing 9 advisories (2 moderate, 5 high, 2 critical). POL-AI-004 changes
  no dependency file and adds no package. Diff secret/conflict scans pass.
- Unresolved issues/limitations:
  - `impegni_personali` has no canonical patient relation; ordinary calendar
    items are ignored, and only explicit open-task state plus explicit patient
    id or one unique exact full name can produce a signal;
  - PT/massage intelligence remains fail closed until an authoritative
    assigned-patient scope is available to Poliedron;
  - prevention requires recorded execution and configured due dates and is
    currently limited to reliable dental hygiene representation;
  - cache is browser-process memory only; shared persistent/incremental cache
    requires a future separately approved server-side design.
- Risks: the engine reads the same RLS-scoped snapshots already loaded by App
  and filters exact `studio_id` again. Browser capability checks minimize data
  but do not replace RLS. No production data was used.
- Rollback: revert the POL-AI-004 commits. No database, data, migration,
  dependency, production or deployment rollback is required.
- Deployment impact: frontend bundle only; no deploy performed.
- Commit: implementation commit
  `33e0f58f196505304d05f53321272054887f540c` with the required Copilot
  co-author trailer.
- Pull request: new draft PR #45,
  `https://github.com/lucasimondi/Dental-manager-claude/pull/45`, from exact
  remote branch `feature/POL-AI-004-proactive-intelligence` to `master`.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews draft PR #45. Do not merge or
  deploy without explicit approval. Status:
  `WAITING_PRODUCT_OWNER`.
## POL-UI-013 Dashboard modular workspace + Poliedron centrality (Phase 1)

- Task ID: POL-UI-013.
- Previous agent: COPILOT on the merged POL-UI-012 task; Product Owner authorized this new task directly (Phase 1 of a broader app-wide premium workspace redesign, Dashboard/Home only — other pages explicitly out of scope).
- Branch: `feature/POL-UI-013-dashboard-modular-workspace`, based on `master@93dfe6a` (POL-UI-012 merged).
- Objective: make Poliedron more central on the Dashboard, rename "Consigli AI" to "Consigli Poliedron", fix the existing personalization save/persistence bug, add touch-compatible drag & drop and small/medium/large resize, and raise the Dashboard's visual system to a professional/premium standard — reusing and extending the existing POL-UI-001/POL-UX-001 widget registry and persistence architecture rather than building a second one.
- ROOT_CAUSE_PERSONALIZATION_BUG: the app-layer save/load code (`src/lib/homeLayoutPersistence.js`) and the `user_home_layouts`/`studio_home_layouts` migrations' RLS policies are logically correct and internally consistent — no code-level bug was found there. Direct repository evidence (three separate POL-UI-001 handoff entries above: "Phase 1 handoff", "pre-merge residual-risk handoff", "master realignment handoff") states those migrations were applied only to a disposable local PostgreSQL 17 instance and were never applied to the production Supabase project. The tables (and their RLS) most likely do not exist in production, so every real save/load call fails there. A second, genuinely client-side bug was also found: `openHomeCustomizer()` unconditionally cleared the only error state (`layoutError`) on every modal open, and that state was rendered only inside the modal itself — so a failed background load's error was silently wiped the instant the user opened "Personalizza Home" to check or redo their settings, making a real backend failure indistinguishable from "my personalization doesn't save."
- PERSISTENCE_FIX: split the single error state into `layoutError` (save-scoped, cleared on modal open, unchanged) and a new `loadError` (page-level, persistent, cleared only by a load that actually succeeds). Added a persistent page-level banner (`data-testid="home-layout-load-error"`) with a "Riprova" retry button wired to a new `homeLayoutReloadToken` state that re-triggers the load effect. No schema, RLS, or migration changes were made — see PRODUCT_OWNER_DECISION_REQUIRED below.
- POLIEDRON_CENTRALITY: the `consigli_ai` widget (internal id kept stable for backward compatibility with already-persisted layouts) is now rendered as a distinct first-class "Consigli Poliedron" widget with its own premium surface, the real Poliedra gem asset (`src/assets/icon-poliedra-gem.png`, reused from `PoliedronOrb.jsx`), an indigo/violet identity, and a "POLIEDRON" eyebrow label — using only the existing real `ai_agent_consigli` data/logic (`rigeneraConsigli`, `segnaLettoConsiglio`), no fabricated content.
- WIDGET_REGISTRY: `src/lib/homeWidgetRegistry.js` now derives `minSize`/`maxSize` for every entry from each widget's own `sizes` array (`withSizeBounds`), so they cannot drift out of sync. `consigli_ai` gained `variant: 'poliedron'` and label `"Consigli Poliedron"`. No `component` field was added — documented honestly as a Phase 2 follow-up since Dashboard.jsx still dispatches markup by id, not by component reference.
- EDIT_MODE: unchanged — the existing "Personalizza Home" modal, explicit "Annulla" (cancel-without-saving) and "Reset al default" buttons were already present and already satisfy the Product Owner's save/cancel/reset model; verified, not rebuilt.
- DRAG_DROP: added a second, independent touch-compatible mechanism using the Pointer Events API (`src/components/WidgetWorkspace.jsx`, matching the existing pattern in `usePoliedronPosition.js`) alongside the existing native HTML5 mouse drag (kept unchanged). Active only from the drag handle so a tap/scroll inside a widget never starts a drag by accident; `touch-action: none` added to the handle to stop the browser's native touch-scroll from fighting the drag.
- RESIZE_MODEL: the existing S/M/L buttons (already labeled small/medium/large in the UI) gained `aria-label`/`aria-pressed` for accessibility; the internal size enum stays `'small'|'medium'|'wide'` for backward compatibility with already-persisted layouts, presented to users as small/medium/large.
- VISUAL_SYSTEM / COLOR_SYSTEM / TYPOGRAPHY / KPI_IMPROVEMENTS: reused the existing `--pol-*` design token system (`src/styles/designTokens.css`) and the existing `CanonicalFinancialWidget.css` KPI styling (already implementing clamp()-based sizing, overflow-wrap, tabular-nums, per-metric semantic color) — both already satisfied the Product Owner's professional/premium and KPI-overflow requirements before this task. New CSS is limited to the `.home-poliedron-widget` surface and a lightweight `.home-widget-frame--dragging` pick-up state, all using existing tokens (`var(--pol-indigo-500)`, `var(--radius-lg)`, `var(--shadow-sm)`), with an explicit dark-theme override block.
- LIGHT_DARK: verified via real Chrome/Playwright QA (see below) including `getComputedStyle` assertions, not just visual screenshots.
- RESPONSIVE_QA: real Chromium (`/opt/pw-browsers/chromium`) driven by Playwright, at 375, 390, 430, 768, 1024, 1440 px x Light/Dark (12 combinations), using a temporary uncommitted harness that imported the real `WidgetWorkspace.jsx`, `homeWidgetRegistry.js`, `CanonicalFinancialWidget.jsx`, and the real CSS/gem asset (deleted before this handoff, per the established POL-AI-002B/POL-UI-012 precedent — the live app cannot be safely mounted here since it targets the real production Supabase project). All 12 combinations passed: no horizontal overflow, Poliedron widget correctly proportioned (not a giant banner), no KPI overflow on a synthetic long value, resize control accessible and functional, `touch-action: none` present, pointer-based drag functional, zero console errors.
- TESTS: `tests/dashboardPersonalization.test.mjs` (new, 18 tests) covers every item in the Product Owner's explicit list — save/reload round-trip, order persistence, size persistence, visibility persistence, invalid/narrowed size fallback, permission-gated widget force-hidden, config-less legacy layout compatibility, unknown/retired widget id dropped safely, minSize/maxSize derivation, load-vs-save error separation, the Consigli Poliedron rename with stable id, absence of "Consigli AI" text, the premium surface/gem asset, pointer-based drag support, and accessible S/M/L labeling.
- FILES_CHANGED: `src/components/Dashboard.jsx`; `src/lib/homeWidgetRegistry.js`; `src/components/PremiumVisualSystem.css`; `src/components/WidgetWorkspace.jsx`; `src/components/WidgetWorkspace.css`; `tests/dashboardPersonalization.test.mjs` (new); `docs/coordination/current-task.md`; `docs/coordination/handoffs.md`.
- Database changes: none. No Supabase schema, migration, RLS, RBAC, auth, financial formula, canonical KPI calculation, patient data logic, or Poliedron AI engine change.
- Tests executed: `npm test`; `npm run build`; `git status --short` scope check; real Chrome/Playwright responsive QA at 6 breakpoints x 2 themes with a temporary harness removed before handoff.
- Test results: 208/208 Node tests pass (190 pre-existing + 18 new). Production build passes with only the pre-existing `pdfjs-dist` eval, malformed legacy CSS-comment, and large-chunk warnings, all unchanged and out of scope. All 12 browser QA combinations passed every check with zero console errors.
- Unresolved issues: none in POL-UI-013's own code scope. The production persistence gap (migrations never deployed) is an infrastructure/deployment gap, not a code defect, and is recorded below.
- Risks: none introduced by this change to existing behavior; the pointer-drag mechanism is purely additive alongside the unchanged native HTML5 drag. `consigli_ai`'s internal id was deliberately left unchanged to avoid silently breaking already-persisted layouts.
- Rollback: revert the POL-UI-013 commit. No database or data rollback is required, since no schema/data change was made.
- Deployment impact: frontend bundle only; no deployment performed. Fixing the actual persistence root cause requires a separate, explicit production migration deployment — see below.
- Product Owner decision required: `PRODUCT_OWNER_DECISION_REQUIRED` — the `user_home_layouts`/`studio_home_layouts` migrations from POL-UI-001 (`supabase/migrations/20260819150436_pol_ui_001_user_home_layouts.sql`, `supabase/migrations/20260819174435_pol_ui_001_studio_home_layout_default.sql`) appear, per this file's own prior handoff entries, to have never been applied to the production Supabase project. Both migrations were re-read this task and are logically correct (proper RLS on SELECT/INSERT/UPDATE/DELETE, `auth.uid()` checks, active-membership checks). This task did not apply them to production and did not author any new migration, per the explicit "STOP and return PRODUCT_OWNER_DECISION_REQUIRED. Do not create migrations silently" instruction. The Product Owner must explicitly authorize and execute (or delegate) applying these two existing migrations to the production database before Dashboard personalization can actually persist for real users; the client-side observability fix in this task (the `loadError` banner + retry) makes that failure visible in the meantime instead of silently discarding user customization.
- REUSABLE_COMPONENTS: `WidgetWorkspace.jsx`'s pointer-based drag mechanism, the `.home-widget-frame`/`.home-widget-grid` responsive grid contract, and the `minSize`/`maxSize`-bearing widget registry shape are all page-agnostic and intended for reuse on Pazienti/Agenda/Controllo di Gestione/Documenti/other pages in later phases, per the task's explicit Phase 1 scoping — not implemented on those pages in this task.
- LIMITATIONS: full keyboard-only drag reordering is not implemented — the existing up/down move buttons (`Sposta su`/`Sposta giù`) remain the keyboard-accessible path for reordering, documented here as an explicit, intentional Phase 1 limitation rather than a silent gap. The registry's `component` field from the Product Owner's §5 shape was intentionally omitted rather than faked, for the reason given under WIDGET_REGISTRY above.
- Exact next action: Product Owner reviews draft PR, decides on the production migration deployment flagged above, and reviews before any merge. Do not merge or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-UI-013B Production personalization migration audit — STOPPED, decision required

- Task ID: POL-UI-013B.
- Previous agent: this session's own POL-UI-013 work (draft PR #44, `feature/POL-UI-013-dashboard-modular-workspace`); Product Owner directly authorized this follow-up audit-and-deploy task to close the `PRODUCT_OWNER_DECISION_REQUIRED` item that same PR raised.
- Branch: `feature/POL-UI-013-dashboard-modular-workspace` (no new branch — documentation-only correction, no schema/code change).
- Objective: verify whether `supabase/migrations/20260819150436_pol_ui_001_user_home_layouts.sql` and `supabase/migrations/20260819174435_pol_ui_001_studio_home_layout_default.sql` are actually applied to the production Supabase project (`idklxdqebfceplrualgh`, "DentalManager"), and if genuinely missing and safe, apply only those two existing migrations — then run live Dashboard personalization QA.
- MIGRATIONS_FOUND: exactly the two expected migrations, unmodified, already reviewed in the POL-UI-013 handoff above. No duplicate or second migration was authored for this task.
- **Finding that stopped this task before any production write**: read-only inspection of the actual production database (`mcp__Supabase__list_migrations`, `list_tables`, and a direct `pg_policies` query — all read-only) shows both migrations are **already applied** to production, correctly:
  - `list_migrations` includes `20260819191541 pol_ui_001_user_home_layouts` and `20260819191558 pol_ui_001_studio_home_layout_default` in the applied migration history (timestamps differ slightly from the local filenames' timestamps — consistent with normal Supabase migration-apply timestamping, not a sign of a different/altered migration).
  - `public.user_home_layouts` and `public.studio_home_layouts` both exist, `rls_enabled: true`, and already carry 1 row each — i.e. real personalization saves have already succeeded in production at least once.
  - Every column, type, default, CHECK constraint, and primary key on both tables matches the local migration files exactly (`studio_id`/`user_id`/`layout` jsonb array-typed/32KB-capped/`schema_version=1`/`updated_at` on `user_home_layouts`, PK `(studio_id,user_id)`; `studio_id`/`layout`/`schema_version`/`updated_by`/`updated_at` on `studio_home_layouts`, PK `studio_id`).
  - All 8 RLS policies (4 per table) were pulled directly from `pg_policies` and match the migration files' `USING`/`WITH CHECK` clauses byte-for-byte in logic: `user_home_layouts` is strictly own-row (`user_id = auth.uid()`) gated by active studio membership; `studio_home_layouts` is active-member-read / active-admin-write (`ruolo='admin'`), exactly the intended user-vs-studio ownership split.
  - `get_advisors(type=security)` returned no findings referencing either table.
- **This directly contradicts the POL-UI-013 handoff's documented root cause**, which — based on three POL-UI-001 handoff entries stating migrations were "applied only to disposable local PostgreSQL 17" / "no remote or production database change occurred" — concluded these tables likely did not exist in production. That conclusion was a reasonable inference from the evidence available at the time (those statements were true descriptions of what *that session's own actions* did, not a permanent guarantee that no later, separate deployment step ever applied them), but it is **factually superseded** by this session's direct production read. Per this task's explicit instruction ("If migration state differs from documentation... STOP before production changes and return PRODUCT_OWNER_DECISION_REQUIRED"), this task stopped here. **No `apply_migration` call was made — there was nothing to apply, and attempting to re-apply an already-applied migration was correctly avoided.**
- PRODUCTION_STATE_BEFORE = PRODUCTION_STATE_AFTER: unchanged by this task. Both tables already existed, RLS-correct, before this audit began; this task made zero writes to the production database (only read-only `list_migrations`/`list_tables`/`pg_policies`/`get_advisors` calls).
- MIGRATIONS_APPLIED: none (already applied prior to this task, by a means outside any recorded agent session — most likely a Product Owner-run `supabase db push`/dashboard action after POL-UI-001 merged, or a CI/CD deploy step not visible in `docs/coordination/handoffs.md`).
- LIVE_SAVE_QA / REFRESH_QA / LOGOUT_LOGIN_QA / CANCEL_QA / RESET_QA / MULTITENANT_QA / PERMISSION_QA: **not performed.** Driving the real Dashboard against production requires authenticating as a real production user, which this sandbox must never do — the app's Supabase client is hardcoded to the live production project (`src/lib/supabase.js`), and every prior task in this repository's history (POL-AI-002B, POL-UI-012, POL-UI-013 itself) explicitly established and followed the rule that this sandbox never logs into that real project, using temporary source-accurate local harnesses instead specifically to avoid touching real patient/financial/tenant data or credentials. This task's own live-QA steps (A–F) require exactly that login, so they were not attempted; see Product Owner decision below.
- Since the tables, RLS, and schema already match the approved migrations exactly, the actual remaining question is no longer "should we deploy" but "does the client-side symptom fix from the POL-UI-013 handoff (the `loadError`/retry banner) now correctly report success instead of the previous silent failure" — that requires either a real logged-in QA pass by someone with production access, or a Product Owner decision to authorize this sandbox to authenticate against production for this one verification (against the repo's own established precedent not to).
- ERRORS: none encountered; no failed writes, no RLS denials observed (no writes were attempted).
- Files changed: `docs/coordination/handoffs.md` (this entry), `docs/coordination/current-task.md` (status/next-action correction). No source code, no migrations, no schema change.
- Database changes: **none.** Confirmed via read-only queries only.
- Product Owner decision required: `PRODUCT_OWNER_DECISION_REQUIRED` —
  1. The documented root cause in the POL-UI-013 handoff is now known to be outdated: the production tables/RLS already exist and are correct. Please confirm whether they were deployed intentionally (and if so, by what process, so `docs/coordination/handoffs.md` can record the real deployment history instead of the now-superseded "never applied" statement) or whether this is unexpected and needs investigation on your side.
  2. Steps A–F (live Dashboard QA: save/refresh/logout-login/cancel/reset/multitenant/permission checks) require authenticating as a real production user against `idklxdqebfceplrualgh`. This sandbox will not do that without your explicit authorization, given the repository's own established safety precedent. If you want this QA performed by an agent, please either (a) authorize and supervise a session with real production credentials, or (b) perform steps A–F yourself and report back, or (c) provide a disposable/staging Supabase project so an agent can validate the identical schema safely. Whichever you choose, the underlying schema/RLS this session verified is already correct and should support all six scenarios (A–F) as designed, based on the policy definitions read from production.
- Exact next action: Product Owner reviews this finding and PR #44, decides on the QA-authentication question above, and confirms/corrects the deployment-history record. Do not merge PR #44 or attempt any further production write without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-UI-013C Personalization save/load root cause — application-side race condition found and fixed

- Task ID: POL-UI-013C.
- Previous agent: this session's own POL-UI-013/POL-UI-013B work (draft PR #44, `feature/POL-UI-013-dashboard-modular-workspace`); Product Owner directly authorized this deeper application-side trace after POL-UI-013B confirmed the database layer (schema/RLS) was already correct in production.
- Branch: `feature/POL-UI-013-dashboard-modular-workspace` (continuing PR #44). No database, migration, RLS, or RBAC change — per explicit instruction, none was made or attempted.

### SAVE_FLOW

`saveHomeCustomization()` in `src/components/Dashboard.jsx`: triggered by the "Salva Home" button (present on both the Widget tab and the Azioni rapide tab — one shared handler, since both tabs edit the same `draftWidgets` array). Guard: requires `studioId`/`userId`, else sets `layoutError` and returns. Two branches on `draftInherits`:
- `draftInherits === true` (user has no personal layout, or clicked "Ripristina predefinito"): `deleteUserHomeLayout` removes the user's row, then `loadResolvedHomeLayout` re-resolves to whatever the studio/role/platform default now is.
- `draftInherits === false` (normal edit): `saveUserHomeLayout(supabase, studioId, userId, draftWidgets)` — upserts `{studio_id, user_id, layout: serializeHomeLayout(draftWidgets), schema_version: 1, updated_at}` onto `user_home_layouts` with `onConflict: 'studio_id,user_id'`, matching the table's real primary key exactly. Local `widgets`/`draftWidgets` state is then set directly from the function's return value (the exact serialized/normalized payload that was sent), not from a second read — so success state is always internally consistent with what was actually upserted. On any thrown error (network/RLS), the outer `catch` sets `layoutError` and the modal stays open (`setSettingsOpen(false)` is only reached on the non-throwing path).

### LOAD_FLOW

A `useEffect` in `Dashboard.jsx`, keyed on `[studioId, userId, JSON.stringify(capabilities), homeLayoutReloadToken]`, calls `loadResolvedHomeLayout` (`src/lib/homeLayoutPersistence.js`), which runs `loadUserHomeLayout` and `loadStudioHomeLayout` in parallel and resolves precedence via `resolveDashboardLayout` (`src/lib/homeDashboardModel.js`): **user layout, if present, wins outright; else studio default; else the role preset computed from the caller's capabilities; else the platform's hard-coded default registry order.** Each loaded layout is passed through `normalizeHomeLayout`, which drops unknown/retired widget ids, falls back any size no longer in a widget's allowed set to that widget's default, and defaults `visible`/`config` safely — so a layout written by an older app version cannot corrupt or discard the whole layout, only the specific entries that no longer make sense. The effect uses the standard React `cancelled` closure-flag pattern, so a stale in-flight request from a prior effect invocation can never overwrite a newer one.

### USER_STUDIO_PRECEDENCE

Verified correct and exactly as intended: `resolveDashboardLayout({userLayout, studioLayout, roleLayout})` returns, in order, `userLayout` if present, else `studioLayout`, else `roleLayout`, else the platform default (`src/lib/homeDashboardModel.js:25-30`). Confirmed both by the pre-existing pure-function test and by a new integration test exercising the real async `loadResolvedHomeLayout` DB path end to end with both a user row and a studio row present simultaneously (user still wins). No inversion, no accidental overwrite of user by studio, found anywhere in this path.

### ROOT_CAUSE

**Confirmed by code inspection, not speculation.** The persistence primitives (registry normalize/move/resize, Supabase load/save, precedence resolution) are all correct — POL-UI-013's existing test suite already proves this in isolation. The actual defect is a **state race in `Dashboard.jsx`'s background load effect**: its success handler unconditionally called both `setWidgets(layout)` **and** `setDraftWidgets(layout)` **and** `setDraftInherits(source !== 'user')`. `draftWidgets`/`draftInherits` are the *live, in-progress edit state* of the "Personalizza Home" modal — meaningful only while the modal is open, and already freshly re-derived from the committed `widgets` by `openHomeCustomizer()` every time the modal opens. If this background load effect resolved **while the modal was already open** — most plausibly because the user opened "Personalizza Home" before the very first page-load's layout fetch had finished (a realistic, ordinary click, not an edge case), or because a manual "Riprova" retry fired while editing — its `.then()` handler silently overwrote whatever the user was actively editing in the modal with the just-fetched server layout, with zero visual indication. A user who kept editing after that reset, or clicked Save without noticing the widget list had snapped back, would then save the **old** layout, not their edit — producing exactly the reported symptom: "I changed my layout, saved, and it doesn't seem to persist." Because this is a timing-dependent UI race, not a data-corruption bug, every existing pure-function/Supabase-mock test passed while this was present — it could only be found by tracing the actual component state flow, as requested.

A second, narrower, related defect was found in the same audit (§5, "verify save success is real"): in the `draftInherits === true` (reset-to-default) branch, if `deleteUserHomeLayout` succeeded but the immediately following `loadResolvedHomeLayout` call then failed (e.g. a transient network blip), the outer `catch` reported "Salvataggio non riuscito. Nessuna modifica è stata applicata." — which was **false**: the delete had already succeeded server-side. This is real but much narrower in practice (only the Reset flow, only on a specific two-call partial failure), not the primary explanation for the general complaint.

### FIX

In `src/components/Dashboard.jsx`'s load effect: removed `setDraftWidgets(layout)` and `setDraftInherits(source !== 'user')` from the load success handler. Only `widgets` (and the inherited-default snapshot `inheritedLayout`/`inheritedSource`, which represents "what Reset restores to," not the user's in-progress edit) is kept in sync with the server in the background. `draftWidgets`/`draftInherits` are now *exclusively* set by `openHomeCustomizer()` (on modal open, already existed), the widget/resize/reorder edit handlers (already existed), and `resetHomeCustomization()`/`saveHomeCustomization()`'s own success paths (already existed) — never by the passive background loader. This makes it structurally impossible for a background reload to discard an open, unsaved edit.

For the second defect: the reset-to-inherit branch's post-delete reload is now wrapped in its own inner `try/catch`; on failure it falls back to the already-known `inheritedLayout`/`inheritedSource` in state (instead of leaving the stale pre-reset draft on screen) and does **not** fall through to the outer catch's "no changes were applied" message, since a real change (the delete) did happen.

### RACE_CONDITIONS

The one confirmed and fixed race is described above (background load vs. open, unsaved modal edit). Audited and found **not** to be a problem: the load effect's own `cancelled`-flag pattern correctly prevents a stale response from a superseded effect invocation from ever overwriting a newer one; `studioId`/`userId`/capabilities changes correctly gate re-fetching without spurious loops (`JSON.stringify` on the capabilities array avoids refiring on same-content-different-reference renders); the Save button is correctly `disabled` while a load is in flight (`layoutSaving || layoutLoading`), preventing a save race against the *initial* unresolved load — the residual race was specifically the *reverse* direction (a late-resolving load reaching into an already-open, already-being-edited modal), which is what this fix closes.

### BACKWARD_COMPATIBILITY

Re-audited every registry widget id against the normalization path: `normalizeHomeLayout` drops any persisted id no longer in `HOME_WIDGET_REGISTRY` (already covered by an existing test) rather than discarding the rest of the layout, and any persisted `size` no longer in a widget's current allowed set falls back to that widget's own default (also already covered). `consigli_ai`'s internal id remains unchanged (see the POL-UI-013 handoff). No change was needed here — confirmed correct, not touched.

### DIAGNOSTICS

Added `src/lib/homeLayoutDiagnostics.js`, exporting `logHomeLayoutEvent(event, detail)`, gated on Vite's `import.meta.env.DEV` (statically stripped from the production bundle's logic, not just runtime-hidden — verified via a passing production `npm run build`). Wired into `Dashboard.jsx` at every stage: `HOME_LAYOUT_LOAD_START`, `HOME_LAYOUT_LOAD_SOURCE` (user/studio/role/platform), `HOME_LAYOUT_NORMALIZED`, `HOME_LAYOUT_LOAD_SUCCESS`, `HOME_LAYOUT_LOAD_ERROR`, `HOME_LAYOUT_SAVE_START`, `HOME_LAYOUT_SAVE_SUCCESS`, `HOME_LAYOUT_SAVE_ERROR`. Only presentation-shape data is logged (widget counts, source label) — never raw studio/user identifiers, patient data, or secrets.

### TESTS

New file `tests/homeLayoutPrecedenceRace.test.mjs` (13 tests, all passing): full A–D precedence matrix through the real async `loadResolvedHomeLayout` path (including the previously-untested role-preset tier), a direct regression test asserting the load effect's code (comments stripped) no longer calls `setDraftWidgets`/`setDraftInherits`, a test confirming `openHomeCustomizer` still re-derives both fresh on open, a test for the reset-to-inherit partial-failure fix (separate inner `catch`), a save-error-is-visible test (J), an E/F save-then-reload round-trip test through the real async path, and diagnostics wiring/gating tests. Combined with the existing `tests/dashboardPersonalization.test.mjs` (18 tests) and `tests/homeWidgetRegistry.test.mjs`'s precedence test, this now covers the Product Owner's full A–J matrix.

### FILES_CHANGED

`src/components/Dashboard.jsx` (load effect + save handler); `src/lib/homeLayoutDiagnostics.js` (new); `tests/homeLayoutPrecedenceRace.test.mjs` (new); `docs/coordination/handoffs.md` (this entry); `docs/coordination/current-task.md`.

- Database changes: **none.** No migration, schema, RLS, or RBAC touched, per explicit instruction.
- Tests executed: `npm test` (221/221 pass — 208 pre-existing + 13 new); `npm run build` (passes, only pre-existing unrelated warnings); `git status --short` scope check.
- Unresolved issues: none confirmed. The two findings above are fixed. No further application-side defect was found in the save/load/precedence path after this trace.
- Risks: none introduced — the fix is a pure removal of two now-unnecessary state writes from a background effect (both already correctly handled elsewhere), plus an additive inner `try/catch`. No behavior change to the successful, non-racing path.
- Rollback: revert the POL-UI-013C commit. No database or data rollback needed.
- Deployment impact: frontend bundle only; no deployment performed.

### LIVE_QA_SCRIPT

Per explicit instruction, this task did **not** authenticate into production. The following short script is for the Product Owner (or an authorized session) to run against the real app:

1. Open Home (Dashboard) as a real studio user.
2. Click **Personalizza Home**.
3. Move one widget up or down (drag handle or the ↑/↓ buttons).
4. Resize a different widget (tap S/M/L).
5. Hide a third widget ("Rimuovi" on its row).
6. Click **Salva Home**.
7. Refresh the page (hard refresh, not just re-render).
8. Verify: the moved widget is in its new position, the resized widget kept its new size, the hidden widget is gone — exactly as left before refresh.
9. Log out, log back in as the same user.
10. Verify again: same result as step 8.

**If it fails, report:** (a) the browser DevTools **Console** tab — any red error, especially anything mentioning `user_home_layouts`, `studio_home_layouts`, `406`, `403`, `42501`, or `PGRST`; (b) the **Network** tab, filtered to `user_home_layouts` — the request method (should be `POST` with `Prefer: resolution=merge-duplicates` for the save, `GET` for the load) and its response status/body; (c) whether the page-level red banner ("La tua personalizzazione della Home non è stata caricata…") appeared at any point with a "Riprova" button — if so, that specifically means the *load* failed (distinct from a save failure, which shows its error inside the still-open modal instead). With `import.meta.env.DEV` diagnostics enabled (a local/dev build, not production), the Console will also show `[home-layout] HOME_LAYOUT_...` lines tracing exactly which stage ran and with what source/outcome.

- Product Owner decision required: none for this task — no schema/RLS/RBAC change was needed or made, matching the explicit constraint. The two POL-UI-013B open questions (deployment-history confirmation; how to authorize real production QA) remain open from that entry.
- Exact next action: Product Owner reviews this finding and PR #44 (now containing POL-UI-013 + the POL-UI-013B audit + this fix), and either runs the live QA script above or authorizes it to be run. Do not merge PR #44 without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-004 reconciliation with current master / merged POL-UI-013

- Task ID: POL-AI-004 continuation on existing draft PR #45.
- Previous agent: COPILOT; ownership remained on
`feature/POL-AI-004-proactive-intelligence`.
- Branch: local app-managed
`lucasimondi-feature-pol-ai-004-proactive-intelligenc`, tracking exact remote
PR branch `feature/POL-AI-004-proactive-intelligence`.
- Base integrated: `origin/master@590b8cafa71ed83a59adb4d6483839d1dfeddbb5`
(`POL-UI-013: Dashboard modular workspace + Poliedron centrality`, merged PR
#44).
- Objective: update the existing PR #45 without rewriting or discarding
POL-AI-004, preserve all current-master Dashboard personalization work,
verify combined behavior/security/responsiveness, and return the same draft
PR to MERGEABLE/CLEAN with green checks.
- Merge strategy: normal `--no-ff` merge of `origin/master`; no rebase or
published-history rewrite.
- Conflicts resolved:
- `docs/coordination/current-task.md`: kept POL-AI-004 as the active task,
  updated its reviewed base to `590b8ca`, and retained merged POL-UI-013 as a
  historical record;
- `docs/coordination/handoffs.md`: retained the complete POL-AI-004 handoff
  and all incoming POL-UI-013/POL-UI-013B/POL-UI-013C entries.
- No source, Dashboard, Poliedron, test or CSS conflict occurred.
- PR #44 compatibility:
- immediately after conflict resolution, `Dashboard.jsx`,
  `WidgetWorkspace.jsx`/CSS, `homeWidgetRegistry.js`,
  `homeLayoutDiagnostics.js`, `dashboardPersonalization.test.mjs` and
  `homeLayoutPrecedenceRace.test.mjs` matched `origin/master` exactly;
- all POL-AI-004 implementation files matched pre-merge PR head `39a11c0`
  exactly;
- current Dashboard keeps `Consigli Poliedron` with stable persisted id
  `consigli_ai`, modular registry/workspace, pointer/native drag, S/M/L
  resize and the background-load personalization race fix;
- the combined suite exposed one Windows-only test portability defect:
  PR #44's comment-stripping assertion split only on LF, so CRLF source made
  removed calls appear present. It now splits on `\\r?\\n`; product behavior
  is unchanged;
- real Chrome then confirmed two UI containment defects in the shipped
  combined stylesheet: narrow `Consigli Poliedron` content-box overflow and
  the desktop Poliedron pop animation ending at `transform:none`, which
  displaced the 768px panel. Fixed with box-sizing/min-width/wrapping
  containment and a keyframe that preserves `translateX(-50%)`, with focused
  tests.
- Intelligence regression:
- all A-N, explainability, confidence, Studio Data Health, cache,
  deterministic aggregate and 5,000-patient performance tests remain green;
- grouped `DA CONTATTARE` / `DATI DA COMPLETARE`, reasons, priority,
  confidence and `Apri paziente` remain intact;
- a final review found ordinary schedule questions such as "quali
  appuntamenti ho oggi?" matched the broad opportunity intent. The router now
  requires explicit appointment-need/contact language and includes negative
  schedule-query assertions.
- Security regression:
- dedicated security review reports no findings;
- assignment-bound PT/massage capabilities still fail closed without an
  authoritative patient scope;
- treatment-plan facts still require `clinical.general` or
  `clinical.physiotherapist`;
- inactive/missing membership and tenant identity fail closed;
- exact source-row `studio_id` filtering and cross-tenant tests remain green;
- cache remains tenant/version/date/permission/fingerprint scoped and memory
  only.
- Files changed by reconciliation:
- incoming master files from PR #44, preserved through the merge;
- conflict resolution:
  `docs/coordination/current-task.md`,
  `docs/coordination/handoffs.md`;
- compatibility fixes:
  `src/components/PremiumVisualSystem.css`,
  `src/lib/poliedron/intelligence/queryRouter.js`,
  `tests/dashboardPersonalization.test.mjs`,
  `tests/homeLayoutPrecedenceRace.test.mjs`,
  `tests/poliedronAdaptive.test.mjs`,
  `tests/poliedronIntelligence.test.mjs`.
- Database/dependency changes: none. No schema, migration, RLS, RBAC, auth,
financial formula, package manifest, lockfile, production data or production
state change.
- Tests executed:
- focused combined Dashboard/WidgetWorkspace/Poliedron/intelligence suites;
- full final `npm test`;
- final `npm run build`;
- `git diff --check`, conflict-marker, added-secret, dependency/schema/scope
  checks;
- dedicated security and correctness reviews;
- real Chrome synthetic exact-component QA.
- Test results: 258/258 Node tests pass, combining all 221 current-master tests
with POL-AI-004 and reconciliation regressions. Production Vite/PWA build
passes with only the unchanged `pdfjs-dist` eval, malformed legacy CSS
comment and large-chunk warnings.
- Browser QA: 12/12 exact-component Chrome runs pass: Poliedron proactive
results and Dashboard/WidgetWorkspace surfaces at 390x844, 768x1024 and
1440x900 in Light and Dark. Every run asserts correct theme, no page or
component overflow and zero console/page errors. Poliedron runs additionally
assert both required groups, two patient actions, panel bounds, mobile dock
recede or desktop Edge Dock. Dashboard runs assert the modular workspace,
three bounded widget frames and visible `Consigli Poliedron`. Screenshots
remain only in session artifacts; the temporary harness/server were removed.
- Unresolved issues: none introduced by the sync. Existing POL-AI-004
documented limitations and repository dependency advisories remain
unchanged.
- Risks: none beyond documented existing limitations. Dashboard behavior
changes are limited to responsive containment and restoring the intended
panel-centering transform through its animation.
- Rollback: revert the reconciliation/follow-up commits to return PR #45 to
pre-sync head `39a11c0`. No database, data, dependency or deployment rollback
is required.
- Deployment impact: frontend bundle only; no deploy performed.
- Product Owner decision required: none.
- Exact next action: Product Owner reviews updated draft PR #45. Do not merge
or deploy without explicit approval. Status: `WAITING_PRODUCT_OWNER`.

## POL-AI-005A Transactional Action Planner — Foundation (Phase A)

- Task ID: POL-AI-005A.
- Previous agent: this session's own POL-UI-013(B/C) work; Product Owner directly authorized POL-AI-005A, scoped explicitly to Phase A only (UNDERSTAND → RESOLVE → PLAN, no CONFIRM/ACT/VERIFY, no real write, no migration, no merge), citing a limited weekly resource budget and asking for a safe, resumable checkpoint rather than a full implementation.
- Branch: `feature/POL-AI-005-transactional-action-planner`, based on `master@ab1bd27` (POL-AI-004 merged as PR #45; `docs/coordination/current-task.md` had not yet been updated to reflect that merge — corrected as part of this task, see below).
- Objective: build only the read-only foundation for a future transactional action planner — deterministic parsing for five documented Italian clinical/financial command families, non-writing patient/procedure resolution contracts, a tooth model that represents incomplete-but-valid clinical data without inventing values, and Action Plan builders for three representative workflows, all verified against the real (audited, not assumed) domain model.
- DOMAIN_AUDIT: `docs/architecture/POL-AI-005A-domain-audit.md`. Key findings: patients/plans/payments are edited via inline component `setState` reducers (`Piani.jsx`, `Pagamenti.jsx`), not a dedicated domain-service layer; `voce.prestazione` is free text with no canonical procedure ID anywhere in the schema; `payments` has no structural link to a treatment plan/item (patient-level only); the existing `actionRegistry.js` `riskLevel` model already reserves `riskLevel: 2` ("would create/update a business record") for exactly this future phase, confirming POL-AI-005 is filling an intentionally-left gap, not inventing a new concept; `permissionEngine.js`'s `buildIntelligencePermissions` (`activeMember/operations/clinical/financial`) is the correct existing capability surface to reuse.
- TREATMENT_PLAN_SCHEMA_AUDIT / PAYMENT_MODEL_AUDIT: fully answered in the domain audit doc's itemized findings — headline: nothing found requires a schema change for a conservative Phase B (mark-completed with unknown tooth; record a payment). `dente` is already effectively optional in practice (UI-level, not DB-enforced nullability was assumed only where evidence supported it); `eseguita` is a plain boolean with plan-level `stato` auto-promoted to `'concluso'` when every item is executed; payments carry `stato ∈ {'pagato','acconto','sospeso'}` but `saldoPaz`'s legacy per-patient balance calc counts all of them (a documented, unchanged existing quirk, not touched).
- ACTION_PLAN_CONTRACT: `src/lib/poliedron/planner/actionPlanner.js` — `buildActionPlan(parsedCommand, context) -> { actionId, intent, patientRef, entities, steps, warnings, assumptions, confidence, requiredPermissions, requiresConfirmation, blocked }`, frozen and JSON-serializable; every step is a plain data object (`PLAN_STEP_TYPE`: RESOLVE_PATIENT/RESOLVE_PROCEDURE/CHECK_EXISTING_TREATMENT/ENSURE_TREATMENT_ITEM/MARK_TREATMENT_COMPLETED/CHECK_EXISTING_PENDING_PAYMENT/ENSURE_PENDING_PAYMENT/VERIFY_REQUIRED_LATER) — no executable code in any step.
- DETERMINISTIC_PARSER: `commandParser.js` — five ordered regex-based command shapes (mark-completed with/without tooth, treatment+pending-payment, multi-item plan creation, multiple-treatments+payment with unknown teeth), reusing `intentEngine.js`'s `extractAmount`; returns `null` (documented fallback signal) for anything else, by design narrow rather than a general grammar.
- PATIENT_RESOLUTION: `patientResolver.js` reuses `ricercaPazienti.js`'s shared `cercaPazienti`/`normalizza` — `RESOLVED`/`AMBIGUOUS`/`NOT_FOUND`/`INVALID` (cross-tenant reject), never creates a patient.
- PROCEDURE_RESOLUTION: `procedureResolver.js` — exact normalized match → small alias table → strong substring match → not-found, against the caller's real `pricelist`; honest that no canonical procedure ID exists to resolve to.
- TOOTH_MODEL: `toothModel.js` — `KNOWN`/`UNKNOWN_AT_ENTRY`/`NOT_APPLICABLE`/`LEGACY_INCOMPLETE`, reproducing the real 32-tooth FDI set already used by `Odontogramma.jsx`. No DB column added.
- INCOMPLETE_RECORD_MODEL: proven directly by test — "Segna devitalizzazione di Rossi come eseguita, non ricordo il dente" produces a real MARK_TREATMENT_COMPLETED step with `tooth.state = unknown_at_entry`, not a rejected/invalid plan and not an invented tooth.
- DATA_HEALTH_HANDOFF: `dataHealthHandoff.js` — produces signals shaped exactly like `intelligence/model.js`'s real `createSignal()` output (`type: 'CLINICAL_METADATA_INCOMPLETE'`, `taxonomy: 'DATA_QUALITY'`, etc.), in-memory only; not wired into `studioDataHealth.js` (no safe persistence path exists yet — documented as Phase B integration work).
- WORKFLOW_A_PLAN / WORKFLOW_B_PLAN / WORKFLOW_C_PLAN: all three implemented and tested — treatment+pending-payment (with idempotent existing-item reuse and duplicate-pending-payment flagging), multi-item plan creation (PRICE_UNRESOLVED explicit, never zero/invented), and mark-completed-with-idempotent-reuse (reuses an existing matching plan item instead of duplicating it, proven by the "existing treatment reused" test).
- IDEMPOTENCY_DESIGN: existing same patient+procedure+tooth voce → reused (no duplicate ENSURE_TREATMENT_ITEM); existing pending payment matching same patient+amount → flagged with a warning, never silently duplicated or silently suppressed; two explicit incomplete fillings in the same request are always kept as two distinct planned items (dedup only ever checks against already-persisted data, never against sibling items in the same request).
- PERMISSION_PLAN: every write-shaped step declares `requiredPermissions`, checked against the real `buildIntelligencePermissions()` flags computed from the caller's `homePermissions`; a plan missing a required permission is `blocked: true` with a visible warning (proven by test), never silently partially planned. Explicitly documented as a **Phase A design choice** stricter than what the current human-driven forms enforce — flagged as `PRODUCT_OWNER_DECISION_REQUIRED`.
- MODEL_FALLBACK_CONTRACT: `modelFallbackContract.js` defines the semantic-fields-only allow-list (`intent, patientText, procedureTexts, toothText, amount, status, confidence`) and a `sanitizeModelSemanticOutput`/`containsForbiddenAuthoritativeKey` pair proving any id-shaped key a model response might contain is stripped before it could reach a resolver. No new Model Gateway call was added in Phase A.
- NO_WRITE_GUARANTEE: `executeActionPlan()` is an explicit rejecting stub (throws, never a silent no-op). A mandatory regression test scans every file under `src/lib/poliedron/planner/` for `.insert(/.upsert(/.update(/.delete(/.rpc(`/`supabaseClient`/`createClient` and asserts none are present.
- TESTS: `tests/actionPlanner.test.mjs` (28 tests) — the full explicit §21 matrix: all five deterministic commands, unknown tooth, two incomplete fillings preserved distinctly, explicit €180/€250, patient ambiguity, procedure ambiguity, price unresolved, existing-treatment-reused, missing-treatment-planned, duplicate-pending-payment-recognized, permission-requirement-included (satisfied and blocked cases), cross-tenant-rejected, no-model-call-for-common-commands, model-fallback-cannot-supply-ids, no-Supabase-write, plus tooth-model and Data-Health-handoff coverage.
- Files changed: `docs/architecture/POL-AI-005A-domain-audit.md` (new), `docs/architecture/POL-AI-005A-planner-foundation.md` (new), `src/lib/poliedron/planner/{toothModel,patientResolver,procedureResolver,commandParser,modelFallbackContract,actionPlanner,dataHealthHandoff}.js` (new), `tests/actionPlanner.test.mjs` (new), `docs/coordination/current-task.md` (POL-AI-004 corrected to historical/merged; POL-AI-005A recorded as current).
- Database changes: **none.** No migration, schema, RLS, or RBAC touched — no Supabase call of any kind was made by this task's own new code (only read-only `mcp__Supabase__*` calls in the prior POL-UI-013B task, unrelated to this one).
- Tests executed: `npm test` (286/286 pass — 258 pre-existing + 28 new); `npm run build` (passes, only pre-existing unrelated chunk-size warnings); `git diff --check` (clean).
- Test results: all green, see above.
- Unresolved issues: none for Phase A's own scope. Phase B's required work, schema/backend change candidates, and three explicit Product Owner decisions are itemized in `docs/architecture/POL-AI-005A-planner-foundation.md`.
- Risks: none — no write path exists in this code, so there is nothing to roll back operationally beyond the branch itself.
- Rollback: revert/delete the POL-AI-005A commit(s). No database or data rollback needed.
- Deployment impact: none — no deploy performed, and this code is not yet wired into any UI surface (no Poliedron entry point calls `buildActionPlan` yet — that wiring is Phase B).
- Product Owner decision required: three items, all detailed in `docs/architecture/POL-AI-005A-planner-foundation.md` PRODUCT_OWNER_DECISION_REQUIRED — (1) whether the conservative `clinical`/`financial` permission gate Phase A chose for AI-initiated writes is the right bar, given it is stricter than today's human-driven forms; (2) whether Phase B needs true multi-step transactional atomicity (likely a new backend RPC) or whether sequential/compensating writes are acceptable; (3) whether Phase B's executor should extract `Piani.jsx`/`Pagamenti.jsx`'s existing reducer logic into shared functions or build a new domain-service layer.
- SCHEMA_CHANGE_REQUIRED: none for the conservative Phase B scope described. BACKEND_CHANGE_REQUIRED: likely, only if true multi-step atomicity is required (see decision 2 above) — not built or decided here.
- No STOP condition from the task's own §22 list was hit — the audit found the schema already safely supports incomplete-but-valid treatment data, payment linkage does not require a schema change for the scoped Phase B work, and the write-permission model, while a Phase A design choice, is not "unclear."
- Exact next action: Product Owner reviews `docs/architecture/POL-AI-005A-domain-audit.md` and `docs/architecture/POL-AI-005A-planner-foundation.md`, decides the three PRODUCT_OWNER_DECISION_REQUIRED items, and opens/reviews the draft PR for this branch before any Phase B work begins. Do not merge without explicit approval. Status: `WAITING_PRODUCT_OWNER`.
