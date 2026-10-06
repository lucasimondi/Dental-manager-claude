-- Run after the synthetic fixture and migration, in an isolated database.
CREATE FUNCTION pg_temp.expect_error(statement text, pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE pattern THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF;
   RETURN;
 END;
 RAISE EXCEPTION 'Expected failure: %', statement;
END $$;
SELECT set_config('test.user','10000000-0000-0000-0000-000000000001',false);
SELECT set_config('test.studio','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-04","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato","operatore_id":1}');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-04","ora":"09:15","durata":30,"tipo":"Controllo","stato":"confermato","operatore_id":1}')$q$,'%Orario occupato%');
-- Another operator is available; failed conflict did not consume its claim.
SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-04","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato","operatore_id":2}');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-05","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato"}')$q$,'%duplicate key%');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":2,"data":"2099-10-05","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato"}')$q$,'%Paziente non disponibile%');
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',null,
 '{"paziente_id":2,"data":"2099-10-05","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato"}')$q$,'%Accesso%');
DO $$ DECLARE old jsonb; newrow jsonb; rid bigint; BEGIN
 SELECT to_jsonb(a) INTO old FROM appointments a WHERE operatore_id=1;
 newrow := old || '{"ora":"10:00"}'::jsonb;
 rid := public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001',old,newrow);
 PERFORM pg_temp.expect_error(format('SELECT public.poliedron_execute_agenda_v1(%L,%L,%L::jsonb,%L::jsonb)',
  '20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',old,newrow),'%modificato nel frattempo%');
 SELECT to_jsonb(a) INTO old FROM appointments a WHERE id=rid;
 PERFORM public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001',old,old||'{"stato":"annullato"}'::jsonb);
 IF (SELECT count(*) FROM appointments WHERE id=rid AND stato='annullato') <> 1 THEN RAISE EXCEPTION 'Cancellation lost history'; END IF;
END $$;
SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-04","ora":"10:00","durata":30,"tipo":"Controllo","stato":"confermato","operatore_id":1}');
SELECT pg_temp.expect_error($q$DELETE FROM poliedron_action_claims$q$,'%permission denied%');
INSERT INTO impegni_personali VALUES (1,'00000000-0000-0000-0000-000000000001','2099-10-06','2099-10-06',true,null,null);
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-06","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato"}')$q$,'%Orario occupato%');
RESET ROLE;
UPDATE studio_users SET stato='sospeso' WHERE user_id='10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001',null,
 '{"paziente_id":1,"data":"2099-10-07","ora":"09:00","durata":30,"tipo":"Controllo","stato":"confermato"}')$q$,'%Accesso%');
SELECT pg_temp.expect_error($q$INSERT INTO poliedron_action_claims(id,studio_id,user_id) VALUES ('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')$q$,'%row-level security%');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT public.poliedron_execute_agenda_v1('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001',null,'{}')$q$,'%permission denied%');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM appointments) <> 3 THEN RAISE EXCEPTION 'Unexpected writes'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='poliedron_execute_agenda_v1' AND prosecdef) THEN RAISE EXCEPTION 'Definer forbidden'; END IF;
END $$;
