-- POL-RBAC-001A bootstrap extension. Runs after pol_rbac_001_local_bootstrap.sql
-- (studios A/B, users a1-a8/b1-b2, patient 101 in studio A, patient 201 in
-- studio B). Adds a second patient in studio A and an unassigned second
-- personal trainer, needed for the Studio A / Patient A / Patient B /
-- PT1-vs-PT2 scenarios required by POL-RBAC-001A.

INSERT INTO public.patients(id,studio_id) VALUES
  (102,'10000000-0000-4000-8000-000000000001');

INSERT INTO auth.users(id) VALUES
  ('a0000000-0000-4000-8000-000000000009'),
  ('a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.studio_users(user_id,studio_id,ruolo,stato) VALUES
  ('a0000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','utente','attivo'),
  ('a0000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','utente','attivo');
