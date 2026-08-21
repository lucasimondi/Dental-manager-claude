BEGIN;

DO $$
BEGIN
  IF to_regclass('public.studios') IS NULL OR to_regclass('public.studio_users') IS NULL
     OR to_regclass('public.studio_user_capabilities') IS NULL THEN
    RAISE EXCEPTION 'POL-RBAC-002 preflight: studios, studio_users and studio_user_capabilities are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_studio_capability_v1'
  ) THEN
    RAISE EXCEPTION 'POL-RBAC-002 preflight: public.has_studio_capability_v1 is required (POL-RBAC-001)';
  END IF;
END $$;

-- POL-RBAC-002: purely presentational per-studio override of how a
-- capability is labeled in the Team UI (see
-- docs/architecture/pol-ux-002-studio-capability-labels-design.md for the
-- approved design and its cross-reference against every binding
-- requirement). This table is NEVER read by has_studio_capability_v1,
-- get_my_studio_capabilities_v1, or any RLS policy outside its own -- it
-- has no authorization meaning whatsoever. studio_user_capabilities (the
-- actual grant of a capability to a user) is untouched by this migration:
-- no ALTER, no new columns, no policy changes.
CREATE TABLE public.studio_capability_labels (
  studio_id    uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  -- Intentionally the exact same literal vocabulary as
  -- studio_user_capabilities.capability's CHECK constraint (POL-RBAC-001).
  -- A second, independent CHECK against the same canonical list -- this
  -- table does not reference or modify that one. If POL-RBAC ever adds a
  -- capability, extend both CHECK constraints in the same migration that
  -- adds it, never here alone.
  capability   text NOT NULL CHECK (capability IN (
    'home.front_desk',
    'clinical.general',
    'clinical.physiotherapist',
    'clinical.personal_trainer',
    'clinical.massage_therapist'
  )),
  custom_label text NOT NULL CHECK (char_length(btrim(custom_label)) BETWEEN 1 AND 40),
  updated_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, capability)
);

CREATE INDEX studio_capability_labels_studio_idx
  ON public.studio_capability_labels (studio_id);

ALTER TABLE public.studio_capability_labels ENABLE ROW LEVEL SECURITY;

-- READ: any active member of the studio. This is display text, not a
-- permission -- every active member needs the studio's chosen wording to
-- render correctly, not just admins.
CREATE POLICY studio_capability_labels_select ON public.studio_capability_labels
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.studio_id = studio_capability_labels.studio_id
      AND su.user_id = (SELECT auth.uid())
      AND su.stato = 'attivo'
  )
);

-- WRITE (insert/update/delete): gated by the EXISTING studio.manage_members
-- capability via the EXISTING has_studio_capability_v1 function -- the same
-- authority that already grants/revokes clinical capabilities in
-- studio_user_capabilities_insert/delete. No new capability, no new
-- authorization function.
CREATE POLICY studio_capability_labels_insert ON public.studio_capability_labels
FOR INSERT TO authenticated
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
);

CREATE POLICY studio_capability_labels_update ON public.studio_capability_labels
FOR UPDATE TO authenticated
USING ((SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members')))
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND (SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members'))
);

CREATE POLICY studio_capability_labels_delete ON public.studio_capability_labels
FOR DELETE TO authenticated
USING ((SELECT public.has_studio_capability_v1(studio_id, 'studio.manage_members')));

REVOKE ALL ON TABLE public.studio_capability_labels FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_capability_labels TO authenticated;

COMMENT ON TABLE public.studio_capability_labels IS
  'POL-RBAC-002 presentation-only label override. Never referenced by any authorization check; RBAC authority remains studio_user_capabilities + has_studio_capability_v1 only. Deleting a row is the reset-to-default action -- there is no separate enabled flag.';

COMMIT;
