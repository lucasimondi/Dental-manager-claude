# POL-002A — critical hardening assessment

Date: 2026-08-18  
Baseline: `master` at `58df045d3247b37530137a055f8314b0da6245f2`
Task branch: `security/POL-002A-critical-hardening`

## Final verified status

POL-002A is prepared and locally validated. The Tech Lead supplied verified, read-only Supabase production metadata for PostgreSQL 17, including the affected function identities, relevant definitions and grants. No application rows or Storage objects were queried.

The branch contains:

- a fail-closed replacement for `public.is_studio_admin()`;
- a non-client-executable active-admin tenant guard;
- guarded wrappers for both GDPR SECURITY DEFINER RPCs, with JWT tenant equality, active admin membership and executor identity derived from `auth.uid()`;
- targeted anonymous EXECUTE revocations for functions whose privileged caller classification was verified;
- an empty `search_path` and direct Data API EXECUTE revocation for `public.set_updated_at`;
- a fail-closed client admin UI membership check;
- transaction-safe synthetic security regression tests and a test-only synthetic fixture baseline;
- a separate compatibility plan for migrating `patient-files` to private access.

The existing GDPR business bodies are preserved behind renamed functions that are not executable by `PUBLIC`, `anon` or `authenticated`. Their scalar return types are obtained from the PostgreSQL catalog during migration preflight. The migration aborts before alteration if either verified function identity is missing or set-returning.

## Local validation result

Validation ran in a disposable, locally isolated Supabase environment using only synthetic data:

- Supabase CLI `2.115.0`;
- Supabase PostgreSQL image `17.6.1.159` / PostgreSQL `17.6`;
- two fictional tenants, four fictional memberships and two fictional patients;
- no linked Supabase project, remote database URL, production credential, service-role key, production row or Storage object.

Completed checks:

1. The synthetic fixture loaded successfully into a fresh local database.
2. `20260818143000_pol_002a_critical_security_hardening.sql` applied successfully with `ON_ERROR_STOP=1`.
3. `supabase/tests/pol_002a_critical_security.sql` passed completely.
4. Fail-closed behavior passed for anonymous callers, missing memberships, inactive admins, non-admin users and cross-tenant memberships.
5. Same-tenant active-admin behavior and both guarded GDPR paths passed.
6. Trusted GDPR executor handling, financial RPC tenant authorization, intentionally public grants and `set_updated_at` hardening passed.
7. The synthetic GDPR deletion ran inside the test transaction and was rolled back.
8. `npm ci --ignore-scripts` and `npm run build` passed.

The disposable database was stopped with `supabase stop --no-backup` and removed after validation. See `docs/security/pol-002a-local-validation.md` for the exact environment and results.

## Production safety outcome

Nothing from POL-002A has been applied to production. No remote migration, SQL statement, grant, policy, Auth setting, Storage setting, deployment or production-data operation was executed. The local validation proves the prepared migration against the verified minimal contracts represented by synthetic fixtures; it is not a substitute for review against the still-unversioned complete production backend.

## Finding status

### 1. Fail-open admin check — CONFIRMED / FIX PREPARED AND LOCALLY VERIFIED

Verified production metadata showed `public.is_studio_admin()` used `coalesce(..., true)` and granted EXECUTE to `anon` and `authenticated`. The prepared migration makes every missing or invalid authorization state false and grants direct execution only to `authenticated`.

The client independently treated missing `studio_users` membership as admin for UI gating. The branch changes that UI check to fail closed. Database authorization remains the security boundary.

Local security tests passed for anonymous, no-membership, inactive-admin, normal-user, valid same-tenant admin and cross-tenant admin cases.

### 2. GDPR SECURITY DEFINER authorization — CONFIRMED / FIX PREPARED AND LOCALLY VERIFIED

Verified production identities are:

- `gdpr_esporta_paziente(bigint, uuid, uuid)`;
- `gdpr_cancella_paziente(bigint, uuid, uuid, boolean)`.

Production metadata confirmed that the original functions trusted caller-supplied tenant and executor values without a verified caller/JWT tenant equality check. The prepared wrappers require an authenticated caller, require the trusted JWT studio to equal `p_studio_id`, require an active admin membership in that studio and pass `auth.uid()` to the preserved business implementation as the executor.

