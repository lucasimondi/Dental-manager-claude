# POL-002A — critical hardening assessment

Date: 2026-08-18  
Baseline: `master` at `58df045d3247b37530137a055f8314b0da6245f2`

## Resumption implementation update

Verified production metadata was supplied by the Tech Lead. The previously blocked items now have `FIX PREPARED` status:

- `is_studio_admin()`: fail-closed replacement prepared;
- GDPR export/delete: guarded wrappers prepared with JWT tenant equality, active admin membership and executor derived from `auth.uid()`;
- privileged EXECUTE surface: targeted anon revocations prepared for explicitly classified functions;
- `set_updated_at`: empty search_path and direct-execute revocation prepared;
- client admin UI: fail-closed membership check prepared;
- synthetic security regression test script prepared.

The existing GDPR business bodies are preserved behind renamed, non-client-executable functions. Their scalar return types are obtained from the catalog during migration preflight. The migration aborts before alteration if required identities are absent or set-returning.

The migration and tests have not been executed. Storage, Auth, financial formulas, RLS policies, policy-less privileged tables and production are unchanged.

## Safety outcome

No production access was attempted. No migration, SQL replacement, grant, policy, Auth change, Storage change, application change, deployment, or production-data access was performed.

A safe patch cannot yet be authored because the repository does not contain the identity arguments, return types, current bodies, ownership, grants, dependencies, policy bindings, or regression fixtures for the affected production objects.

## Finding status

### 1. Fail-open admin check — CONFIRMED / FIX BLOCKED

The Product Owner reports production `public.is_studio_admin()` effectively uses `coalesce(membership_check, true)`. The repository contains no function definition.

The client independently mirrors the fail-open behavior in `src/App.jsx`: missing `studio_users` membership is treated as admin for UI gating. This is not the database security boundary, but it confirms the fallback assumption is embedded in application behavior.

Target behavior is approved: return true only for an authenticated caller with a valid JWT studio claim and an active matching `studio_users` row whose role is `admin`. All missing/invalid states return false.

Required before patch: exact function identity arguments, return type, language, current definition, owner, volatility, security mode, search path, grants, dependent policies/functions, and the documented bootstrap path for the original studio owner.

### 2. GDPR SECURITY DEFINER authorization — CONFIRMED / FIX BLOCKED

The client calls:
- `gdpr_esporta_paziente(p_paziente_id, p_studio_id, p_eseguita_da)`
- `gdpr_cancella_paziente(p_paziente_id, p_studio_id, p_eseguita_da, p_cancella_anche_fatture)`

Client code takes `p_eseguita_da` from the session, but caller-controlled input cannot be an authorization boundary. The Product Owner confirms the production functions do not prove caller membership in `p_studio_id`.

Required target: authenticated caller; valid JWT studio claim; claim equals `p_studio_id`; active membership with an approved role; patient belongs to the same tenant; executor identity derived from `auth.uid()`.

Required before patch: exact overloads, argument types/defaults, return types, complete bodies, audit dependencies, delete/export dependency graph, role requirements, grants, exception contract, and transaction behavior. Replacing these functions without those facts risks data loss or breaking statutory workflows.

### 3. SECURITY DEFINER execute surface — REQUIRES METADATA

The client references 22 RPC names. Repository references are not a complete inventory and do not reveal current EXECUTE grants or internal authorization.

Provisional categories requiring verification:

A — authenticated/privileged candidates: `admin_list_studio_users`, `admin_list_studios`, `admin_update_studio`, `firma_storia_clinica`, `gdpr_cancella_paziente`, `gdpr_esporta_paziente`, `get_costo_orario`, `get_kpi_periodo`, `is_super_admin`, `set_agente_azione`, `set_multi_operatore`, and link-creation functions.

B — intentionally public candidates: `info_link_firma_consenso`, `info_link_storia_clinica`, `info_studio_pubblico`, `prenota_slot_pubblico`, `registra_firma_consenso`, `slot_occupati_pubblico`, `tipi_prenotabili_online`, and possibly `register_studio` / remote completion flows. Public intent must be proven; token validation, rate limiting and tenant scoping remain unknown.

