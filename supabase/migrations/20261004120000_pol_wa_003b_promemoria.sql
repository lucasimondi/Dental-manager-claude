-- POL-WA-003b: WhatsApp consent, automatic appointment reminders, replies.
-- Product Owner decisions: consent is recorded in the patient record
-- ("Anagrafica paziente"); reminders go out only to patients who gave it.
--
-- Additive and re-runnable (no DROP statements):
--   * patients.consenso_whatsapp / consenso_whatsapp_il
--   * whatsapp_config: per-studio reminder settings (off by default)
--   * whatsapp_promemoria: one row per appointment reminder (unique), with the
--     patient's reply (confermato / da_spostare / altro). Members read only.
--   * scheduler: pg_cron + pg_net call the whatsapp-webhook Edge Function every
--     hour (path /promemoria). The shared secret is generated INSIDE the database
--     and kept in Vault; it never appears in the repository or in any log.
--     The job itself is created by calling
--       SELECT public.whatsapp_programma_promemoria('<function url>/promemoria');
--     once per environment (production URL is not hard-coded here, so a local or
--     branch database never calls production).
--
-- Rollback:
--   SELECT cron.unschedule('whatsapp-promemoria');
--   DROP FUNCTION IF EXISTS public.whatsapp_programma_promemoria(text);
--   DROP FUNCTION IF EXISTS public.whatsapp_cron_segreto_valido(text);
--   DELETE FROM vault.secrets WHERE name = 'whatsapp_cron_secret';
--   DROP TABLE IF EXISTS public.whatsapp_promemoria;
--   ALTER TABLE public.whatsapp_config DROP COLUMN IF EXISTS promemoria_attivi,
--     DROP COLUMN IF EXISTS promemoria_ora, DROP COLUMN IF EXISTS promemoria_template,
--     DROP COLUMN IF EXISTS promemoria_lingua;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS consenso_whatsapp,
--     DROP COLUMN IF EXISTS consenso_whatsapp_il;
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.patients') IS NULL OR to_regclass('public.appointments') IS NULL
     OR to_regclass('public.whatsapp_config') IS NULL OR to_regclass('public.whatsapp_messages') IS NULL THEN
    RAISE EXCEPTION 'POL-WA-003b preflight: patients, appointments, whatsapp_config and whatsapp_messages are required';
  END IF;
END
$preflight$;

-- ── Consent in the patient record ───────────────────────────────────────
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS consenso_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consenso_whatsapp_il timestamptz;

-- ── Per-studio reminder settings (owner or super admin may change them;
--    the POL-WA-002 guard trigger only protects the number binding) ────────
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS promemoria_attivi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promemoria_ora smallint NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS promemoria_template text NOT NULL DEFAULT 'promemoria_appuntamento',
  ADD COLUMN IF NOT EXISTS promemoria_lingua text NOT NULL DEFAULT 'it';
DO $$ BEGIN
  ALTER TABLE public.whatsapp_config ADD CONSTRAINT whatsapp_config_promemoria_ora_check CHECK (promemoria_ora BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.whatsapp_config ADD CONSTRAINT whatsapp_config_promemoria_template_check CHECK (promemoria_template ~ '^[a-z0-9_]+$' AND length(promemoria_template) <= 512);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Reminder log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_promemoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  appuntamento_id bigint NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  paziente_id bigint REFERENCES public.patients(id) ON DELETE SET NULL,
  telefono text NOT NULL,
  stato text NOT NULL DEFAULT 'in_invio' CHECK (stato IN ('in_invio', 'inviato', 'errore')),
  wa_message_id text,
  errore text,
  risposta text CHECK (risposta IS NULL OR risposta IN ('confermato', 'da_spostare', 'altro')),
  creato_il timestamptz NOT NULL DEFAULT now(),
  inviato_il timestamptz,
  risposto_il timestamptz,
  CONSTRAINT whatsapp_promemoria_appuntamento_key UNIQUE (appuntamento_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_promemoria_wa ON public.whatsapp_promemoria (studio_id, wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_promemoria_tel ON public.whatsapp_promemoria (studio_id, telefono, inviato_il DESC);

ALTER TABLE public.whatsapp_promemoria ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_promemoria' AND policyname = 'whatsapp_promemoria_select') THEN
    CREATE POLICY whatsapp_promemoria_select ON public.whatsapp_promemoria
      FOR SELECT TO authenticated
      USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);
  END IF;
END $$;
REVOKE ALL ON public.whatsapp_promemoria FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_promemoria TO authenticated;

-- ── Scheduler secret check (service role only) ──────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_cron_segreto_valido(p_segreto text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_atteso text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL OR coalesce(p_segreto, '') = '' THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
    INTO v_atteso USING 'whatsapp_cron_secret';
  RETURN v_atteso IS NOT NULL AND v_atteso = p_segreto;
END;
$function$;
REVOKE ALL ON FUNCTION public.whatsapp_cron_segreto_valido(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_cron_segreto_valido(text) TO service_role;

-- ── Scheduler (only where the Supabase extensions exist) ────────────────
DO $sched$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
  -- Dynamic SQL: a database without Vault must not even plan these statements.
  IF to_regclass('vault.secrets') IS NOT NULL THEN
    EXECUTE $v$
      SELECT vault.create_secret(
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        'whatsapp_cron_secret',
        'POL-WA-003b: shared secret between pg_cron and the whatsapp-webhook /promemoria path')
      WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'whatsapp_cron_secret')
    $v$;
  END IF;
END
$sched$;

CREATE OR REPLACE FUNCTION public.whatsapp_programma_promemoria(p_url text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_url IS NULL OR p_url !~ '^https://[a-z0-9.-]+/functions/v1/whatsapp-webhook/promemoria$' THEN
    RAISE EXCEPTION 'POL-WA-003b: unexpected reminder URL';
  END IF;
  -- Every hour at minute 7; the Edge Function sends only for studios whose
  -- promemoria_ora is the current hour in Europe/Rome. Re-scheduling with the
  -- same name updates the existing job.
  RETURN cron.schedule(
    'whatsapp-promemoria',
    '7 * * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_cron_secret')), body := '{}'::jsonb)$job$,
      p_url
    )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.whatsapp_programma_promemoria(text) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
