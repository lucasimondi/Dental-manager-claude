-- POL-002A — Critical security hardening
-- PREPARED ONLY. Do not apply to production without Product Owner approval.
--
-- Scope:
--   1. Make public.is_studio_admin() fail closed.
--   2. Put authenticated tenant/admin guards in front of the two GDPR
--      SECURITY DEFINER RPCs without rewriting their business logic.
--   3. Remove anonymous EXECUTE from explicitly privileged functions.
--   4. Secure public.set_updated_at search_path and remove direct execution.
--
-- Out of scope: patient-files bucket, RLS policy additions, Physio foreign keys,
-- financial formulas, Auth configuration and intentionally public RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_studio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND NULLIF(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.studio_users AS su
      WHERE su.user_id = auth.uid()
        AND su.studio_id::text = (auth.jwt() -> 'app_metadata' ->> 'studio_id')
        AND su.ruolo = 'admin'
        AND su.stato = 'attivo'
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_studio_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_studio_admin() TO authenticated;

-- Internal guard used only by the protected GDPR wrappers.
CREATE OR REPLACE FUNCTION public.pol_002a_require_studio_admin(p_studio_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claim_text text := auth.jwt() -> 'app_metadata' ->> 'studio_id';
  v_claim_studio_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_claim_text IS NULL THEN
    RAISE EXCEPTION 'Accesso negato'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_claim_studio_id := v_claim_text::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Accesso negato'
        USING ERRCODE = '42501';
  END;

  IF v_claim_studio_id IS DISTINCT FROM p_studio_id THEN
    RAISE EXCEPTION 'Accesso negato'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.studio_users AS su
    WHERE su.user_id = v_user_id
      AND su.studio_id = v_claim_studio_id
      AND su.ruolo = 'admin'
      AND su.stato = 'attivo'
  ) THEN
    RAISE EXCEPTION 'Accesso negato'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pol_002a_require_studio_admin(uuid)
  FROM PUBLIC, anon, authenticated;

-- Preserve the verified production GDPR implementations behind non-exposed
-- internal names, then recreate their public identities as guarded wrappers.
-- The catalog preflight preserves the existing scalar return type rather than
-- guessing it. The migration aborts before renaming if a function is missing
-- or set-returning.
DO $migration$
DECLARE
  v_export_original regprocedure;
  v_delete_original regprocedure;
  v_export_result text;
  v_delete_result text;
  v_export_retset boolean;
  v_delete_retset boolean;
BEGIN
  v_export_original :=
    to_regprocedure('public.gdpr_esporta_paziente__pol002a_original(bigint,uuid,uuid)');

  IF v_export_original IS NULL THEN
    v_export_original :=
      to_regprocedure('public.gdpr_esporta_paziente(bigint,uuid,uuid)');

    IF v_export_original IS NULL THEN
      RAISE EXCEPTION
        'POL-002A preflight: gdpr_esporta_paziente(bigint,uuid,uuid) missing';
    END IF;

    SELECT pg_get_function_result(p.oid), p.proretset
      INTO v_export_result, v_export_retset
    FROM pg_proc AS p
    WHERE p.oid = v_export_original::oid;

    IF v_export_retset THEN
      RAISE EXCEPTION
        'POL-002A preflight: set-returning GDPR export is unsupported';
    END IF;

    EXECUTE
      'ALTER FUNCTION public.gdpr_esporta_paziente(bigint,uuid,uuid) '
      'RENAME TO gdpr_esporta_paziente__pol002a_original';

    v_export_original :=
      to_regprocedure('public.gdpr_esporta_paziente__pol002a_original(bigint,uuid,uuid)');
  ELSE
    SELECT pg_get_function_result(p.oid), p.proretset
      INTO v_export_result, v_export_retset
    FROM pg_proc AS p
    WHERE p.oid = v_export_original::oid;
  END IF;

  v_delete_original :=
    to_regprocedure('public.gdpr_cancella_paziente__pol002a_original(bigint,uuid,uuid,boolean)');

  IF v_delete_original IS NULL THEN
    v_delete_original :=
      to_regprocedure('public.gdpr_cancella_paziente(bigint,uuid,uuid,boolean)');

    IF v_delete_original IS NULL THEN
      RAISE EXCEPTION
        'POL-002A preflight: gdpr_cancella_paziente(bigint,uuid,uuid,boolean) missing';
    END IF;

    SELECT pg_get_function_result(p.oid), p.proretset
      INTO v_delete_result, v_delete_retset
    FROM pg_proc AS p
    WHERE p.oid = v_delete_original::oid;

    IF v_delete_retset THEN
      RAISE EXCEPTION
        'POL-002A preflight: set-returning GDPR delete is unsupported';
    END IF;

    EXECUTE
      'ALTER FUNCTION public.gdpr_cancella_paziente(bigint,uuid,uuid,boolean) '
      'RENAME TO gdpr_cancella_paziente__pol002a_original';

    v_delete_original :=
      to_regprocedure('public.gdpr_cancella_paziente__pol002a_original(bigint,uuid,uuid,boolean)');
  ELSE
    SELECT pg_get_function_result(p.oid), p.proretset
      INTO v_delete_result, v_delete_retset
    FROM pg_proc AS p
    WHERE p.oid = v_delete_original::oid;
  END IF;

  IF v_export_result IS NULL OR v_delete_result IS NULL
     OR v_export_retset OR v_delete_retset THEN
    RAISE EXCEPTION 'POL-002A preflight: invalid GDPR function metadata';
  END IF;

  EXECUTE format(
    $create_export$
      CREATE OR REPLACE FUNCTION public.gdpr_esporta_paziente(
        p_paziente_id bigint,
        p_studio_id uuid,
        p_eseguita_da uuid
      )
      RETURNS %s
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $wrapper$
      DECLARE
        v_executor uuid;
      BEGIN
        v_executor := public.pol_002a_require_studio_admin(p_studio_id);
        RETURN public.gdpr_esporta_paziente__pol002a_original(
          p_paziente_id,
          p_studio_id,
          v_executor
        );
      END;
      $wrapper$
    $create_export$,
    v_export_result
  );

  EXECUTE format(
    $create_delete$
      CREATE OR REPLACE FUNCTION public.gdpr_cancella_paziente(
        p_paziente_id bigint,
        p_studio_id uuid,
        p_eseguita_da uuid,
        p_cancella_anche_fatture boolean
      )
      RETURNS %s
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $wrapper$
      DECLARE
        v_executor uuid;
      BEGIN
        v_executor := public.pol_002a_require_studio_admin(p_studio_id);
        RETURN public.gdpr_cancella_paziente__pol002a_original(
          p_paziente_id,
          p_studio_id,
          v_executor,
          p_cancella_anche_fatture
        );
      END;
      $wrapper$
    $create_delete$,
    v_delete_result
  );
END;
$migration$;

REVOKE EXECUTE ON FUNCTION
  public.gdpr_esporta_paziente__pol002a_original(bigint,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.gdpr_cancella_paziente__pol002a_original(bigint,uuid,uuid,boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.gdpr_esporta_paziente(bigint,uuid,uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  public.gdpr_cancella_paziente(bigint,uuid,uuid,boolean)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.gdpr_esporta_paziente(bigint,uuid,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION
  public.gdpr_cancella_paziente(bigint,uuid,uuid,boolean)
  TO authenticated;

-- Require authentication for the privileged functions whose intended caller is
-- explicit in the verified metadata. Intentionally-public booking, consent,
-- remote-history and register_studio functions are deliberately untouched.
DO $grants$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'admin_delete_studio',
        'admin_get_ai_usage',
        'admin_list_studios',
        'admin_remove_studio_user',
        'admin_update_studio',
        'admin_update_studio_user_role',
        'set_agente_azione',
        'set_multi_operatore'
      ])
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.nspname,
      r.proname,
      r.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      r.nspname,
      r.proname,
      r.identity_args
    );
  END LOOP;
END;
$grants$;

-- Trigger functions do not require direct Data API EXECUTE. Apply an explicit
-- empty search_path to every verified public.set_updated_at overload.
DO $search_path$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
  LOOP
    v_count := v_count + 1;
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path TO %L',
      r.nspname,
      r.proname,
      r.identity_args,
      ''
    );
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname,
      r.proname,
      r.identity_args
    );
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'POL-002A preflight: public.set_updated_at missing';
  END IF;
END;
$search_path$;

COMMIT;

-- Manual rollback outline (review before use):
--   DROP guarded GDPR wrappers;
--   ALTER the two __pol002a_original functions back to their original names;
--   restore the verified pre-POL-002A grants;
--   restore the previous is_studio_admin definition;
--   restore the previous set_updated_at proconfig only if explicitly approved.
