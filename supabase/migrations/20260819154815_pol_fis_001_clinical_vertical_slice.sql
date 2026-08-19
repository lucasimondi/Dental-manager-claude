-- POL-FIS-001 B/C vertical slice. Prepared for local validation only.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.physio_clinical_access_v1 (
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  professional_role text NOT NULL CHECK (professional_role IN
    ('owner','physiotherapist','personal_trainer','massage_therapist','other_clinician','front_desk')),
  clinical_read boolean NOT NULL DEFAULT false,
  clinical_write boolean NOT NULL DEFAULT false,
  clinical_finalize boolean NOT NULL DEFAULT false,
  clinical_documents boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id,user_id)
);

ALTER TABLE public.physio_clinical_access_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.physio_clinical_access_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.physio_clinical_access_v1 TO authenticated;

CREATE OR REPLACE FUNCTION private.pol_fis_001_is_active_member(p_studio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.studio_users su
      WHERE su.user_id=auth.uid() AND su.studio_id=p_studio_id AND su.stato='attivo'
    );
$function$;

CREATE OR REPLACE FUNCTION private.pol_fis_001_is_admin(p_studio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT private.pol_fis_001_is_active_member(p_studio_id)
    AND EXISTS (
      SELECT 1 FROM public.studio_users su
      WHERE su.user_id=auth.uid() AND su.studio_id=p_studio_id
        AND su.stato='attivo' AND su.ruolo='admin'
    );
$function$;

CREATE OR REPLACE FUNCTION private.pol_fis_001_has_capability(p_studio_id uuid,p_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT private.pol_fis_001_is_active_member(p_studio_id)
    AND (
      private.pol_fis_001_is_admin(p_studio_id)
      OR EXISTS (
        SELECT 1 FROM public.physio_clinical_access_v1 a
        WHERE a.studio_id=p_studio_id AND a.user_id=auth.uid()
          AND CASE p_capability
            WHEN 'read' THEN a.clinical_read
            WHEN 'write' THEN a.clinical_write
            WHEN 'finalize' THEN a.clinical_finalize
            WHEN 'documents' THEN a.clinical_documents
            ELSE false
          END
      )
    );
$function$;

REVOKE ALL ON FUNCTION private.pol_fis_001_is_active_member(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.pol_fis_001_is_admin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.pol_fis_001_has_capability(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.pol_fis_001_is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.pol_fis_001_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.pol_fis_001_has_capability(uuid,text) TO authenticated;

CREATE POLICY physio_access_select ON public.physio_clinical_access_v1 FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR private.pol_fis_001_is_admin(studio_id));
CREATE POLICY physio_access_insert ON public.physio_clinical_access_v1 FOR INSERT TO authenticated
WITH CHECK (private.pol_fis_001_is_admin(studio_id));
CREATE POLICY physio_access_update ON public.physio_clinical_access_v1 FOR UPDATE TO authenticated
USING (private.pol_fis_001_is_admin(studio_id)) WITH CHECK (private.pol_fis_001_is_admin(studio_id));
CREATE POLICY physio_access_delete ON public.physio_clinical_access_v1 FOR DELETE TO authenticated
USING (private.pol_fis_001_is_admin(studio_id));

CREATE TABLE public.physio_episodes_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  patient_id bigint NOT NULL REFERENCES public.patients(id),
  title text NOT NULL CHECK (btrim(title)<>''),
  primary_problem text,
  body_region text,
  diagnosis_report text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  responsible_user_id uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id,id),
  CHECK (ended_on IS NULL OR ended_on>=started_on)
);

CREATE TABLE public.physio_anamneses_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  consultation_reason text,
  main_complaint text,
  onset_description text,
  trend text,
  trauma_mechanism text,
  previous_episodes text,
  clinical_history text,
  comorbidities text,
  surgeries text,
  specialist_visits text,
  diagnostic_exams text,
  medications text,
  allergies text,
  general_practitioner text,
  specialist text,
  referrer text,
  work_activity text,
  physical_activity text,
  functional_limitations text,
  aggravating_factors text,
  easing_factors text,
  patient_expectations text,
  red_flags text,
  free_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id,episode_id),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE
);

CREATE TABLE public.physio_body_maps_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  view text NOT NULL CHECK (view IN ('front','back','left','right')),
  markers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(markers)='array'),
  drawing jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(drawing)='array'),
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE
);

CREATE TABLE public.physio_problems_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  description text NOT NULL CHECK (btrim(description)<>''),
  region text,
  priority smallint CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','improving','stable','resolved')),
  detected_on date NOT NULL DEFAULT CURRENT_DATE,
  resolved_on date,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id,id),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE
);

