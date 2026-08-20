BEGIN;

-- ============================================================================
-- POL-RBAC-001A — Patient / care assignment
--
-- POL-RBAC-001 introduced tenant-scoped CAPABILITY ("this user may act as a
-- personal trainer/massage therapist in this studio") but let any user with
-- clinical.personal_trainer or clinical.massage_therapist read every Fisio
-- patient in the tenant through physio_patient_in_studio_v1(), which checked
-- capability+tenant only. This migration adds a second, narrower concept —
-- ASSIGNMENT ("this user may work with THIS patient") — and makes
-- physio_patient_in_studio_v1() require an active assignment for PT/massage
-- therapist before it grants patient-scoped access. Physiotherapist access
-- stays unrestricted within the tenant, unchanged from the approved
-- POL-RBAC-001/POL-FIS-001 contract.
--
-- POL-FIS-001 (physiotherapy clinical core, PR #14) is not merged and its
-- physio_episodes_v1 contract is not stable relative to this branch (it is
-- based on an older point in history and removes files this branch depends
-- on). This migration does not depend on it. The nullable episode_id column
-- below points at physio_piani — the only stable, already-merged concept
-- that plays the "episode/care-path" role today — as a TRANSITIONAL
-- COMPATIBILITY LAYER, approved by Product Owner explicitly as an interim
-- adapter only: this is not a second episode model and no episode data is
-- backfilled or invented anywhere in this migration. When POL-FIS-001's
-- canonical episode contract stabilizes and merges, a follow-up migration
-- must converge this column onto it (repoint/rename); see
-- docs/architecture/pol-rbac-001a-patient-care-assignment.md.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.studio_user_capabilities') IS NULL
     OR to_regclass('public.patient_care_assignments') IS NOT NULL
     OR to_regprocedure('public.has_studio_capability_v1(uuid,text)') IS NULL
     OR to_regprocedure('public.physio_patient_in_studio_v1(uuid,bigint)') IS NULL THEN
    RAISE EXCEPTION 'POL-RBAC-001A preflight: requires POL-RBAC-001 (studio_user_capabilities, has_studio_capability_v1, physio_patient_in_studio_v1) and must not already be applied';
  END IF;
  IF to_regclass('public.physio_piani') IS NULL OR to_regclass('public.physio_prescrizioni') IS NULL
     OR to_regclass('public.physio_esecuzioni') IS NULL THEN
    RAISE EXCEPTION 'POL-RBAC-001A preflight: physio_piani, physio_prescrizioni and physio_esecuzioni are required';
  END IF;
END $$;

-- The physiotherapist branch of can_manage_patient_assignment_v1 needs to
-- browse teammates' clinical capabilities to compose a patient's care team
-- (POL-RBAC-001A "Assegna professionista"), which POL-RBAC-001's original
-- studio_user_capabilities_select policy did not allow for a non-admin
-- physiotherapist (own row only). Extend it only for clinical.* rows — a
-- physiotherapist needs to see who else is clinical.personal_trainer/
-- massage_therapist/physiotherapist, not the studio's finance.management.read/
-- studio.owner/studio.manage_members/home.front_desk assignments, which stay
-- restricted to studio.manage_members (admin) as before.
DROP POLICY IF EXISTS studio_user_capabilities_select ON public.studio_user_capabilities;
CREATE POLICY studio_user_capabilities_select ON public.studio_user_capabilities
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()) AND (SELECT public.has_studio_capability_v1(studio_id,capability)))
  OR (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
  OR (
    capability LIKE 'clinical.%'
    AND (SELECT public.has_studio_capability_v1(studio_id, 'clinical.physiotherapist'))
  )
);

-- ── Assignment table ────────────────────────────────────────────────────
CREATE TABLE public.patient_care_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  patient_id bigint NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  episode_id bigint REFERENCES public.physio_piani(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN (
    'responsible_physiotherapist',
    'physiotherapist',
    'personal_trainer',
    'massage_therapist'
  )),
  active boolean NOT NULL DEFAULT true,
  reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by uuid REFERENCES auth.users(id),
  CHECK (active OR ended_at IS NOT NULL)
);

CREATE INDEX patient_care_assignments_lookup_idx
  ON public.patient_care_assignments (studio_id, patient_id, active);
