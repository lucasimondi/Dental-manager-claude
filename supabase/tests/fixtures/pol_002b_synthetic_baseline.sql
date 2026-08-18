-- POL-002B synthetic-only baseline for a disposable local Supabase instance.
-- This file intentionally contains no production data or inferred production schema.

CREATE TABLE public.patients (
  id bigint PRIMARY KEY,
  studio_id uuid NOT NULL
);

CREATE TABLE public.studio_users (
  user_id uuid NOT NULL,
  studio_id uuid NOT NULL,
  stato text NOT NULL,
  PRIMARY KEY (user_id, studio_id)
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_users ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.patients, public.studio_users TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', true);
