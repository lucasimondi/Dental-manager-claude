BEGIN;
INSERT INTO public.studio_users VALUES
 ('a1000000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','attivo'),
 ('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','attivo'),
 ('c1000000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001','sospeso');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.user_home_layouts(studio_id,user_id,layout) VALUES
 ('a1100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','[{"id":"agenda","visible":true,"size":"wide"}]');
UPDATE public.user_home_layouts SET layout='[{"id":"todo","visible":true,"size":"medium"}]'
 WHERE studio_id='a1100000-0000-4000-8000-000000000001';
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.user_home_layouts;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL own layout read/update'; END IF;
END $$;

RESET ROLE;
INSERT INTO public.user_home_layouts(studio_id,user_id,layout) VALUES
 ('b1100000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','[]');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.user_home_layouts WHERE studio_id='b1100000-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'FAIL cross-tenant read'; END IF;
END $$;
DO $$ DECLARE n integer; BEGIN
 UPDATE public.user_home_layouts SET layout='[{"id":"leak"}]'
  WHERE studio_id='b1100000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL cross-tenant update'; END IF;
END $$;

DO $$ BEGIN
 BEGIN
  INSERT INTO public.user_home_layouts(studio_id,user_id,layout) VALUES
   ('b1100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','[]');
  RAISE EXCEPTION 'FAIL cross-tenant insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.user_home_layouts(studio_id,user_id,layout) VALUES
   ('c1100000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','[]');
  RAISE EXCEPTION 'FAIL suspended membership insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
ROLLBACK;
