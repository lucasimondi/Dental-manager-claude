-- POL-WA-002 local bootstrap (disposable database only).
-- Order: pol_rbac_001_local_bootstrap.sql -> 20260818000000_physio_schema_dati.sql
-- -> 20260819200029_pol_rbac_001_authoritative_capabilities.sql
-- -> this file -> 20260930120000_pol_wa_001_whatsapp_baseline.sql
-- -> 20260930150000_pol_wa_002_whatsapp_config_hardening.sql -> pol_wa_002_whatsapp_permissions.sql.
--
-- public.super_admins / public.is_super_admin() exist in production but are
-- not yet versioned in the repository. This reproduces the production
-- definition of is_super_admin() (extracted read-only on 2026-09-30) with a
-- minimal super_admins table, for local tests only.
CREATE TABLE IF NOT EXISTS public.super_admins(user_id uuid PRIMARY KEY);

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Studio A: a0..01 is admin (studio.owner), a0..0a is a plain member,
-- a0..0b is the platform super admin, also an active member of studio A.
INSERT INTO auth.users(id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'),
  ('a0000000-0000-4000-8000-00000000000b')
ON CONFLICT DO NOTHING;
INSERT INTO public.studio_users(user_id, studio_id, ruolo, stato) VALUES
  ('a0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'utente', 'attivo'),
  ('a0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 'admin', 'attivo')
ON CONFLICT DO NOTHING;
INSERT INTO public.super_admins(user_id) VALUES ('a0000000-0000-4000-8000-00000000000b')
ON CONFLICT DO NOTHING;
