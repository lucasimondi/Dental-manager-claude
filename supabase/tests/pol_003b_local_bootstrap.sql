-- Minimal synthetic bootstrap for isolated PostgreSQL 17 validation.
CREATE EXTENSION IF NOT EXISTS plpgsql_check;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.studio_users(
  user_id uuid NOT NULL,studio_id uuid NOT NULL,stato text NOT NULL,
  PRIMARY KEY(user_id,studio_id)
);
INSERT INTO public.studio_users(user_id,studio_id,stato)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,studio_id,'attivo'
FROM unnest(ARRAY[
  '10000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000003'::uuid,
  '10000000-0000-4000-8000-000000000004'::uuid,
  '10000000-0000-4000-8000-000000000005'::uuid,
  '10000000-0000-4000-8000-000000000006'::uuid,
  '10000000-0000-4000-8000-000000000007'::uuid,
  '10000000-0000-4000-8000-000000000008'::uuid,
  '10000000-0000-4000-8000-000000000009'::uuid,
  '10000000-0000-4000-8000-000000000010'::uuid,
  '10000000-0000-4000-8000-000000000011'::uuid
]) studio_id;
INSERT INTO public.studio_users(user_id,studio_id,stato) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','20000000-0000-4000-8000-000000000010','attivo');

-- Verified legacy shape only; rows are inserted by transactional tests.
CREATE TABLE public.plans (
  id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,
  voci jsonb DEFAULT '[]',stato text,sconto numeric DEFAULT 0,sconto_tipo text DEFAULT 'pct'
);
CREATE TABLE public.payments (
  id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,
  importo numeric,stato text DEFAULT 'pagato'
);
CREATE TABLE public.documenti_fiscali (
  id bigint PRIMARY KEY,studio_id uuid,paziente_id bigint,data date,tipo text,importo numeric
);
CREATE TABLE public.pagamenti_esterni (
  id bigint PRIMARY KEY,studio_id uuid,data date,importo numeric
);
CREATE TABLE public.spese (
  id bigint PRIMARY KEY,studio_id uuid,data date,importo numeric,tipo_costo text
);
