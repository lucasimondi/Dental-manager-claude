-- Synthetic PostgreSQL 17 harness only, never run on production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated,supabase_auth_admin;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.studios(id uuid PRIMARY KEY);
CREATE TABLE public.studio_users(user_id uuid,studio_id uuid,stato text,clinical boolean);
GRANT SELECT ON public.studio_users TO authenticated;
CREATE FUNCTION public.has_studio_capability_v1(p_studio_id uuid,p_capability text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.studio_users WHERE user_id=auth.uid() AND studio_id=p_studio_id AND stato='attivo' AND clinical) $$;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.studios VALUES ('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102');
INSERT INTO public.studio_users VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','attivo',true),('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000102','attivo',true);
