CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email text);
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt()->>'sub','')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(),auth.uid() TO authenticated;

CREATE TABLE public.studios(id uuid PRIMARY KEY,nome text);
CREATE TABLE public.patients(id bigint PRIMARY KEY,studio_id uuid NOT NULL REFERENCES public.studios(id),nome text,cognome text);
CREATE TABLE public.studio_users(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,studio_id uuid NOT NULL REFERENCES public.studios(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),ruolo text NOT NULL,stato text NOT NULL,
  UNIQUE(studio_id,user_id)
);
CREATE TABLE public.appointments(id bigint PRIMARY KEY,studio_id uuid NOT NULL REFERENCES public.studios(id),paziente_id bigint REFERENCES public.patients(id),data date,stato text);

GRANT SELECT ON public.studio_users,public.patients TO authenticated;