CREATE TABLE public.physio_goals_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  problem_id bigint,
  goal_kind text NOT NULL CHECK (goal_kind IN ('patient','therapeutic')),
  horizon text NOT NULL CHECK (horizon IN ('short','medium','long')),
  description text NOT NULL CHECK (btrim(description)<>''),
  status text NOT NULL DEFAULT 'to_achieve' CHECK (status IN ('to_achieve','improving','achieved','suspended')),
  target_on date,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id,problem_id) REFERENCES public.physio_problems_v1(studio_id,id)
);

CREATE TABLE public.physio_plan_versions_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  version_number integer NOT NULL CHECK (version_number>0),
  objectives text,
  strategy text,
  techniques text,
  planned_frequency text,
  expected_duration text,
  reassessment_on date,
  responsible_user_id uuid REFERENCES auth.users(id),
  collaborators jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(collaborators)='array'),
  home_program_note text,
  free_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id,episode_id,version_number),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE
);

CREATE TABLE public.physio_clinical_notes_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  appointment_id bigint REFERENCES public.appointments(id),
  note_type text NOT NULL CHECK (note_type IN ('free_note','assessment','session','reassessment','discharge')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','amendment')),
  pre_pain numeric CHECK (pre_pain BETWEEN 0 AND 10),
  trend text CHECK (trend IS NULL OR trend IN ('improved','stable','worse','not_comparable')),
  subjective_update text,
  interventions text,
  exercises text,
  response text,
  post_pain numeric CHECK (post_pain BETWEEN 0 AND 10),
  home_instructions text,
  next_step text,
  adverse_events text,
  free_note text,
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(structured_data)='object'),
  copied_from_id bigint,
  amends_note_id bigint,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_by uuid REFERENCES auth.users(id),
  finalized_at timestamptz,
  UNIQUE(studio_id,id),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id,copied_from_id) REFERENCES public.physio_clinical_notes_v1(studio_id,id),
  FOREIGN KEY (studio_id,amends_note_id) REFERENCES public.physio_clinical_notes_v1(studio_id,id),
  CHECK ((status='finalized' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL)
      OR (status<>'finalized' AND finalized_by IS NULL AND finalized_at IS NULL)),
  CHECK ((status='amendment' AND amends_note_id IS NOT NULL) OR (status<>'amendment' AND amends_note_id IS NULL))
);

CREATE TABLE public.physio_outcomes_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  episode_id bigint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  phase text NOT NULL CHECK (phase IN ('baseline','reassessment','discharge')),
  scale_identifier text NOT NULL,
  scale_name text NOT NULL,
  raw_score numeric,
  normalized_score numeric,
  unit text,
  clinician_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  FOREIGN KEY (studio_id,episode_id) REFERENCES public.physio_episodes_v1(studio_id,id) ON DELETE CASCADE
);

CREATE TABLE public.physio_clinical_audit_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  entity_table text NOT NULL,
  entity_id bigint NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  old_status text,
  new_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION private.pol_fis_001_validate_episode_patient_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=NEW.patient_id AND p.studio_id=NEW.studio_id) THEN
    RAISE EXCEPTION 'POL-FIS-001: patient must belong to the episode tenant' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.pol_fis_001_protect_note_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status='amendment' AND NOT EXISTS (
      SELECT 1 FROM public.physio_clinical_notes_v1 n
      WHERE n.studio_id=NEW.studio_id AND n.episode_id=NEW.episode_id
        AND n.id=NEW.amends_note_id AND n.status='finalized'
    ) THEN
      RAISE EXCEPTION 'POL-FIS-001: an amendment must reference a finalized note in the same episode' USING ERRCODE='23503';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('finalized','amendment') THEN
    RAISE EXCEPTION 'POL-FIS-001: closed clinical notes are immutable; create an amendment' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.status='finalized' AND NOT private.pol_fis_001_has_capability(NEW.studio_id,'finalize') THEN
    RAISE EXCEPTION 'POL-FIS-001: finalization not authorized' USING ERRCODE='42501';
  END IF;
  IF NEW.status='amendment' THEN
    RAISE EXCEPTION 'POL-FIS-001: amendments are inserted as new records' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.pol_fis_001_audit_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_studio_id uuid; v_entity_id bigint; v_action text; v_old_status text; v_new_status text;
BEGIN
  IF TG_OP='DELETE' THEN
    v_studio_id:=OLD.studio_id; v_entity_id:=OLD.id;
    v_old_status:=to_jsonb(OLD)->>'status';
  ELSE
    v_studio_id:=NEW.studio_id; v_entity_id:=NEW.id;
    v_new_status:=to_jsonb(NEW)->>'status';
    IF TG_OP='UPDATE' THEN v_old_status:=to_jsonb(OLD)->>'status'; END IF;
  END IF;
  v_action:=lower(TG_OP);
  IF TG_TABLE_NAME='physio_clinical_notes_v1' AND TG_OP='UPDATE' AND v_old_status='draft' AND v_new_status='finalized' THEN
    v_action:='finalize';
  ELSIF TG_TABLE_NAME='physio_clinical_notes_v1' AND TG_OP='INSERT' AND v_new_status='amendment' THEN
    v_action:='amend';
  END IF;
  INSERT INTO public.physio_clinical_audit_v1(studio_id,entity_table,entity_id,action,actor_id,old_status,new_status)
  VALUES(v_studio_id,TG_TABLE_NAME,v_entity_id,v_action,auth.uid(),v_old_status,v_new_status);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END