CREATE INDEX patient_care_assignments_user_idx
  ON public.patient_care_assignments (studio_id, user_id, active);
CREATE UNIQUE INDEX patient_care_assignments_active_unique_idx
  ON public.patient_care_assignments (studio_id, patient_id, COALESCE(episode_id, -1), user_id, assignment_type)
  WHERE active;
CREATE UNIQUE INDEX patient_care_assignments_responsible_unique_idx
  ON public.patient_care_assignments (studio_id, patient_id)
  WHERE active AND assignment_type = 'responsible_physiotherapist';

ALTER TABLE public.patient_care_assignments ENABLE ROW LEVEL SECURITY;

-- ── Authorization helpers ───────────────────────────────────────────────

-- Only an active admin (studio.manage_members) or an active physiotherapist
-- may compose/terminate a patient's care team. This mirrors
-- can_assign_studio_capability_v1's admin-only pattern from POL-RBAC-001,
-- extended to let the responsible clinician manage their own patient's team
-- without requiring an admin for every roster change.
CREATE OR REPLACE FUNCTION public.can_manage_patient_assignment_v1(p_studio_id uuid, p_patient_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.studio_users su
    JOIN public.patients p ON p.studio_id = su.studio_id AND p.id = p_patient_id
    WHERE su.studio_id = p_studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
      AND (
        public.has_studio_capability_v1(p_studio_id, 'studio.manage_members')
        OR public.has_studio_capability_v1(p_studio_id, 'clinical.physiotherapist')
      )
  )
