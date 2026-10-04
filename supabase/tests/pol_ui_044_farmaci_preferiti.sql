-- POL-UI-044 farmaci_preferiti: tipo, limite e isolamento tra studi.
-- Database sintetico: pol_003c_local_bootstrap.sql -> migration POL-UI-044.
BEGIN;

DO $defaults$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.studio_info WHERE farmaci_preferiti IS NULL;
  IF n<>2 THEN RAISE EXCEPTION 'FAIL existing studios must start with NULL (lista iniziale): %',n; END IF;
  BEGIN
    UPDATE public.studio_info SET farmaci_preferiti='{"farmaco":"x"}'::jsonb
      WHERE studio_id='3c000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL non-array value accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.studio_info
      SET farmaci_preferiti=(SELECT jsonb_agg(jsonb_build_object('id','x'||g,'farmaco','F'||g)) FROM generate_series(1,61) g)
      WHERE studio_id='3c000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL more than 60 shortcuts accepted';
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
  UPDATE public.studio_info SET farmaci_preferiti='[{"id":"a","farmaco":"Zitromax 500 mg"}]'::jsonb
    WHERE studio_id='3c000000-0000-4000-8000-000000000001';
  SELECT farmaci_preferiti INTO v FROM public.studio_info;
  IF v->0->>'farmaco'<>'Zitromax 500 mg' THEN RAISE EXCEPTION 'FAIL shortcut did not persist'; END IF;
  UPDATE public.studio_info SET farmaci_preferiti='[]'::jsonb
    WHERE studio_id='3c000000-0000-4000-8000-000000000002';
  IF FOUND THEN RAISE EXCEPTION 'FAIL tenant A updated tenant B shortcuts'; END IF;
END
$tenant_a$;

RESET ROLE;
DO $tenant_b_untouched$
BEGIN
  IF (SELECT farmaci_preferiti FROM public.studio_info WHERE studio_id='3c000000-0000-4000-8000-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL tenant B shortcuts changed';
  END IF;
END
$tenant_b_untouched$;

ROLLBACK;
SELECT 'POL-UI-044 farmaci_preferiti PASS' AS result;