$function$;

CREATE OR REPLACE FUNCTION private.pol_fis_001_append_only_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
BEGIN
  RAISE EXCEPTION 'POL-FIS-001: historical snapshots are append-only' USING ERRCODE='55000';
END
$function$;

REVOKE ALL ON FUNCTION private.pol_fis_001_validate_episode_patient_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.pol_fis_001_protect_note_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.pol_fis_001_audit_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.pol_fis_001_append_only_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER physio_episode_patient_tenant BEFORE INSERT OR UPDATE ON public.physio_episodes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_validate_episode_patient_v1();
CREATE TRIGGER physio_note_protect BEFORE INSERT OR UPDATE OR DELETE ON public.physio_clinical_notes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_protect_note_v1();
CREATE TRIGGER physio_body_map_append_only BEFORE UPDATE OR DELETE ON public.physio_body_maps_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_append_only_v1();
CREATE TRIGGER physio_plan_version_append_only BEFORE UPDATE OR DELETE ON public.physio_plan_versions_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_append_only_v1();
CREATE TRIGGER physio_outcome_append_only BEFORE UPDATE OR DELETE ON public.physio_outcomes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_append_only_v1();

CREATE TRIGGER physio_episode_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_episodes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_anamnesis_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_anamneses_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_note_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_clinical_notes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_body_map_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_body_maps_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_problem_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_problems_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_goal_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_goals_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_plan_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_plan_versions_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();
CREATE TRIGGER physio_outcome_audit AFTER INSERT OR UPDATE OR DELETE ON public.physio_outcomes_v1
FOR EACH ROW EXECUTE FUNCTION private.pol_fis_001_audit_v1();

DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'physio_episodes_v1','physio_anamneses_v1','physio_body_maps_v1','physio_problems_v1',
    'physio_goals_v1','physio_plan_versions_v1','physio_clinical_notes_v1','physio_outcomes_v1'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.pol_fis_001_has_capability(studio_id,''read''))',t||'_select',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.pol_fis_001_has_capability(studio_id,''write'') AND created_by=(SELECT auth.uid()))',t||'_insert',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.pol_fis_001_has_capability(studio_id,''write'') AND (created_by=(SELECT auth.uid()) OR private.pol_fis_001_is_admin(studio_id))) WITH CHECK (private.pol_fis_001_has_capability(studio_id,''write'') AND (created_by=(SELECT auth.uid()) OR private.pol_fis_001_is_admin(studio_id)))',t||'_update',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.pol_fis_001_is_admin(studio_id))',t||'_delete',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;
END
$policies$;

ALTER TABLE public.physio_clinical_audit_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY physio_audit_select ON public.physio_clinical_audit_v1 FOR SELECT TO authenticated
USING (private.pol_fis_001_has_capability(studio_id,'read'));
REVOKE ALL ON public.physio_clinical_audit_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.physio_clinical_audit_v1 TO authenticated;

GRANT USAGE,SELECT ON SEQUENCE
  public.physio_episodes_v1_id_seq,
  public.physio_anamneses_v1_id_seq,
  public.physio_body_maps_v1_id_seq,
  public.physio_problems_v1_id_seq,
  public.physio_goals_v1_id_seq,
  public.physio_plan_versions_v1_id_seq,
  public.physio_clinical_notes_v1_id_seq,
  public.physio_outcomes_v1_id_seq
TO authenticated;

CREATE INDEX physio_episodes_patient_status_idx ON public.physio_episodes_v1(studio_id,patient_id,status);
CREATE INDEX physio_notes_episode_time_idx ON public.physio_clinical_notes_v1(studio_id,episode_id,occurred_at DESC);
CREATE INDEX physio_body_maps_episode_time_idx ON public.physio_body_maps_v1(studio_id,episode_id,recorded_at DESC);
CREATE INDEX physio_outcomes_episode_time_idx ON public.physio_outcomes_v1(studio_id,episode_id,recorded_at DESC);
CREATE INDEX physio_audit_entity_idx ON public.physio_clinical_audit_v1(studio_id,entity_table,entity_id,occurred_at DESC);

COMMENT ON TABLE public.physio_episodes_v1 IS 'POL-FIS-001 episode boundary; no legacy row is backfilled by this migration.';
COMMENT ON TABLE public.physio_clinical_notes_v1 IS 'Draft/finalized/amendment clinical notes. Finalized and amendment rows are immutable.';
COMMENT ON TABLE public.physio_clinical_access_v1 IS 'Explicit per-user clinical capabilities; job title alone never grants access.';

COMMIT;
