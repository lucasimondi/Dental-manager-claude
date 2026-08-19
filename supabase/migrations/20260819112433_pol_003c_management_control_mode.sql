-- POL-003C: per-studio presentation mode. No financial data or formula changes.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studio_info') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_info' AND column_name='studio_id'
  ) THEN
    RAISE EXCEPTION 'POL-003C preflight: public.studio_info(studio_id) is required';
  END IF;
END
$preflight$;

ALTER TABLE public.studio_info
  ADD COLUMN IF NOT EXISTS management_control_mode text NOT NULL DEFAULT 'base';

ALTER TABLE public.studio_info
  DROP CONSTRAINT IF EXISTS studio_info_management_control_mode_check;
ALTER TABLE public.studio_info
  ADD CONSTRAINT studio_info_management_control_mode_check
  CHECK (management_control_mode IN ('base','advanced'));

COMMENT ON COLUMN public.studio_info.management_control_mode IS
  'POL-003C presentation-only management control mode. Never changes canonical financial formulas or records.';

COMMIT;
