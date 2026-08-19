-- POL-UI-001: tenant default Home presentation, editable only by active studio admins.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_users' AND column_name='user_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_users' AND column_name='studio_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_users' AND column_name='stato'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_users' AND column_name='ruolo'
  ) THEN
    RAISE EXCEPTION 'POL-UI-001 preflight: studio_users(user_id,studio_id,stato,ruolo) required';
  END IF;
END
$preflight$;

CREATE TABLE public.studio_home_layouts (
  studio_id uuid PRIMARY KEY,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_home_layouts_layout_array CHECK (jsonb_typeof(layout)='array'),
  CONSTRAINT studio_home_layouts_layout_limit CHECK (pg_column_size(layout)<=32768)
);

ALTER TABLE public.studio_home_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY studio_home_layouts_select_active_member
ON public.studio_home_layouts FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid())
      AND su.studio_id=studio_home_layouts.studio_id
      AND su.stato='attivo')
);

CREATE POLICY studio_home_layouts_insert_active_admin
ON public.studio_home_layouts FOR INSERT TO authenticated
WITH CHECK (
  updated_by=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid())
      AND su.studio_id=studio_home_layouts.studio_id
      AND su.stato='attivo'
      AND su.ruolo='admin')
);

CREATE POLICY studio_home_layouts_update_active_admin
ON public.studio_home_layouts FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid())
      AND su.studio_id=studio_home_layouts.studio_id
      AND su.stato='attivo'
      AND su.ruolo='admin')
)
WITH CHECK (
  updated_by=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid())
      AND su.studio_id=studio_home_layouts.studio_id
      AND su.stato='attivo'
      AND su.ruolo='admin')
);

CREATE POLICY studio_home_layouts_delete_active_admin
ON public.studio_home_layouts FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid())
      AND su.studio_id=studio_home_layouts.studio_id
      AND su.stato='attivo'
      AND su.ruolo='admin')
);

REVOKE ALL ON public.studio_home_layouts FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.studio_home_layouts TO authenticated;

COMMENT ON TABLE public.studio_home_layouts IS 'Presentation-only POL-UI-001 default Home layout per studio; active admins write, active members inherit.';

COMMIT;
