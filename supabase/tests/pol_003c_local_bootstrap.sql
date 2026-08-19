-- Minimal synthetic Supabase/PostgreSQL 17 bootstrap for POL-003C.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.studio_info(
  studio_id uuid PRIMARY KEY,
  nome text
);
ALTER TABLE public.studio_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_info_studio ON public.studio_info FOR ALL
  USING (studio_id=((auth.jwt()->'app_metadata'->>'studio_id')::uuid))
  WITH CHECK (studio_id=((auth.jwt()->'app_metadata'->>'studio_id')::uuid));
GRANT SELECT,UPDATE ON public.studio_info TO authenticated;
INSERT INTO public.studio_info(studio_id,nome) VALUES
  ('3c000000-0000-4000-8000-000000000001','Synthetic A'),
  ('3c000000-0000-4000-8000-000000000002','Synthetic B');
