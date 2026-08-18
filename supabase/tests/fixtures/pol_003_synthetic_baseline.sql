-- POL-003 synthetic-only prerequisite for a disposable local Supabase database.
-- It represents only the verified membership columns required by the migration.

CREATE TABLE public.studio_users (
  user_id uuid NOT NULL,
  studio_id uuid NOT NULL,
  stato text NOT NULL,
  PRIMARY KEY (user_id, studio_id)
);

ALTER TABLE public.studio_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.studio_users (user_id, studio_id, stato)
SELECT
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'attivo'
FROM generate_series(1, 12) AS n;

INSERT INTO public.studio_users (user_id, studio_id, stato)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '20000000-0000-4000-8000-000000000010',
  'attivo'
);
