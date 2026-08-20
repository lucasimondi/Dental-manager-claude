BEGIN;

DO $$
DECLARE
  required_table text;
BEGIN
  IF to_regclass('public.studio_users') IS NULL OR to_regclass('public.studios') IS NULL
     OR to_regclass('public.patients') IS NULL THEN
    RAISE EXCEPTION 'POL-RBAC-001 preflight: studios, studio_users and patients are required';
  END IF;
  FOREACH required_table IN ARRAY ARRAY[
    'physio_piani','physio_valutazioni','physio_obiettivi','physio_diario_sedute',
    'physio_esercizi','physio_prescrizioni','physio_esecuzioni'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'POL-RBAC-001 preflight: public.% is required', required_table;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_users' AND column_name='user_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_users' AND column_name='studio_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_users' AND column_name='ruolo')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_users' AND column_name='stato') THEN
    RAISE EXCEPTION 'POL-RBAC-001 preflight: studio_users(user_id, studio_id, ruolo, stato) is required';
  END IF;
END $$;

CREATE TABLE public.studio_user_capabilities (
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN (
    'home.front_desk',
    'clinical.general',
    'clinical.physiotherapist',
    'clinical.personal_trainer',
    'clinical.massage_therapist'
  )),
  granted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, user_id, capability)
);

