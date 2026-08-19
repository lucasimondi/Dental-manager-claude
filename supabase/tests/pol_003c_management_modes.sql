-- POL-003C persistence and tenant-isolation tests. Synthetic database only.
BEGIN;

DO $defaults$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.studio_info WHERE management_control_mode='base';
  IF n<>2 THEN RAISE EXCEPTION 'FAIL existing studios did not default to base: %',n; END IF;
  BEGIN
    UPDATE public.studio_info SET management_control_mode='automatic'
      WHERE studio_id='3c000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL invalid mode accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$defaults$;

SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub','3caaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','role','authenticated',
  'app_metadata',jsonb_build_object('studio_id','3c000000-0000-4000-8000-000000000001'))::text,true);
SET LOCAL ROLE authenticated;

DO $tenant_a$
DECLARE n bigint; mode_a text;
BEGIN
  SELECT count(*) INTO n FROM public.studio_info;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL tenant A can see % studio rows',n; END IF;
  UPDATE public.studio_info SET management_control_mode='advanced'
    WHERE studio_id='3c000000-0000-4000-8000-000000000001';
  SELECT management_control_mode INTO mode_a FROM public.studio_info;
  IF mode_a<>'advanced' THEN RAISE EXCEPTION 'FAIL advanced mode did not persist'; END IF;
  UPDATE public.studio_info SET management_control_mode='advanced'
    WHERE studio_id='3c000000-0000-4000-8000-000000000002';
  IF FOUND THEN RAISE EXCEPTION 'FAIL tenant A updated tenant B'; END IF;
END
$tenant_a$;

RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub','3cbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','role','authenticated',
  'app_metadata',jsonb_build_object('studio_id','3c000000-0000-4000-8000-000000000002'))::text,true);
SET LOCAL ROLE authenticated;

DO $tenant_b$
DECLARE mode_b text;
BEGIN
  SELECT management_control_mode INTO mode_b FROM public.studio_info;
  IF mode_b<>'base' THEN RAISE EXCEPTION 'FAIL tenant B mode changed: %',mode_b; END IF;
END
$tenant_b$;

ROLLBACK;
