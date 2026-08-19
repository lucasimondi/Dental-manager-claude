-- POL-UI-001 Phase 1: presentation-only Home layout, owned by one user in one studio.
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
  ) THEN
    RAISE EXCEPTION 'POL-UI-001 preflight: studio_users(user_id,studio_id,stato) required';
  END IF;
END
$preflight$;

CREATE TABLE public.user_home_layouts (
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id,user_id),
  CONSTRAINT user_home_layouts_layout_array CHECK (jsonb_typeof(layout)='array'),
  CONSTRAINT user_home_layouts_layout_limit CHECK (pg_column_size(layout)<=32768)
);

ALTER TABLE public.user_home_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_home_layouts_select_own
ON public.user_home_layouts FOR SELECT TO authenticated
USING (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid()) AND su.studio_id=user_home_layouts.studio_id AND su.stato='attivo')
);

CREATE POLICY user_home_layouts_insert_own
ON public.user_home_layouts FOR INSERT TO authenticated
WITH CHECK (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid()) AND su.studio_id=user_home_layouts.studio_id AND su.stato='attivo')
);

CREATE POLICY user_home_layouts_update_own
ON public.user_home_layouts FOR UPDATE TO authenticated
USING (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid()) AND su.studio_id=user_home_layouts.studio_id AND su.stato='attivo')
)
WITH CHECK (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid()) AND su.studio_id=user_home_layouts.studio_id AND su.stato='attivo')
);

CREATE POLICY user_home_layouts_delete_own
ON public.user_home_layouts FOR DELETE TO authenticated
USING (
  user_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.studio_users su
    WHERE su.user_id=(SELECT auth.uid()) AND su.studio_id=user_home_layouts.studio_id AND su.stato='attivo')
);

REVOKE ALL ON public.user_home_layouts FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_home_layouts TO authenticated;

COMMENT ON TABLE public.user_home_layouts IS 'Presentation-only POL-UI-001 Home layout per studio and authenticated user; no business values.';

COMMIT;
