-- POL-WA-002: WhatsApp automation permission hardening (Product Owner go-ahead:
-- "Mergia e vai con pol wa 002").
--
-- Before: one studio-scoped ALL policy per table. Any member of any studio
-- could register an unclaimed phone_number_id (UNIQUE is global) and receive
-- the inbound WhatsApp traffic of that number, and any member could edit or
-- delete the message log.
--
-- After:
--   whatsapp_config
--     SELECT  every member of the studio (unchanged)
--     INSERT  super admin only, and only for the studio in the JWT claim
--     UPDATE  super admin, or a studio owner (studio.owner capability);
--             a BEFORE UPDATE trigger lets non-super-admin callers change
--             only `attivo` (turn the assistant off/on), never the number
--     DELETE  super admin only
--   whatsapp_messages
--     SELECT  every member of the studio; no client writes at all. Rows are
--             written only by the whatsapp-webhook Edge Function, which uses
--             the service role.
-- Tenant scoping on studio_id stays mandatory in every policy: the super
-- admin gets no cross-tenant access through this migration.
--
-- Rollback: re-run the policy block of
-- 20260930120000_pol_wa_001_whatsapp_baseline.sql (drops nothing), then
--   DROP TRIGGER IF EXISTS whatsapp_config_guard ON public.whatsapp_config;
--   DROP FUNCTION IF EXISTS public.whatsapp_config_guard();
--   DROP POLICY IF EXISTS whatsapp_config_select / _insert / _update / _delete,
--     whatsapp_messages_select;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config,
--     public.whatsapp_messages TO authenticated;
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.whatsapp_config') IS NULL OR to_regclass('public.whatsapp_messages') IS NULL THEN
    RAISE EXCEPTION 'POL-WA-002 preflight: whatsapp_config and whatsapp_messages are required';
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'POL-WA-002 preflight: public.is_super_admin() is required';
  END IF;
  IF to_regprocedure('public.has_studio_capability_v1(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'POL-WA-002 preflight: public.has_studio_capability_v1(uuid,text) is required';
  END IF;
END
$preflight$;

-- ── whatsapp_config ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS whatsapp_config_studio ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_select ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_insert ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_update ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_delete ON public.whatsapp_config;

CREATE POLICY whatsapp_config_select ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

CREATE POLICY whatsapp_config_insert ON public.whatsapp_config
  FOR INSERT TO authenticated
  WITH CHECK (
    studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
    AND (SELECT public.is_super_admin())
  );

CREATE POLICY whatsapp_config_update ON public.whatsapp_config
  FOR UPDATE TO authenticated
  USING (
    studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
    AND ((SELECT public.is_super_admin()) OR public.has_studio_capability_v1(studio_id, 'studio.owner'))
  )
  WITH CHECK (
    studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
    AND ((SELECT public.is_super_admin()) OR public.has_studio_capability_v1(studio_id, 'studio.owner'))
  );

CREATE POLICY whatsapp_config_delete ON public.whatsapp_config
  FOR DELETE TO authenticated
  USING (
    studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid
    AND (SELECT public.is_super_admin())
  );

-- A studio owner may only flip `attivo`. The number binding (and anything
-- else) is changeable only by the super admin, or server-side roles
-- (service_role / postgres) that never go through PostgREST as a user.
CREATE OR REPLACE FUNCTION public.whatsapp_config_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT public.is_super_admin()
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.studio_id IS DISTINCT FROM OLD.studio_id
       OR NEW.phone_number_id IS DISTINCT FROM OLD.phone_number_id
       OR NEW.waba_id IS DISTINCT FROM OLD.waba_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
     ) THEN
    RAISE EXCEPTION 'POL-WA-002: only the super admin can change the WhatsApp number of a studio'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS whatsapp_config_guard ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_guard
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_guard();

-- ── whatsapp_messages ────────────────────────────────────────────────────
DROP POLICY IF EXISTS whatsapp_messages_studio ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

-- ── Grants ──────────────────────────────────────────────────────────────
-- anon never has a studio claim: no access. TRUNCATE bypasses RLS, so it is
-- never granted to client roles. The message log is read-only for clients.
REVOKE ALL ON public.whatsapp_config, public.whatsapp_messages FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_config FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_messages FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;

COMMIT;