C — trigger/internal candidates: `set_updated_at` and every unlisted trigger/helper function. No complete inventory is available.

For every public SECURITY DEFINER function, obtain identity signature, owner, ACL, source, search path, dependencies, exposed roles, intended caller, internal authorization, and whether SECURITY DEFINER is necessary. Do not revoke `anon` globally.

### 4. set_updated_at search_path — CONFIRMED BY ADVISOR / FIX BLOCKED

Target is an explicit minimal secure search path and schema-qualified references. The repository lacks the function definition, identity signature, owner, trigger dependencies and current grants. Do not replace it until those are captured.

### 5. RLS without policy — REQUIRES PRODUCT OWNER DECISION

`public.google_calendar_tokens` and `public.super_admins` reportedly have RLS enabled with no policies. This can be correct when access is limited to service-side or tightly authorized SECURITY DEFINER functions.

Required evidence: table definitions, RLS forced/enabled state, grants, owners, all direct and function dependencies, server-side callers, service-role usage, and tests showing browser roles cannot access them. Do not add permissive policies merely to clear an advisor warning.

### 6. patient-files public bucket — CONFIRMED P0 / MIGRATION DESIGN REQUIRED

Repository usage is limited to `src/components/SchedaPaz.jsx`:
- list objects beneath `<patient_id>/`;
- upload arbitrary selected files;
- delete objects;
- obtain URLs with `getPublicUrl`;
- render images and PDFs in the patient-record Photos section.

The UI calls the objects “foto” and accepts image/PDF extensions. In a healthcare patient record these may contain identifiable clinical images or documents. A public bucket makes possession/guessing/leakage of an object URL sufficient for unauthenticated access. Object paths use patient IDs and timestamp-derived filenames, which are not an authorization control.

The frontend depends directly on public URLs. Switching the bucket to private without first replacing URL generation would break previews.

Safe staged path, requiring a separate Product Owner-approved migration:
1. inventory bucket policies and object metadata only, never object content;
2. define tenant-scoped Storage policies and a safe path convention that includes/verifies tenant identity;
3. update reads to short-lived signed URLs or an authorized download endpoint;
4. test list/upload/read/delete and URL expiry with two synthetic tenants;
5. deploy compatible application behavior first;
6. make the bucket private only after compatibility validation;
7. verify old public URLs no longer work and monitor failures;
8. define retention, audit, cache and incident procedures.

Do not change the bucket until the complete dependency and rollback plan is approved.

## Required SQL test matrix

Tests cannot be implemented reproducibly until the baseline schema/functions are available. The future migration and tests must land together and use synthetic fixtures only.

`is_studio_admin`: anonymous false; no membership false; inactive false; normal user false; correct active admin true; admin from other studio false.

GDPR RPC: correct tenant/allowed role permitted; wrong tenant denied; anonymous denied; manipulated `p_eseguita_da` denied; patient in other tenant denied; audit executor equals `auth.uid()`.

Financial regression: `get_kpi_periodo` and `get_costo_orario` keep current authorization behavior and cannot be widened.

Public regression: every verified public booking/consent/token flow retains only its intended anonymous capability; internal/trigger functions remain non-callable through the Data API.

## Exact metadata required to resume

Provide sanitized results, not credentials or row data, for:
- `pg_get_function_identity_arguments`, result type and `pg_get_functiondef` for all public functions;
- function owner, `prosecdef`, `provolatile`, `proconfig`, ACL and dependencies;
- routine grants and default privileges;
- `pg_policies`, RLS enabled/forced flags and table grants;
- definitions and constraints for `studio_users`, patients, GDPR audit/dependency tables, `google_calendar_tokens`, and `super_admins`;
- trigger definitions/bindings, especially `set_updated_at`;
- Storage bucket metadata and Storage policies for `patient-files`;
- verified intended callers/roles for each SECURITY DEFINER function;
- current migration-history identifiers.

Raw dumps, secrets, Auth users, patient rows, clinical files and Storage objects must not be supplied or committed.
