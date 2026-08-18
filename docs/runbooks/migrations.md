# Supabase source-of-truth capture procedure

Goal: capture the CURRENT production backend definitions without changing production. Do not reconstruct missing objects by guessing.

## Product Owner prerequisites

The Product Owner must provide or authorize:

1. Supabase project reference and confirmation of the production project.
2. A named authorized operator and maintenance/change window, even though extraction is read-only.
3. Read-only PostgreSQL connection credentials created specifically for discovery, preferably a temporary login with `CONNECT` plus metadata/catalog visibility and `SELECT` only where required. Do not use the application service-role key for SQL extraction.
4. Approval to use Supabase CLI authenticated to the project for read-only inspection, or an exported archive produced by an authorized administrator.
5. Read access to Supabase Dashboard settings needed to inventory Auth, API, Realtime, Storage, Vault/secrets names, and Edge Functions. Secret values must not be exported.
6. Read access to Storage metadata and policies; bucket contents and patient files are not required.
7. Access to the source or downloadable bundles for every deployed Edge Function, including dependency/config files. If source cannot be exported, the responsible owner must provide the authoritative source separately.
8. A secure, access-controlled location outside Git for raw captures and a named reviewer responsible for secret/PHI sanitization.
9. Confirmation of extensions, PostgreSQL version, Supabase CLI version, regions, custom domains, external providers, scheduled jobs, webhooks, and third-party secret names.
10. Approval of which sanitized artifacts may ultimately enter Git.

## Phase A — Read-only inventory

Before commands, verify the target project reference and connection host with the Product Owner. Confirm the SQL role cannot create, alter, drop, truncate, insert, update, delete, execute privileged mutations, or access patient rows unnecessarily.

Collect catalog definitions for:
- schemas and extensions;
- tables, columns, defaults, identity/generated definitions;
- indexes, primary/unique/check constraints;
- foreign keys and delete/update actions;
- enums and other custom types;
- views and materialized views;
- sequences;
- RLS enabled/forced status and policies;
- PostgreSQL functions/RPC, signatures, language, volatility, security-definer/invoker, configuration and search path;
- triggers and trigger functions;
- grants and default privileges;
- publications/Realtime configuration;
- scheduled jobs if present;
- Storage buckets metadata, limits/public flags, and Storage RLS policies;
- Auth hooks/triggers and relevant non-secret provider/configuration metadata;
- Edge Function names, versions, source, dependency files, import maps, JWT-verification settings, routes, and secret names only;
- relevant project configuration without secret values.

Preferred methods, after authorization:
- Supabase CLI version check and authenticated read-only inspection;
- `supabase db dump` using the temporary read-only database URL, producing schema-only outputs and explicitly excluding data;
- catalog queries through `psql` using the read-only login when CLI dumps omit policy, privilege, Auth, Storage, or extension metadata;
- Dashboard/API export for settings not represented in PostgreSQL;
- authorized Edge Function source export or owner-supplied source.

Exact CLI flags must be selected and peer-reviewed against the installed CLI version before execution. Never run `db reset`, `db push`, `migration up`, `link` followed by mutation, seed commands, destructive SQL, or data dumps against production.

## Phase B — Raw artifact quarantine

Write raw output only to the approved secure location outside Git. Record timestamp, project reference, tool versions, commands, operator, and checksums. Do not print connection strings or tokens in logs. Do not collect table data, Auth users, patient records, file objects, secret values, or webhook payloads.

## Phase C — Review and sanitization

Two reviewers compare inventory sources, remove credentials, tokens, emails, patient data, internal URLs where sensitive, and environment-specific secret values. Preserve object definitions and use placeholders for required secrets. Identify objects owned by managed Supabase schemas that should be documented rather than migrated by the application.

## Phase D — Reconciliation

Compare sanitized production definitions with the existing repository migration. Produce an object-by-object discrepancy register. Classify each item as application-owned, Supabase-managed, environment configuration, secret, or external dependency. Do not alter production during reconciliation.

## Phase E — Versioning proposal

Prepare a separate Product Owner-approved task to add:
- an audited baseline or ordered migrations;
- functions/RPC and triggers;
- grants and RLS;
- Storage bucket/policy declarations;
- Edge Function source;
- sanitized configuration templates;
- validation scripts and two-tenant tests;
- checksums and extraction manifest.

Prove the baseline only on a fresh local or isolated staging project using synthetic data. The production database must not be reset, recreated, or retroactively modified to make it match.

## Stop conditions

Stop immediately on target ambiguity, unexpected write capability, secret/PHI exposure, dump attempts that include data, incomplete authorization, production performance impact, or definitions that cannot be attributed safely. Escalate to the Product Owner.
