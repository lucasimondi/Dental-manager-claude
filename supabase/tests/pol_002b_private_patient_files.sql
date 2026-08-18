-- POL-002B storage security regression assertions.
-- Run only in an isolated Supabase test environment with synthetic fixtures.
-- The harness must provide two active users/studios and synthetic patients.
BEGIN;

DO $assertions$
DECLARE
  v_bucket_public boolean;
  v_policy_count integer;
  v_helper_exec_auth boolean;
BEGIN
  SELECT public INTO v_bucket_public FROM storage.buckets WHERE id='patient-files';
  IF v_bucket_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'POL-002B: patient-files must be private';
  END IF;

  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'patient_files_studio_select','patient_files_studio_insert',
      'patient_files_studio_update','patient_files_studio_delete'
    );
  IF v_policy_count <> 4 THEN
    RAISE EXCEPTION 'POL-002B: expected four patient-files tenant policies, got %', v_policy_count;
  END IF;

  SELECT has_function_privilege('authenticated','public.pol_002b_can_access_patient_file(text)','EXECUTE')
  INTO v_helper_exec_auth;
  IF v_helper_exec_auth THEN
    RAISE EXCEPTION 'POL-002B: helper must not be directly executable by authenticated';
  END IF;
END
$assertions$;

-- Behavioral matrix required from the local harness:
-- 1. Studio A active member can list/read/upload/delete Studio A patient files.
-- 2. Studio A second active member can access files uploaded by Studio A first member.
-- 3. Studio B member cannot list/read/upload/update/delete Studio A patient paths.
-- 4. Missing membership, inactive membership, missing/invalid studio JWT => denied.
-- 5. Unknown patient_id first path segment => denied.
-- 6. anon => denied.
-- 7. signed URL generation succeeds only after authenticated SELECT authorization.
-- 8. legacy <patient_id>/<filename> path remains compatible.

ROLLBACK;