Local tests passed for anonymous denial, wrong-tenant denial, cross-tenant patient denial, valid same-tenant admin access, trusted executor use and transactional synthetic deletion.

Residual decision: admin-only GDPR semantics must remain explicitly accepted by the Product Owner before production application.

### 3. SECURITY DEFINER execute surface — PARTIALLY HARDENED / INVENTORY STILL OPEN

Verified metadata allowed targeted removal of anonymous EXECUTE from the explicitly privileged `admin_*`, agent/operator-setting and GDPR functions covered by the migration. Intentionally public booking, registration, remote-consent and remote-history flows were deliberately preserved, and their ACL regression check passed locally.

The complete production SECURITY DEFINER inventory is still not versioned or fully classified. Every remaining function still requires identity, ownership, ACL, source, search path, dependency, intended-caller and internal-authorization review. Blanket anonymous revocation remains unsafe because some flows intentionally require anonymous invocation.

### 4. `set_updated_at` search path — CONFIRMED / FIX PREPARED AND LOCALLY VERIFIED

Verified metadata and the Security Advisor confirmed mutable `search_path`. The migration applies an empty search path to every verified `public.set_updated_at` overload and revokes direct execution from `PUBLIC`, `anon` and `authenticated`. PostgreSQL 17 catalog state and ACL assertions passed locally.

### 5. RLS without policies — UNCHANGED / ACCESS MODEL REVIEW REQUIRED

`public.google_calendar_tokens` and `public.super_admins` have RLS enabled with zero policies. This may be intentional for service-side or tightly controlled SECURITY DEFINER access. POL-002A does not add permissive policies merely to silence the advisor.

The remaining review must establish their owners, grants, direct callers, function dependencies, service-role use and expected browser-role denial.

### 6. `patient-files` public bucket — CONFIRMED P0 / SEPARATE MIGRATION REQUIRED

The patient record uses `patient-files` for images and PDFs and obtains public URLs. These objects may contain identifiable clinical material, so public access remains a confidentiality risk. The frontend currently depends on public URLs, making an immediate private-bucket switch behavior-breaking.

POL-002A documents a separate staged plan covering tenant-scoped Storage policies, signed URLs or authorized downloads, two-tenant tests, compatible application deployment, bucket privatization, rollback and monitoring. The bucket remains unchanged in production.

## Security and regression coverage achieved

- `is_studio_admin`: anonymous false; no membership false; inactive false; normal user false; correct active admin true; other-studio admin false.
- GDPR RPC: correct tenant/admin permitted; wrong tenant denied; anonymous denied; caller-supplied executor not trusted; other-tenant patient denied; trusted executor equals `auth.uid()`.
- Financial regression: wrong-tenant `get_kpi_periodo` and `get_costo_orario` remain denied; correct-tenant calls remain available.
- Public regression: verified intentional anonymous flow grants remain present.
- Trigger regression: `set_updated_at` has an empty search path and is not directly executable by Data API roles.
- Application regression: production Vite build passes.

## Residual risks and open work

- The full production Supabase schema, functions, grants, RLS, triggers, Storage policies and Edge Functions are still not reproducible from the repository.
- Synthetic contract coverage cannot prove compatibility with every unversioned production dependency or overload.
- The complete SECURITY DEFINER exposure and intended-caller inventory remains incomplete.
- `patient-files` remains public until its separate compatibility migration is approved and deployed safely.
- `google_calendar_tokens` and `super_admins` still require explicit access-model documentation and verification.
- Supabase Auth leaked-password protection remains disabled.
- Physio relationships still use non-composite foreign keys and do not structurally enforce tenant-safe references.
- The migration preserves GDPR bodies under renamed internal functions; dependencies and operational observability must be reviewed before remote application.
- Existing dependencies report 10 npm audit findings: 2 moderate, 6 high and 2 critical. Remediation is outside POL-002A.
- The existing build continues to report pdfjs `eval` and large-chunk warnings.

## Required approval before production

Product Owner and Tech Lead must review the prepared migration, synthetic fixture contract, test results, rollback outline, preserved GDPR implementation strategy and admin-only GDPR semantics. A production migration or deployment requires a separate explicit gate. Until then, POL-002A remains prepared and locally verified only.
