# POL-002A — Verified Supabase Production Metadata

Source: read-only inspection of Supabase project `idklxdqebfceplrualgh` (DentalManager). No application rows were queried and no production changes were made.

## Project baseline

- Project ref: `idklxdqebfceplrualgh`
- Project name: `DentalManager`
- Region: `eu-west-1`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL major: 17

## RLS baseline

RLS is enabled on the public application tables inspected. Core tables including `patients`, `payments`, `plans`, `appointments`, `spese`, `personale`, `physio_piani`, `physio_valutazioni`, and `physio_diario_sedute` have tenant policies based on JWT `app_metadata.studio_id`.

`studio_users` has separate SELECT/INSERT/UPDATE/DELETE policies and relies on `public.is_studio_admin()` for admin mutations.

`google_calendar_tokens` and `super_admins` have RLS enabled and zero policies.

## Confirmed function: public.is_studio_admin()

Current production definition:

```sql
CREATE OR REPLACE FUNCTION public.is_studio_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select coalesce(
    (select su.ruolo = 'admin' and su.stato = 'attivo'
     from public.studio_users su
     where su.user_id = auth.uid()
       and su.studio_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'studio_id'::text)::uuid
     limit 1),
    true
  );
$function$;
```

Verified privileges:

- `anon`: EXECUTE = true
- `authenticated`: EXECUTE = true

Security conclusion: **confirmed fail-open** because absence of a matching membership resolves to `true`.

Required target semantics for POL-002A: return TRUE only for an authenticated user with a valid JWT studio id and an active matching `studio_users` row with `ruolo='admin'`; otherwise FALSE.

## Confirmed function: public.gdpr_esporta_paziente(...)

Current production identity:

```text
gdpr_esporta_paziente(p_paziente_id bigint, p_studio_id uuid, p_eseguita_da uuid)
```

Properties:

- SECURITY DEFINER = true
- search_path = public
- anon EXECUTE = false
- authenticated EXECUTE = true

Current authorization behavior verified from function body:

```sql
select to_jsonb(p) into v_paziente
from patients p
where id = p_paziente_id and studio_id = p_studio_id;
```

The function then exports related appointments, plans, payments, medical-document metadata and fiscal-document metadata for the supplied `p_studio_id`, and writes an audit row using caller-supplied `p_eseguita_da`.

There is **no verified check** that:

```sql
p_studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
```

and executor identity is not derived from `auth.uid()`.

Security conclusion: **confirmed tenant-authorization gap** in the SECURITY DEFINER function.

## Confirmed function: public.gdpr_cancella_paziente(...)

Current production identity:

```text
gdpr_cancella_paziente(p_paziente_id bigint, p_studio_id uuid, p_eseguita_da uuid, p_cancella_anche_fatture boolean)
```

Properties:

- SECURITY DEFINER = true
- search_path = public
- anon EXECUTE = false
- authenticated EXECUTE = true

The function finds and deletes patient-scoped data using the caller-supplied `p_studio_id`, then records the request using caller-supplied `p_eseguita_da`.

There is **no verified caller/JWT tenant equality check** before the privileged delete operations.

Security conclusion: **confirmed tenant-authorization gap** in the SECURITY DEFINER function.

Required POL-002A target for both GDPR functions:

- require `auth.uid()` not null;
- derive caller studio from trusted JWT `app_metadata.studio_id`;
- require JWT studio id = `p_studio_id`;
- require sufficient membership role according to the current access model;
- derive audit executor from `auth.uid()` instead of trusting `p_eseguita_da` for authorization/audit identity;
- preserve current functional behavior otherwise.

## Financial RPC authorization already verified

### get_kpi_periodo

Identity:

```text
get_kpi_periodo(p_studio_id uuid, p_data_inizio date, p_data_fine date)
```

SECURITY DEFINER with explicit `search_path=public`.

Current function contains:

```sql
IF NOT (
  p_studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
  OR public.is_super_admin()
) THEN
  RAISE EXCEPTION 'Accesso negato';
END IF;
```

### get_costo_orario

Identity:

```text
get_costo_orario(p_studio_id uuid)
```

SECURITY DEFINER with the same tenant-or-superadmin authorization check.

Security conclusion: the original suspected cross-tenant IDOR on these two RPCs is **not confirmed in current production**. Regression tests must ensure POL-002A does not weaken these checks.

## SECURITY DEFINER exposure

Supabase Security Advisor reports broad EXECUTE exposure on multiple SECURITY DEFINER functions.

Examples verified with `anon EXECUTE = true` include:

- `admin_delete_studio`
- `admin_get_ai_usage`
- `admin_list_studios`
- `admin_remove_studio_user`
- both overloads of `admin_update_studio`
- `admin_update_studio_user_role`
- `register_studio`
- `is_studio_admin`
- `set_agente_azione`
- `set_multi_operatore`
- intentionally-public remote/public flows including booking and remote consent/history functions

Important nuance: several `admin_*` functions contain an internal `public.is_super_admin()` check. This reduces exploitability but does not justify unnecessary direct `anon` EXECUTE grants. Do not blanket-revoke public access because some remote booking/consent flows intentionally require anonymous invocation.

Classify each function as authenticated-only, intentionally public, or trigger/internal-only before changing grants.

## Storage baseline

Buckets observed:

- `patient-files` — `public = true`
- `spese-documenti` — `public = false`

Repository code uses public URLs for `patient-files` and the bucket supports patient-record images/PDFs. Treat as P0 confidentiality risk until proven otherwise.

`spese-documenti` has tenant-folder policies based on JWT `app_metadata.studio_id`.

Do not switch `patient-files` private until application compatibility and signed-URL/private-download migration are prepared and tested.

## Additional Security Advisor findings

- `public.set_updated_at` has mutable search_path.
- `public.google_calendar_tokens` has RLS enabled but no policies.
- `public.super_admins` has RLS enabled but no policies.
- leaked-password protection is disabled in Supabase Auth.

Do not add permissive RLS policies merely to silence the advisor; first confirm intended privileged-only access patterns.

## Physio tenancy finding

The current Physio migration uses ordinary foreign keys such as `paziente_id -> patients(id)` alongside separate `studio_id` columns. These are not composite tenant-safe foreign keys, so cross-tenant references are structurally possible if other controls fail.

This is confirmed but should not be mixed into the minimal POL-002A patch unless explicitly in scope.

## POL-002A next action

Codex may now resume POL-002A using this file as verified production metadata. It should prepare, but not deploy:

1. minimal migration making `is_studio_admin()` fail-closed;
2. minimal migration hardening both GDPR RPCs with trusted caller/tenant checks and trusted executor identity;
3. appropriate EXECUTE grant changes for only the functions whose intended caller is clear;
4. secure `search_path` for `set_updated_at`;
5. synthetic security tests;
6. a separate compatibility plan for converting `patient-files` to private access.

No production change is authorized by this document.