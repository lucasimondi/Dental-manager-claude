BEGIN;

INSERT INTO auth.users(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','admin-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','physio-a@example.test'),
 ('10000000-0000-4000-8000-000000000003','trainer-a@example.test'),
 ('10000000-0000-4000-8000-000000000004','front-a@example.test'),
 ('10000000-0000-4000-8000-000000000005','massage-a@example.test'),
 ('20000000-0000-4000-8000-000000000002','physio-b@example.test'),
 ('90000000-0000-4000-8000-000000000009','outsider@example.test');
INSERT INTO public.studios(id,nome) VALUES
 ('11000000-0000-4000-8000-000000000001','Studio A'),
 ('22000000-0000-4000-8000-000000000002','Studio B');
INSERT INTO public.patients(id,studio_id,nome,cognome) VALUES
 (101,'11000000-0000-4000-8000-000000000001','Ada','Synthetic'),
 (102,'11000000-0000-4000-8000-000000000001','Existing','Synthetic'),
 (201,'22000000-0000-4000-8000-000000000002','Bruno','Synthetic');
INSERT INTO public.studio_users(studio_id,user_id,ruolo,stato) VALUES
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','admin','attivo'),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','utente','attivo'),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','utente','attivo'),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','utente','attivo'),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','utente','attivo'),
 ('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','utente','attivo');
INSERT INTO public.appointments(id,studio_id,paziente_id,data,stato) VALUES
 (1001,'11000000-0000-4000-8000-000000000001',101,'2026-08-19','confermato');
INSERT INTO public.physio_clinical_access_v1(studio_id,user_id,professional_role,clinical_read,clinical_write,clinical_finalize,clinical_documents) VALUES
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','physiotherapist',true,true,true,true),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','personal_trainer',true,false,false,false),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','front_desk',false,false,false,false),
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','massage_therapist',true,true,false,false),
 ('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','physiotherapist',true,true,true,true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","app_metadata":{"studio_id":"11000000-0000-4000-8000-000000000001"}}',true);

INSERT INTO public.physio_episodes_v1(studio_id,patient_id,title,primary_problem,body_region,status,responsible_user_id,created_by)
VALUES('11000000-0000-4000-8000-000000000001',101,'Lombalgia 2026','Dolore lombare','lombare','active','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');

DO $$ BEGIN
  BEGIN
    INSERT INTO public.physio_episodes_v1(studio_id,patient_id,title,created_by)
    VALUES('11000000-0000-4000-8000-000000000001',201,'Cross tenant','10000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'FAIL cross-tenant patient accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;

INSERT INTO public.physio_anamneses_v1(studio_id,episode_id,consultation_reason,main_complaint,clinical_history,diagnostic_exams,medications,work_activity,physical_activity,red_flags,free_note,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'Valutazione','Lombalgia','Storia sintetica','RM sintetica','Nessuno','Impiegata','Cammino','Nessuna red flag','Ampia nota libera','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_body_maps_v1(studio_id,episode_id,view,markers,drawing,note,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'back','[{"region":"Lombare","symptom":"dolore"}]','[]','Baseline sintetica','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_problems_v1(studio_id,episode_id,description,priority,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'Limitazione flessione',2,'10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_goals_v1(studio_id,episode_id,problem_id,goal_kind,horizon,description,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,1,'patient','short','Riprendere cammino','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_plan_versions_v1(studio_id,episode_id,version_number,objectives,strategy,planned_frequency,responsible_user_id,free_note,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,1,'Ridurre limitazione','Educazione ed esercizio','2/settimana','10000000-0000-4000-8000-000000000002','Piano sintetico','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_outcomes_v1(studio_id,episode_id,phase,scale_identifier,scale_name,raw_score,unit,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'baseline','custom-walk','Cammino autoriportato',4,'minuti','10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    UPDATE public.physio_plan_versions_v1 SET strategy='Riscrittura vietata' WHERE id=1;
    RAISE EXCEPTION 'FAIL plan version changed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;

INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,status,pre_pain,interventions,post_pain,free_note,created_by)
VALUES
 ('11000000-0000-4000-8000-000000000001',1,'assessment','draft',5,'Valutazione sintetica',5,'Valutazione libera','10000000-0000-4000-8000-000000000002'),
 ('11000000-0000-4000-8000-000000000001',1,'session','draft',5,'Mobilizzazione ed esercizio',3,'Seduta rapida sintetica','10000000-0000-4000-8000-000000000002');
UPDATE public.physio_clinical_notes_v1 SET status='finalized',finalized_by='10000000-0000-4000-8000-000000000002',finalized_at=now() WHERE id=2;

DO $$ BEGIN
  BEGIN
    UPDATE public.physio_clinical_notes_v1 SET free_note='Riscrittura vietata' WHERE id=2;
    RAISE EXCEPTION 'FAIL finalized note changed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;

INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,status,amends_note_id,free_note,structured_data,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'session','amendment',2,'Correzione tracciata','{"correction_only":true}','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,status,copied_from_id,interventions,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'session','draft',2,'Copia esplicitamente confermata','10000000-0000-4000-8000-000000000002');
INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,status,free_note,created_by) VALUES
 ('11000000-0000-4000-8000-000000000001',1,'reassessment','draft','Prima → oggi sintetico','10000000-0000-4000-8000-000000000002'),
 ('11000000-0000-4000-8000-000000000001',1,'discharge','draft','Dimissione sintetica','10000000-0000-4000-8000-000000000002');

DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.physio_clinical_audit_v1 WHERE studio_id='11000000-0000-4000-8000-000000000001';
  IF n<14 THEN RAISE EXCEPTION 'FAIL audit rows expected >=14, got %',n; END IF;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","app_metadata":{"studio_id":"11000000-0000-4000-8000-000000000001"}}',true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.physio_episodes_v1;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL trainer read expected 1 got %',n; END IF;
  BEGIN
    INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,free_note,created_by)
    VALUES('11000000-0000-4000-8000-000000000001',1,'session','Vietata','10000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FAIL trainer wrote clinical note';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","app_metadata":{"studio_id":"11000000-0000-4000-8000-000000000001"}}',true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.physio_episodes_v1;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL front desk saw clinical rows'; END IF;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","app_metadata":{"studio_id":"11000000-0000-4000-8000-000000000001"}}',true);
INSERT INTO public.physio_clinical_notes_v1(studio_id,episode_id,note_type,free_note,created_by)
VALUES('11000000-0000-4000-8000-000000000001',1,'session','Bozza nel dominio autorizzato','10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  BEGIN
    UPDATE public.physio_clinical_notes_v1 SET status='finalized',finalized_by='10000000-0000-4000-8000-000000000005',finalized_at=now() WHERE created_by='10000000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'FAIL massage therapist finalized note';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","app_metadata":{"studio_id":"22000000-0000-4000-8000-000000000002"}}',true);
INSERT INTO public.physio_episodes_v1(studio_id,patient_id,title,status,created_by)
VALUES('22000000-0000-4000-8000-000000000002',201,'Spalla sintetica','active','20000000-0000-4000-8000-000000000002');
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.physio_episodes_v1;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL tenant B expected only own episode'; END IF;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000009","app_metadata":{"studio_id":"11000000-0000-4000-8000-000000000001"}}',true);
DO $$ DECLARE n integer; BEGIN SELECT count(*) INTO n FROM public.physio_episodes_v1; IF n<>0 THEN RAISE EXCEPTION 'FAIL outsider access'; END IF; END $$;

RESET ROLE;
ROLLBACK;