$$;
REVOKE ALL ON FUNCTION public.can_manage_patient_assignment_v1(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_patient_assignment_v1(uuid,bigint) TO authenticated;

-- A target user is only a valid assignment target when they hold an
-- explicit, active-membership-backed capability matching the responsibility
-- being assigned. Prevents assigning a front-desk user as "personal_trainer"
-- or a user from a different tenant.
CREATE OR REPLACE FUNCTION public.patient_assignment_target_eligible_v1(p_studio_id uuid, p_user_id uuid, p_assignment_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.studio_id = p_studio_id AND su.user_id = p_user_id AND su.stato = 'attivo'
  )
  AND EXISTS (
    SELECT 1 FROM public.studio_user_capabilities suc
    WHERE suc.studio_id = p_studio_id
      AND suc.user_id = p_user_id
      AND suc.capability = CASE p_assignment_type
        WHEN 'responsible_physiotherapist' THEN 'clinical.physiotherapist'
        WHEN 'physiotherapist' THEN 'clinical.physiotherapist'
        WHEN 'personal_trainer' THEN 'clinical.personal_trainer'
        WHEN 'massage_therapist' THEN 'clinical.massage_therapist'
      END
  )
$$;
REVOKE ALL ON FUNCTION public.patient_assignment_target_eligible_v1(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_assignment_target_eligible_v1(uuid,uuid,text) TO authenticated;

-- Used by patient_care_team_roster_v1 below (and, historically, by a wider
-- SELECT policy branch removed per Product Owner decision — see that
-- function for the current data-minimized roster contract). A
-- self-referencing EXISTS subquery directly in a policy on this table
-- causes Postgres to detect infinite recursion; a SECURITY DEFINER function
-- runs as owner (RLS-exempt) and avoids it, the same pattern used by every
-- other POL-RBAC-001/POL-RBAC-001A helper. Also re-checks the caller's own
-- active membership: an assignment row staying active=true does not by
-- itself prove the caller isn't suspended — membership must fail closed
-- independently of assignment state, exactly as physio_patient_in_studio_v1
-- already does.
CREATE OR REPLACE FUNCTION public.caller_has_active_patient_assignment_v1(p_studio_id uuid, p_patient_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_care_assignments pca
    JOIN public.studio_users su ON su.studio_id = pca.studio_id AND su.user_id = pca.user_id
    WHERE pca.studio_id = p_studio_id AND pca.patient_id = p_patient_id
      AND pca.user_id = (SELECT auth.uid()) AND pca.active
      AND su.stato = 'attivo'
  )
$$;
REVOKE ALL ON FUNCTION public.caller_has_active_patient_assignment_v1(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.caller_has_active_patient_assignment_v1(uuid,bigint) TO authenticated;

-- Data-minimized team roster, per Product Owner decision: a PT/massage
-- therapist teammate may see WHO is on the active team for the one patient
-- they are themselves actively assigned to — identity (user_id, resolved to
-- a name client-side), role in the pathway (assignment_type) and status
-- (active) — and nothing else. They must not be able to derive global
-- capabilities, other assignments, other patients or additional clinical
-- content through this path. An admin/physiotherapist gets the same
-- projection here too (this function is the shared roster read path for
-- everyone), but retains full-row access to the base table separately
-- (patient_care_assignments_select above) for the "vista completa del
-- team previsto dal contratto". Listed rows also require the team member's
-- OWN membership to currently be active — an assignment left active=true
-- while its holder's studio membership is suspended should not appear as
-- part of the "active team" either; membership fails closed on both sides
-- of this read, caller and listed member alike.
CREATE OR REPLACE FUNCTION public.patient_care_team_roster_v1(p_studio_id uuid, p_patient_id bigint)
RETURNS TABLE(id bigint, user_id uuid, assignment_type text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pca.id, pca.user_id, pca.assignment_type, pca.active
  FROM public.patient_care_assignments pca
  JOIN public.studio_users su ON su.studio_id = pca.studio_id AND su.user_id = pca.user_id
  WHERE pca.studio_id = p_studio_id
    AND pca.patient_id = p_patient_id
    AND pca.active
    AND su.stato = 'attivo'
    AND (
      public.has_studio_capability_v1(p_studio_id, 'studio.manage_members')
      OR public.has_studio_capability_v1(p_studio_id, 'clinical.physiotherapist')
      OR public.caller_has_active_patient_assignment_v1(p_studio_id, p_patient_id)
    )
$$;
REVOKE ALL ON FUNCTION public.patient_care_team_roster_v1(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_care_team_roster_v1(uuid,bigint) TO authenticated;

-- ── Server-enforced authorship, tenant-safety and immutability ─────────
CREATE OR REPLACE FUNCTION public.patient_care_assignments_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.studio_id = NEW.studio_id) THEN
      RAISE EXCEPTION 'POL-RBAC-001A: patient must belong to the assignment studio' USING ERRCODE = '23503';
    END IF;
    IF NEW.episode_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.physio_piani pp
      WHERE pp.id = NEW.episode_id AND pp.studio_id = NEW.studio_id AND pp.paziente_id = NEW.patient_id
    ) THEN
      RAISE EXCEPTION 'POL-RBAC-001A: episode must belong to the same studio and patient' USING ERRCODE = '23503';
    END IF;
    IF NOT public.patient_assignment_target_eligible_v1(NEW.studio_id, NEW.user_id, NEW.assignment_type) THEN
      RAISE EXCEPTION 'POL-RBAC-001A: assigned professional lacks the matching capability or active membership' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.active := true;
    NEW.ended_at := NULL;
    NEW.ended_by := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.studio_id IS DISTINCT FROM OLD.studio_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.episode_id IS DISTINCT FROM OLD.episode_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.assignment_type IS DISTINCT FROM OLD.assignment_type
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'POL-RBAC-001A: assignment identity fields are immutable; end this assignment and create a new one instead' USING ERRCODE = '42501';
    END IF;
    IF NOT OLD.active THEN
      RAISE EXCEPTION 'POL-RBAC-001A: an ended assignment cannot be reactivated or edited' USING ERRCODE = '42501';
    END IF;
    IF NOT NEW.active THEN
      NEW.ended_at := now();
      NEW.ended_by := (SELECT auth.uid());
    ELSE
      NEW.ended_at := NULL;
      NEW.ended_by := NULL;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.patient_care_assignments_guard_v1() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER patient_care_assignments_guard_v1
BEFORE INSERT OR UPDATE ON public.patient_care_assignments
FOR EACH ROW EXECUTE FUNCTION public.patient_care_assignments_guard_v1();

-- ── RLS: assignment table ───────────────────────────────────────────────
-- Read (base table, full row): admins and physiotherapists see the complete
-- team per the approved contract (audit fields included — team composition
-- is part of the clinical/managerial record they're responsible for); any
-- user sees their own row. Per Product Owner decision, a PT/massage
-- therapist teammate does NOT get raw table access to other professionals'
-- rows (that would expose created_by/created_at/ended_at/ended_by/reason —
-- more than "identity, role, status"): their roster view is
-- patient_care_team_roster_v1() below, a data-minimized, SECURITY DEFINER
-- projection, not a table grant.
CREATE POLICY patient_care_assignments_select ON public.patient_care_assignments
FOR SELECT TO authenticated
USING (
  (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
  OR (SELECT public.has_studio_capability_v1(studio_id, 'clinical.physiotherapist'))
  OR user_id = (SELECT auth.uid())
);

CREATE POLICY patient_care_assignments_insert ON public.patient_care_assignments
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.can_manage_patient_assignment_v1(studio_id, patient_id))
);

CREATE POLICY patient_care_assignments_update ON public.patient_care_assignments
FOR UPDATE TO authenticated
USING ((SELECT public.can_manage_patient_assignment_v1(studio_id, patient_id)))
WITH CHECK ((SELECT public.can_manage_patient_assignment_v1(studio_id, patient_id)));

REVOKE ALL ON TABLE public.patient_care_assignments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patient_care_assignments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.patient_care_assignments_id_seq TO authenticated;

-- ── Fisio access: capability ALONE is no longer sufficient for PT/massage ─
-- Redefining physio_patient_in_studio_v1 in place tightens every existing
-- caller (physio_piani/valutazioni/obiettivi/diario/prescrizioni write
-- checks) without touching their policy definitions. Physiotherapist access
-- is intentionally left tenant-wide, matching the approved contract; only
-- the personal_trainer/massage_therapist branches now require an active
-- patient_care_assignments row.
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
        public.has_studio_capability_v1(p_studio_id, 'clinical.physiotherapist')
        OR (
          public.has_studio_capability_v1(p_studio_id, 'clinical.personal_trainer')
          AND EXISTS (
            SELECT 1 FROM public.patient_care_assignments pca
            WHERE pca.studio_id = p_studio_id AND pca.patient_id = p_patient_id
              AND pca.user_id = (SELECT auth.uid()) AND pca.assignment_type = 'personal_trainer' AND pca.active
          )
        )
        OR (
          public.has_studio_capability_v1(p_studio_id, 'clinical.massage_therapist')
          AND EXISTS (
            SELECT 1 FROM public.patient_care_assignments pca
            WHERE pca.studio_id = p_studio_id AND pca.patient_id = p_patient_id
              AND pca.user_id = (SELECT auth.uid()) AND pca.assignment_type = 'massage_therapist' AND pca.active
          )
        )
      )
  )
$$;

-- physio_piani/physio_obiettivi/physio_prescrizioni READ previously granted
-- tenant-wide access on capability alone. Re-scope to the same patient-level
-- check already used for writes.
DROP POLICY IF EXISTS physio_piani_read ON public.physio_piani;
CREATE POLICY physio_piani_read ON public.physio_piani FOR SELECT TO authenticated USING (
  (SELECT public.physio_patient_in_studio_v1(studio_id, paziente_id))
);

DROP POLICY IF EXISTS physio_obiettivi_read ON public.physio_obiettivi;
CREATE POLICY physio_obiettivi_read ON public.physio_obiettivi FOR SELECT TO authenticated USING (
  (SELECT public.physio_patient_in_studio_v1(studio_id, paziente_id))
);

DROP POLICY IF EXISTS physio_prescrizioni_read ON public.physio_prescrizioni;
CREATE POLICY physio_prescrizioni_read ON public.physio_prescrizioni FOR SELECT TO authenticated USING (
  (SELECT public.physio_patient_in_studio_v1(studio_id, paziente_id))
);

-- physio_esecuzioni had no created_by column, so PT/massage therapists could
-- not record or read their own execution log at all. Add authorship, then
-- allow physiotherapist unrestricted access and PT/massage own-authored,
-- assignment-gated access, mirroring the physio_diario_sedute pattern.
ALTER TABLE public.physio_esecuzioni ADD COLUMN created_by uuid REFERENCES auth.users(id);

DROP TRIGGER IF EXISTS physio_esecuzioni_enforce_author_v1 ON public.physio_esecuzioni;
CREATE TRIGGER physio_esecuzioni_enforce_author_v1 BEFORE INSERT OR UPDATE ON public.physio_esecuzioni
FOR EACH ROW EXECUTE FUNCTION public.physio_enforce_author_v1();

DROP POLICY IF EXISTS physio_esecuzioni_read ON public.physio_esecuzioni;
DROP POLICY IF EXISTS physio_esecuzioni_insert ON public.physio_esecuzioni;
DROP POLICY IF EXISTS physio_esecuzioni_update ON public.physio_esecuzioni;

CREATE POLICY physio_esecuzioni_read ON public.physio_esecuzioni FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id = prescrizione_id AND pp.studio_id = physio_esecuzioni.studio_id
  )
  AND (
    (SELECT public.has_studio_capability_v1(studio_id, 'clinical.physiotherapist'))
    OR (
      created_by = (SELECT auth.uid())
      AND (
        (SELECT public.has_studio_capability_v1(studio_id, 'clinical.personal_trainer'))
        OR (SELECT public.has_studio_capability_v1(studio_id, 'clinical.massage_therapist'))
      )
    )
  )
);
CREATE POLICY physio_esecuzioni_insert ON public.physio_esecuzioni FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id = prescrizione_id AND pp.studio_id = physio_esecuzioni.studio_id
      AND (
        (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.physiotherapist'))
        OR (
          (
            (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.personal_trainer'))
            OR (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.massage_therapist'))
          )
          AND (SELECT public.physio_patient_in_studio_v1(physio_esecuzioni.studio_id, pp.paziente_id))
        )
      )
  )
);
CREATE POLICY physio_esecuzioni_update ON public.physio_esecuzioni FOR UPDATE TO authenticated USING (
  (SELECT public.has_studio_capability_v1(studio_id, 'clinical.physiotherapist'))
  OR (
    created_by = (SELECT auth.uid())
    AND (
      (SELECT public.has_studio_capability_v1(studio_id, 'clinical.personal_trainer'))
      OR (SELECT public.has_studio_capability_v1(studio_id, 'clinical.massage_therapist'))
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.physio_prescrizioni pp
    WHERE pp.id = prescrizione_id AND pp.studio_id = physio_esecuzioni.studio_id
      AND (
        (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.physiotherapist'))
        OR (
          created_by = (SELECT auth.uid())
          AND (
            (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.personal_trainer'))
            OR (SELECT public.has_studio_capability_v1(physio_esecuzioni.studio_id, 'clinical.massage_therapist'))
          )
          AND (SELECT public.physio_patient_in_studio_v1(physio_esecuzioni.studio_id, pp.paziente_id))
        )
      )
  )
);

COMMENT ON TABLE public.patient_care_assignments IS
  'POL-RBAC-001A explicit patient/episode assignment. Separate from studio_user_capabilities: capability says what a user may do, assignment says which patient they may do it with. episode_id is a TRANSITIONAL COMPATIBILITY LAYER onto physio_piani, approved by Product Owner as an interim adapter only -- not a second episode model. When POL-FIS-001''s canonical clinical episode stabilizes and merges, this column must converge onto it (repoint/rename via a follow-up migration); no data is backfilled or invented in the meantime.';
COMMENT ON COLUMN public.patient_care_assignments.episode_id IS
  'Transitional compatibility layer onto physio_piani pending POL-FIS-001 canonical episode convergence. Not read by any RLS policy (gating is patient-level only). Do not build new features assuming this is the final episode model.';
COMMENT ON FUNCTION public.physio_patient_in_studio_v1(uuid,bigint) IS
  'POL-RBAC-001A: physiotherapist access remains tenant-wide by capability; personal_trainer/massage_therapist access additionally requires an active patient_care_assignments row for that patient.';
COMMENT ON FUNCTION public.patient_care_team_roster_v1(uuid,bigint) IS
  'POL-RBAC-001A data-minimized roster read path for PT/massage_therapist teammates (Product Owner decision): identity/role/status only for the active team of one patient they are themselves assigned to, never global capabilities, other assignments, other patients or clinical content. Admin/physiotherapist keep separate full-row access via patient_care_assignments_select for the complete contractual view.';

COMMIT;
