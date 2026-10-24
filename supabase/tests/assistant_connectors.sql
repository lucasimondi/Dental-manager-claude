-- Run fixture + migration + this file against disposable PostgreSQL 17 only.
INSERT INTO public.poliedra_connector_clients(client_id,provider,resource_uri,enabled) VALUES
('00000000-0000-4000-8000-000000000011','chatgpt','https://clinic.example/api/mcp',true),
('00000000-0000-4000-8000-000000000012','gemini','https://clinic.example/api/mcp',true);
SET ROLE supabase_auth_admin;
DO $$ DECLARE output jsonb; BEGIN
 output:=public.poliedra_connector_access_token_hook('{"client_id":"00000000-0000-4000-8000-000000000011","claims":{"aud":"authenticated","sub":"test"}}');
 IF NOT output->'claims'->'aud' @> '["authenticated","https://clinic.example/api/mcp"]' THEN RAISE EXCEPTION 'resource audience missing'; END IF;
 output:=public.poliedra_connector_access_token_hook('{"claims":{"aud":"authenticated"}}');
 IF output->'claims'->>'aud' <> 'authenticated' THEN RAISE EXCEPTION 'ordinary session changed'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","client_id":"00000000-0000-4000-8000-000000000011","app_metadata":{"studio_id":"00000000-0000-4000-8000-000000000101"}}';
INSERT INTO public.poliedra_connector_requests(id,studio_id,user_id,client_id,summary,proposal_token,expires_at) VALUES
('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','Synthetic implant proposal','synthetic-token',now()+interval '10 minutes');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.poliedra_connector_requests)<>1 THEN RAISE EXCEPTION 'own request unavailable'; END IF;
 BEGIN
 INSERT INTO public.poliedra_connector_requests(id,studio_id,user_id,client_id,summary,proposal_token,expires_at) VALUES
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','Cross tenant','synthetic-token',now()+interval '10 minutes');
 RAISE EXCEPTION 'cross tenant INSERT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.poliedra_connector_requests SET proposal_token='tampered'; RAISE EXCEPTION 'token mutable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.poliedra_connector_requests SET status='done';
 IF NOT EXISTS(SELECT 1 FROM public.poliedra_connector_requests WHERE status='done') THEN RAISE EXCEPTION 'matching OAuth client cannot record outcome'; END IF;
 UPDATE public.poliedra_connector_requests SET status='pending';
 BEGIN PERFORM public.poliedra_connector_access_token_hook('{}'); RAISE EXCEPTION 'authenticated can mint audience'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","client_id":"00000000-0000-4000-8000-000000000011","app_metadata":{"studio_id":"00000000-0000-4000-8000-000000000102"}}';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.poliedra_connector_requests) THEN RAISE EXCEPTION 'other tenant can read request'; END IF; END $$;
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","client_id":"00000000-0000-4000-8000-000000000012","app_metadata":{"studio_id":"00000000-0000-4000-8000-000000000101"}}';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.poliedra_connector_requests) THEN RAISE EXCEPTION 'other assistant can read request'; END IF; END $$;
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"00000000-0000-4000-8000-000000000101"}}';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.poliedra_connector_requests)<>1 THEN RAISE EXCEPTION 'first-party review missing'; END IF;
 UPDATE public.poliedra_connector_requests SET status='done',result='{"text":"synthetic verified result"}';
 IF NOT EXISTS(SELECT 1 FROM public.poliedra_connector_requests WHERE status='done') THEN RAISE EXCEPTION 'first-party completion unavailable'; END IF;
END $$;
RESET ROLE;
UPDATE public.studio_users SET clinical=false WHERE user_id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"00000000-0000-4000-8000-000000000101"}}';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.poliedra_connector_requests) THEN RAISE EXCEPTION 'revoked clinician can read clinical request'; END IF; END $$;
RESET ROLE;
SELECT 'assistant connector tenant/RLS/audience tests passed' AS result;
INSERT INTO public.poliedra_connector_requests(id,studio_id,user_id,client_id,summary,proposal_token,expires_at,created_at) VALUES
('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','Expired synthetic proposal','synthetic-token',now()-interval '2 days',now()-interval '2 days');
SET ROLE service_role;
DO $$ BEGIN IF public.purge_poliedra_connector_requests()<>1 THEN RAISE EXCEPTION 'retention purge failed'; END IF; END $$;
RESET ROLE;
