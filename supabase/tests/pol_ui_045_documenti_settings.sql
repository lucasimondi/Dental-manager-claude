-- POL-UI-045 documenti_settings: tipo e isolamento tra studi.
-- Database sintetico: pol_003c_local_bootstrap.sql -> migration POL-UI-045.
BEGIN;

DO $defaults$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.studio_info WHERE documenti_settings IS NULL;
  IF n<>2 THEN RAISE EXCEPTION 'FAIL existing studios must start with NULL (predefiniti): %',n; END IF;
  BEGIN
    UPDATE public.studio_info SET documenti_settings='[true]'::jsonb
      WHERE studio_id='3c000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL non-object value accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$defaults$;

SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub','3caaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','role','authenticated',
  'app_metadata',jsonb_build_object('studio_id','3c000000-0000-4000-8000-000000000001'))::text,true);
SET LOCAL ROLE authenticated;

DO $tenant_a$
DECLARE v jsonb;
BEGIN
  UPDATE public.studio_info SET documenti_settings='{"ricetta":false,"protocollo":true}'::jsonb
    WHERE studio_id='3c000000-0000-4000-8000-000000000001';
  SELECT documenti_settings INTO v FROM public.studio_info;
  IF (v->>'ricetta')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL documenti_settings did not persist'; END IF;
  UPDATE public.studio_info SET documenti_settings='{}'::jsonb
    WHERE studio_id='3c000000-0000-4000-8000-000000000002';
  IF FOUND THEN RAISE EXCEPTION 'FAIL tenant A updated tenant B documenti_settings'; END IF;
END
$tenant_a$;

RESET ROLE;
DO $tenant_b_untouched$
BEGIN
  IF (SELECT documenti_settings FROM public.studio_info WHERE studio_id='3c000000-0000-4000-8000-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL tenant B documenti_settings changed';
  END IF;
END
$tenant_b_untouched$;

ROLLBACK;
SELECT 'POL-UI-045 documenti_settings PASS' AS result;
