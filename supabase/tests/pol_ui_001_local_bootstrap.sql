CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE TABLE public.studio_users(user_id uuid NOT NULL,studio_id uuid NOT NULL,stato text NOT NULL,ruolo text NOT NULL,PRIMARY KEY(user_id,studio_id));
GRANT SELECT ON public.studio_users TO authenticated;
