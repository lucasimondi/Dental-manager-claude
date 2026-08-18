-- POL-002B storage security regression assertions.
-- Run only in an isolated Supabase test environment with synthetic fixtures.
-- The harness must provide two active users/studios and synthetic patients.
BEGIN;

DO $assertions$
DECLARE
  v_bucket_public boolean;
  v_policy_count integer;
  v_helper_exec_auth boolean;
  v_helper_exec_anon boolean;
  v_private_usage_auth boolean;
  v_private_usage_anon boolean;
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

  IF to_regprocedure('public.pol_002b_can_access_patient_file(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'POL-002B: helper must not exist in the exposed public schema';
  END IF;

  SELECT has_function_privilege('authenticated','private.pol_002b_can_access_patient_file(text)','EXECUTE')
  INTO v_helper_exec_auth;
  IF NOT v_helper_exec_auth THEN
    RAISE EXCEPTION 'POL-002B: authenticated policy evaluation requires helper EXECUTE';
  END IF;

  SELECT has_function_privilege('anon','private.pol_002b_can_access_patient_file(text)','EXECUTE')
  INTO v_helper_exec_anon;
  IF v_helper_exec_anon THEN
    RAISE EXCEPTION 'POL-002B: anon must not execute the private helper';
  END IF;

  SELECT has_schema_privilege('authenticated','private','USAGE'),
         has_schema_privilege('anon','private','USAGE')
    INTO v_private_usage_auth, v_private_usage_anon;
  IF NOT v_private_usage_auth OR v_private_usage_anon THEN
    RAISE EXCEPTION 'POL-002B: unexpected private schema privileges';
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
