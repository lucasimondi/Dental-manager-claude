-- POL-002B — private patient-files
-- Production application is a separate Product Owner gate.
-- Preserves the current legacy object path: <patient_id>/<filename>.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'patient-files') THEN
    RAISE EXCEPTION 'POL-002B preflight: patient-files bucket missing';
  END IF;
  IF to_regclass('public.patients') IS NULL OR to_regclass('public.studio_users') IS NULL THEN
    RAISE EXCEPTION 'POL-002B preflight: patients/studio_users missing';
  END IF;
END
$preflight$;

-- Helper is deliberately non-client-executable. Storage policies call it internally.
CREATE OR REPLACE FUNCTION public.pol_002b_can_access_patient_file(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND NULLIF(auth.jwt() -> 'app_metadata' ->> 'studio_id', '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.studio_users su
        ON su.studio_id = p.studio_id
       AND su.user_id = auth.uid()
       AND su.stato = 'attivo'
      WHERE p.id::text = (storage.foldername(p_object_name))[1]
        AND p.studio_id::text = auth.jwt() -> 'app_metadata' ->> 'studio_id'
    );
$function$;

REVOKE ALL ON FUNCTION public.pol_002b_can_access_patient_file(text) FROM PUBLIC, anon, authenticated;

-- Remove only policies that previously governed this bucket by owner.
-- Existing owner_access policies are global and are intentionally left in place for other buckets;
-- the tenant policies below are additive for patient-files and fail closed on tenant mismatch.
DROP POLICY IF EXISTS patient_files_studio_select ON storage.objects;
DROP POLICY IF EXISTS patient_files_studio_insert ON storage.objects;
DROP POLICY IF EXISTS patient_files_studio_update ON storage.objects;
DROP POLICY IF EXISTS patient_files_studio_delete ON storage.objects;

CREATE POLICY patient_files_studio_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-files'
  AND public.pol_002b_can_access_patient_file(name)
);

CREATE POLICY patient_files_studio_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND public.pol_002b_can_access_patient_file(name)
);

CREATE POLICY patient_files_studio_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-files'
  AND public.pol_002b_can_access_patient_file(name)
)
WITH CHECK (
  bucket_id = 'patient-files'
  AND public.pol_002b_can_access_patient_file(name)
);

CREATE POLICY patient_files_studio_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-files'
  AND public.pol_002b_can_access_patient_file(name)
);

-- Privacy cutover. This must be deployed only together with the application change
-- from getPublicUrl() to short-lived createSignedUrl().
UPDATE storage.buckets
SET public = false
WHERE id = 'patient-files';

COMMIT;
