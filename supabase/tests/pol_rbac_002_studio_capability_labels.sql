-- POL-RBAC-002 regression: studio_capability_labels is purely presentational
-- and must never affect authorization. Run after
-- supabase/tests/pol_rbac_001_local_bootstrap.sql +
-- supabase/migrations/20260819200029_pol_rbac_001_authoritative_capabilities.sql
-- + supabase/tests/pol_rbac_001a_local_bootstrap.sql +
-- supabase/migrations/20260819210000_pol_rbac_001a_patient_care_assignment.sql
-- + supabase/migrations/20260821101836_pol_rbac_002_studio_capability_labels.sql
-- (see docs/architecture/pol-ux-002-studio-capability-labels-design.md).
--
-- Fixture (from pol_rbac_001_local_bootstrap.sql):
--   Studio A = 10000000-0000-4000-8000-000000000001
--     a...0001 admin/attivo   a...0002 utente/attivo (front desk capability)
--     a...0007 utente/sospeso
--   Studio B = 20000000-0000-4000-8000-000000000002
--     b...0001 admin/attivo   b...0002 utente/attivo

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(condition,false) THEN RAISE EXCEPTION 'assertion failed: %',message; END IF; END $$;

-- ── RBAC_REGRESSION: prove the new table changes nothing about the
-- existing, already-validated authoritative capability results. Re-asserts
-- a representative subset of pol_rbac_001_authoritative_capabilities.sql's
-- own assertions, now that studio_capability_labels exists alongside them.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','studio.owner'),'RBAC_REGRESSION: legacy admin keeps owner capability');
SELECT pg_temp.assert_true(public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','studio.manage_members'),'RBAC_REGRESSION: legacy admin keeps manage_members capability');
SELECT pg_temp.assert_true(NOT public.has_studio_capability_v1('10000000-0000-4000-8000-000000000001','clinical.physiotherapist'),'RBAC_REGRESSION: owner still not automatically clinical');
SELECT pg_temp.assert_true(NOT public.has_studio_capability_v1('20000000-0000-4000-8000-000000000002','studio.owner'),'RBAC_REGRESSION: owner still cannot cross tenant');
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000007"}',true);
SELECT pg_temp.assert_true(cardinality(public.get_my_studio_capabilities_v1('10000000-0000-4000-8000-000000000001'))=0,'RBAC_REGRESSION: suspended user still gets no capability');
RESET ROLE;

-- ── MULTITENANT_TESTS + write authorization ──

-- Admin A (has studio.manage_members) can write a label for Studio A.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
VALUES ('10000000-0000-4000-8000-000000000001','clinical.general','Igienista');
SELECT pg_temp.assert_true(
  (SELECT custom_label FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001' AND capability='clinical.general')='Igienista',
  'admin with studio.manage_members can insert a label for their own studio'
);

-- READ: any active member of Studio A sees it (not just the admin who wrote it).
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001')=1,
  'MULTITENANT_TESTS: active member (non-admin) can read their studio''s label'
);

-- WRITE without studio.manage_members is denied (front desk, no manage_members).
DO $$ BEGIN
  INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
  VALUES ('10000000-0000-4000-8000-000000000001','home.front_desk','Segreteria');
  RAISE EXCEPTION 'RBAC_REGRESSION: user without studio.manage_members inserted a label';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.studio_capability_labels SET custom_label='Hack' WHERE studio_id='10000000-0000-4000-8000-000000000001';
  IF FOUND THEN RAISE EXCEPTION 'user without studio.manage_members updated a label'; END IF;
END $$;
DO $$ BEGIN
  DELETE FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001';
  IF FOUND THEN RAISE EXCEPTION 'user without studio.manage_members deleted a label'; END IF;
END $$;

-- Suspended user (a...0007): no read, no write -- same as every other
-- capability check, membership must be active.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000007"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001')=0,
  'suspended member cannot read labels'
);

-- CROSS-TENANT: admin B cannot read Studio A's label...
SELECT set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001')=0,
  'MULTITENANT_TESTS: cross-tenant read is denied (admin B cannot see Studio A''s label)'
);
-- ...nor write one for Studio A, despite holding studio.manage_members in
-- their OWN studio (proves the check is evaluated against the row's
-- studio_id, not just "does the caller hold this capability anywhere").
DO $$ BEGIN
  INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
  VALUES ('10000000-0000-4000-8000-000000000001','clinical.general','Escalation');
  RAISE EXCEPTION 'MULTITENANT_TESTS: cross-tenant write succeeded (admin B wrote into Studio A)';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- Admin B CAN write their own studio's label -- proves the denial above was
-- tenant isolation, not a broken policy.
INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
VALUES ('20000000-0000-4000-8000-000000000002','clinical.general','Terapista');
SELECT pg_temp.assert_true(
  (SELECT custom_label FROM public.studio_capability_labels WHERE studio_id='20000000-0000-4000-8000-000000000002' AND capability='clinical.general')='Terapista',
  'admin B can write their own studio''s label'
);
-- And Studio A's earlier label is still exactly what admin A set -- the two
-- tenants' data never collided.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true(
  (SELECT custom_label FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001' AND capability='clinical.general')='Igienista',
  'Studio A label is unaffected by Studio B activity'
);

-- updated_by cannot be spoofed to another user.
DO $$ BEGIN
  UPDATE public.studio_capability_labels SET updated_by='a0000000-0000-4000-8000-000000000002'
  WHERE studio_id='10000000-0000-4000-8000-000000000001' AND capability='clinical.general';
  RAISE EXCEPTION 'updated_by was spoofed to a different user';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- CHECK constraints: capability vocabulary and non-empty label.
DO $$ BEGIN
  INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
  VALUES ('10000000-0000-4000-8000-000000000001','not.a.real.capability','x');
  RAISE EXCEPTION 'invalid capability value was accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.studio_capability_labels(studio_id,capability,custom_label)
  VALUES ('10000000-0000-4000-8000-000000000001','home.front_desk','   ');
  RAISE EXCEPTION 'blank custom_label was accepted';
EXCEPTION WHEN check_violation THEN NULL; END $$;

-- DELETE = reset to default: admin A removes the override.
DELETE FROM public.studio_capability_labels
WHERE studio_id='10000000-0000-4000-8000-000000000001' AND capability='clinical.general';
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_capability_labels WHERE studio_id='10000000-0000-4000-8000-000000000001' AND capability='clinical.general')=0,
  'delete removes the override row (client falls back to the vertical default)'
);

RESET ROLE;
ROLLBACK;