CREATE INDEX studio_user_capabilities_user_studio_idx
  ON public.studio_user_capabilities (user_id, studio_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_studio_users_user_studio_idx ON public.studio_users(user_id,studio_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_piani_studio_patient_idx ON public.physio_piani(studio_id,paziente_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_valutazioni_studio_patient_idx ON public.physio_valutazioni(studio_id,paziente_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_obiettivi_studio_patient_idx ON public.physio_obiettivi(studio_id,paziente_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_diario_studio_patient_idx ON public.physio_diario_sedute(studio_id,paziente_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_esercizi_studio_idx ON public.physio_esercizi(studio_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_prescrizioni_studio_patient_idx ON public.physio_prescrizioni(studio_id,paziente_id);
CREATE INDEX IF NOT EXISTS pol_rbac_001_physio_esecuzioni_studio_idx ON public.physio_esecuzioni(studio_id);

ALTER TABLE public.studio_user_capabilities ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_studio_capability_v1(p_studio_id uuid, p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.studio_users su
    WHERE su.studio_id = p_studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
      AND (
        EXISTS (
          SELECT 1
          FROM public.studio_user_capabilities suc
          WHERE suc.studio_id = su.studio_id
            AND suc.user_id = su.user_id
            AND suc.capability = p_capability
        )
        OR (su.ruolo = 'admin' AND p_capability IN (
          'studio.owner', 'studio.manage_members', 'finance.management.read', 'home.owner'
        ))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_studio_capabilities_v1(p_studio_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(c.capability ORDER BY c.capability), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT effective.capability
    FROM public.studio_users su
    CROSS JOIN LATERAL (
      SELECT suc.capability
      FROM public.studio_user_capabilities suc
      WHERE suc.studio_id = su.studio_id AND suc.user_id = su.user_id
      UNION ALL
      SELECT admin_capability
      FROM unnest(ARRAY['studio.owner','studio.manage_members','finance.management.read','home.owner']::text[]) admin_capability
      WHERE su.ruolo = 'admin'
    ) effective
    WHERE su.studio_id = p_studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
  ) c
$$;

REVOKE ALL ON FUNCTION public.has_studio_capability_v1(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_studio_capabilities_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_studio_capability_v1(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_studio_capabilities_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_assign_studio_capability_v1(p_studio_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_studio_capability_v1(p_studio_id,'studio.manage_members') AND EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.studio_id=p_studio_id AND su.user_id=p_user_id AND su.stato='attivo'
  )
$$;
REVOKE ALL ON FUNCTION public.can_assign_studio_capability_v1(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_studio_capability_v1(uuid,uuid) TO authenticated;

CREATE POLICY studio_user_capabilities_select ON public.studio_user_capabilities
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()) AND (SELECT public.has_studio_capability_v1(studio_id,capability)))
  OR (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
);

CREATE POLICY studio_user_capabilities_insert ON public.studio_user_capabilities
FOR INSERT TO authenticated
WITH CHECK (
  granted_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
  AND (SELECT public.can_assign_studio_capability_v1(studio_id,user_id))
);

CREATE POLICY studio_user_capabilities_delete ON public.studio_user_capabilities
FOR DELETE TO authenticated
USING ((SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members')));

REVOKE ALL ON TABLE public.studio_user_capabilities FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.studio_user_capabilities TO authenticated;

CREATE OR REPLACE FUNCTION public.physio_patient_in_studio_v1(p_studio_id uuid, p_patient_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_users su
    JOIN public.patients p ON p.studio_id = su.studio_id AND p.id = p_patient_id
    WHERE su.studio_id = p_studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
      AND (
        public.has_studio_capability_v1(p_studio_id,'clinical.physiotherapist')
        OR public.has_studio_capability_v1(p_studio_id,'clinical.personal_trainer')
        OR public.has_studio_capability_v1(p_studio_id,'clinical.massage_therapist')
      )
  )
$$;

REVOKE ALL ON FUNCTION public.physio_patient_in_studio_v1(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.physio_patient_in_studio_v1(uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.physio_enforce_author_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.physio_enforce_author_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS physio_valutazioni_enforce_author_v1 ON public.physio_valutazioni;
CREATE TRIGGER physio_valutazioni_enforce_author_v1 BEFORE INSERT OR UPDATE ON public.physio_valutazioni
FOR EACH ROW EXECUTE FUNCTION public.physio_enforce_author_v1();
DROP TRIGGER IF EXISTS physio_diario_enforce_author_v1 ON public.physio_diario_sedute;
CREATE TRIGGER physio_diario_enforce_author_v1 BEFORE INSERT OR UPDATE ON public.physio_diario_sedute
FOR EACH ROW EXECUTE FUNCTION public.physio_enforce_author_v1();

DROP POLICY IF EXISTS physio_piani_studio ON public.physio_piani;
DROP POLICY IF EXISTS physio_valutazioni_studio ON public.physio_valutazioni;
DROP POLICY IF EXISTS physio_obiettivi_studio ON public.physio_obiettivi;
DROP POLICY IF EXISTS physio_diario_sedute_studio ON public.physio_diario_sedute;
DROP POLICY IF EXISTS physio_esercizi_studio ON public.physio_esercizi;
DROP POLICY IF EXISTS physio_prescrizioni_studio ON public.physio_prescrizioni;
DROP POLICY IF EXISTS physio_esecuzioni_studio ON public.physio_esecuzioni;

REVOKE ALL ON TABLE public.physio_piani, public.physio_valutazioni, public.physio_obiettivi,
  public.physio_diario_sedute, public.physio_esercizi, public.physio_prescrizioni,
  public.physio_esecuzioni FROM anon;
REVOKE DELETE ON TABLE public.physio_piani, public.physio_valutazioni, public.physio_obiettivi,
  public.physio_diario_sedute, public.physio_esercizi, public.physio_prescrizioni,
  public.physio_esecuzioni FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.physio_piani, public.physio_valutazioni,
  public.physio_obiettivi, public.physio_diario_sedute, public.physio_esercizi,
  public.physio_prescrizioni, public.physio_esecuzioni TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.physio_piani_id_seq, public.physio_valutazioni_id_seq,
  public.physio_obiettivi_id_seq, public.physio_diario_sedute_id_seq,
  public.physio_esercizi_id_seq, public.physio_prescrizioni_id_seq,
  public.physio_esecuzioni_id_seq TO authenticated;

CREATE POLICY physio_piani_read ON public.physio_piani FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
);
CREATE POLICY physio_piani_insert ON public.physio_piani FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);
CREATE POLICY physio_piani_update ON public.physio_piani FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);

CREATE POLICY physio_valutazioni_read ON public.physio_valutazioni FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
);
CREATE POLICY physio_valutazioni_insert ON public.physio_valutazioni FOR INSERT TO authenticated WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);
CREATE POLICY physio_valutazioni_update ON public.physio_valutazioni FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);

CREATE POLICY physio_obiettivi_read ON public.physio_obiettivi FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
);
CREATE POLICY physio_obiettivi_insert ON public.physio_obiettivi FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);
CREATE POLICY physio_obiettivi_update ON public.physio_obiettivi FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);

CREATE POLICY physio_diario_read ON public.physio_diario_sedute FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (
    created_by = (SELECT auth.uid()) AND (
      (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
      OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
    )
  )
);
CREATE POLICY physio_diario_insert ON public.physio_diario_sedute FOR INSERT TO authenticated WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (
    (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
    OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
    OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
  )
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);
CREATE POLICY physio_diario_update ON public.physio_diario_sedute FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (
    created_by = (SELECT auth.uid()) AND (
      (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
      OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
    )
  )
) WITH CHECK (
  (
    (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
    OR (
      created_by = (SELECT auth.uid()) AND (
        (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
        OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
      )
    )
  )
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
);

CREATE POLICY physio_esercizi_read ON public.physio_esercizi FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
);
CREATE POLICY physio_esercizi_insert ON public.physio_esercizi FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
);
CREATE POLICY physio_esercizi_update ON public.physio_esercizi FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK ((SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist')));

CREATE POLICY physio_prescrizioni_read ON public.physio_prescrizioni FOR SELECT TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
  OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
);
CREATE POLICY physio_prescrizioni_insert ON public.physio_prescrizioni FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
  AND EXISTS (SELECT 1 FROM public.physio_esercizi pe WHERE pe.id=esercizio_id AND pe.studio_id=physio_prescrizioni.studio_id)
);
CREATE POLICY physio_prescrizioni_update ON public.physio_prescrizioni FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND (SELECT public.physio_patient_in_studio_v1(studio_id,paziente_id))
  AND EXISTS (SELECT 1 FROM public.physio_esercizi pe WHERE pe.id=esercizio_id AND pe.studio_id=physio_prescrizioni.studio_id)
);

CREATE POLICY physio_esecuzioni_read ON public.physio_esecuzioni FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id=prescrizione_id AND pp.studio_id=physio_esecuzioni.studio_id
  )
  AND (
    (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
    OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.personal_trainer'))
    OR (SELECT public.has_studio_capability_v1(studio_id,'clinical.massage_therapist'))
  )
);
CREATE POLICY physio_esecuzioni_insert ON public.physio_esecuzioni FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id=prescrizione_id AND pp.studio_id=physio_esecuzioni.studio_id
  )
);
CREATE POLICY physio_esecuzioni_update ON public.physio_esecuzioni FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
) WITH CHECK (
  (SELECT public.has_studio_capability_v1(studio_id,'clinical.physiotherapist'))
  AND EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id=prescrizione_id AND pp.studio_id=physio_esecuzioni.studio_id
  )
);

COMMENT ON TABLE public.studio_user_capabilities IS
  'POL-RBAC-001 explicit tenant-scoped capabilities. No clinical capability is inferred from legacy roles.';
COMMENT ON FUNCTION public.get_my_studio_capabilities_v1(uuid) IS
  'Returns active caller capabilities; legacy admin maps only to owner/management capabilities, never clinical access.';

COMMIT;
