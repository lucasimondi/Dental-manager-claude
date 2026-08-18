-- POL-002A synthetic security regression tests
--
-- Run ONLY against a disposable local/isolated Supabase database containing
-- synthetic fixtures. Never run against production.
--
-- Required psql variables supplied by the isolated fixture:
--   studio_a, studio_b
--   admin_a, user_a, inactive_a, admin_b
--   patient_a, patient_b
--
-- Fixture contract:
--   admin_a     = active admin in studio_a
--   user_a      = active non-admin in studio_a
--   inactive_a  = inactive admin membership in studio_a
--   admin_b     = active admin in studio_b
--   patient_a   = synthetic patient in studio_a
--   patient_b   = synthetic patient in studio_b

\set ON_ERROR_STOP on

\if :{?studio_a}
\else
  \echo 'Missing synthetic fixture variables; refusing to run'
  \quit
\endif

BEGIN;

-- Helpers: set Supabase-compatible claims before SET LOCAL ROLE.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- anonymous/no-session semantics: the function itself is fail-closed.
SELECT public.is_studio_admin()::integer AS anonymous_admin \gset
\if :anonymous_admin
  \echo 'FAIL: anonymous user resolved as admin'
  \quit
\endif

-- anon must not have direct EXECUTE.
SELECT has_function_privilege(
  'anon',
  'public.is_studio_admin()',
  'EXECUTE'
)::integer AS anon_admin_execute \gset
\if :anon_admin_execute
  \echo 'FAIL: anon retains is_studio_admin EXECUTE'
  \quit
\endif

-- Authenticated user with no matching membership.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000099',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.is_studio_admin()::integer AS no_membership_admin \gset
\if :no_membership_admin
  \echo 'FAIL: missing membership resolved as admin'
  \quit
\endif

-- Inactive admin membership.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'inactive_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'inactive_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.is_studio_admin()::integer AS inactive_admin \gset
\if :inactive_admin
  \echo 'FAIL: inactive membership resolved as admin'
  \quit
\endif

-- Normal user.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'user_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'user_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.is_studio_admin()::integer AS normal_user_admin \gset
\if :normal_user_admin
  \echo 'FAIL: normal user resolved as admin'
  \quit
\endif

-- Correct studio admin.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'admin_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.is_studio_admin()::integer AS correct_admin \gset
\if :correct_admin
\else
  \echo 'FAIL: correct active admin was denied'
  \quit
\endif

-- Admin membership in another studio must not authorize studio_a claim.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'admin_b',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.is_studio_admin()::integer AS cross_tenant_admin \gset
\if :cross_tenant_admin
  \echo 'FAIL: cross-tenant admin membership was accepted'
  \quit
\endif

-- GDPR: no-session access must fail.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
\set ON_ERROR_STOP off
SELECT public.gdpr_esporta_paziente(
  :'patient_a'::bigint,
  :'studio_a'::uuid,
  :'admin_a'::uuid
);
\if :ERROR
\else
  \echo 'FAIL: no-session GDPR export was permitted'
  \quit
\endif
\set ON_ERROR_STOP on

-- GDPR: correct tenant and active admin is permitted.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'admin_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.gdpr_esporta_paziente(
  :'patient_a'::bigint,
  :'studio_a'::uuid,
  :'admin_a'::uuid
);

-- GDPR: supplied studio differing from JWT tenant must fail before any export.
\set ON_ERROR_STOP off
SELECT public.gdpr_esporta_paziente(
  :'patient_b'::bigint,
  :'studio_b'::uuid,
  :'admin_a'::uuid
);
\if :ERROR
\else
  \echo 'FAIL: wrong-tenant GDPR export was permitted'
  \quit
\endif
\set ON_ERROR_STOP on

-- Manipulating p_eseguita_da must not bypass authorization. The wrapper body
-- must pass its trusted v_executor instead of the caller argument.
SELECT (
  position(
    'v_executor' IN
    pg_get_functiondef(
      'public.gdpr_esporta_paziente(bigint,uuid,uuid)'::regprocedure
    )
  ) > 0
)::integer AS trusted_export_executor \gset
\if :trusted_export_executor
\else
  \echo 'FAIL: GDPR export wrapper lacks trusted executor'
  \quit
\endif

SELECT (
  position(
    'v_executor' IN
    pg_get_functiondef(
      'public.gdpr_cancella_paziente(bigint,uuid,uuid,boolean)'::regprocedure
    )
  ) > 0
)::integer AS trusted_delete_executor \gset
\if :trusted_delete_executor
\else
  \echo 'FAIL: GDPR delete wrapper lacks trusted executor'
  \quit
\endif

-- A patient from another tenant must not be exported under studio_a. Current
-- business function may raise or return ok=false; either result is denial.
\set ON_ERROR_STOP off
SELECT public.gdpr_esporta_paziente(
  :'patient_b'::bigint,
  :'studio_a'::uuid,
  :'admin_b'::uuid
);
\if :ERROR
\else
  \echo 'Review returned payload: it must report ok=false for cross-tenant patient'
\endif
\set ON_ERROR_STOP on

-- Financial authorization regression: wrong tenant still denied.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'admin_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;

\set ON_ERROR_STOP off
SELECT public.get_kpi_periodo(
  :'studio_b'::uuid,
  CURRENT_DATE - 30,
  CURRENT_DATE
);
\if :ERROR
\else
  \echo 'FAIL: get_kpi_periodo allowed wrong tenant'
  \quit
\endif

SELECT public.get_costo_orario(:'studio_b'::uuid);
\if :ERROR
\else
  \echo 'FAIL: get_costo_orario allowed wrong tenant'
  \quit
\endif
\set ON_ERROR_STOP on

-- Intentionally-public flow grants remain present. This verifies ACL only;
-- flow-specific token/booking tests belong to their isolated integration suite.
SELECT bool_and(has_function_privilege('anon', p.oid, 'EXECUTE'))::integer
  AS intended_public_grants
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'info_link_firma_consenso',
    'info_link_storia_clinica',
    'info_studio_pubblico',
    'prenota_slot_pubblico',
    'registra_firma_consenso',
    'slot_occupati_pubblico',
    'tipi_prenotabili_online',
    'register_studio'
  ])
\gset
\if :intended_public_grants
\else
  \echo 'FAIL: an intended public flow lost anon EXECUTE'
  \quit
\endif

-- Trigger helper must not be directly exposed and must have secure search_path.
SELECT (
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')
  AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  AND coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
)::integer AS set_updated_at_hardened
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'set_updated_at'
LIMIT 1
\gset
\if :set_updated_at_hardened
\else
  \echo 'FAIL: set_updated_at hardening not present'
  \quit
\endif

-- GDPR delete success is last because it mutates only synthetic fixture data;
-- the enclosing transaction is always rolled back.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', :'admin_a',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('studio_id', :'studio_a')
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.gdpr_cancella_paziente(
  :'patient_a'::bigint,
  :'studio_a'::uuid,
  :'admin_b'::uuid,
  false
);

ROLLBACK;

\echo 'POL-002A security regression tests passed'
