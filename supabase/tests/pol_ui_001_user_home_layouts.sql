BEGIN;
INSERT INTO public.studio_users VALUES
 ('a1000000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','attivo','admin'),
 ('a1000000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000001','attivo','member'),
 ('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','attivo','admin'),
 ('c1000000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001','sospeso','admin');

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

-- Admin defines a tenant default; active members inherit it but cannot change it.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.studio_home_layouts(studio_id,layout,updated_by) VALUES
 ('a1100000-0000-4000-8000-000000000001','[{"id":"agenda","visible":true,"size":"wide"}]','a1000000-0000-4000-8000-000000000001');

SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002"}',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.studio_home_layouts;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL active member cannot inherit studio default'; END IF;
END $$;
INSERT INTO public.user_home_layouts(studio_id,user_id,layout) VALUES
 ('a1100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','[{"id":"todo","visible":true,"size":"medium"}]');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.studio_home_layouts SET layout='[]',updated_by='a1000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL non-admin changed studio default'; END IF;
END $$;

-- Reset deletes only the personal override; the tenant default remains.
DELETE FROM public.user_home_layouts
 WHERE studio_id='a1100000-0000-4000-8000-000000000001'
   AND user_id='a1000000-0000-4000-8000-000000000002';
DO $$ DECLARE user_n integer; studio_n integer; BEGIN
 SELECT count(*) INTO user_n FROM public.user_home_layouts;
 SELECT count(*) INTO studio_n FROM public.studio_home_layouts;
 IF user_n<>0 OR studio_n<>1 THEN RAISE EXCEPTION 'FAIL reset inheritance'; END IF;
END $$;

-- The second tenant is isolated from tenant A.
RESET ROLE;
INSERT INTO public.studio_home_layouts(studio_id,layout,updated_by) VALUES
 ('b1100000-0000-4000-8000-000000000001','[{"id":"economico","visible":true,"size":"medium"}]','b1000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002"}',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.studio_home_layouts;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL cross-tenant studio default read'; END IF;
END $$;
DO $$ DECLARE n integer; BEGIN
 UPDATE public.studio_home_layouts SET layout='[]',updated_by='a1000000-0000-4000-8000-000000000002'
  WHERE studio_id='b1100000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL cross-tenant studio default update'; END IF;
END $$;

-- Suspended admins cannot see or create studio defaults.
SELECT set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.studio_home_layouts;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL suspended member read studio defaults'; END IF;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.studio_home_layouts(studio_id,layout,updated_by) VALUES
   ('c1100000-0000-4000-8000-000000000001','[]','c1000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAIL suspended admin studio default allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
ROLLBACK;
