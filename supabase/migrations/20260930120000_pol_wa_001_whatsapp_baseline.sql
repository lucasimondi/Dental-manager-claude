-- POL-WA-001: repository baseline for the WhatsApp automation tables.
--
-- whatsapp_config and whatsapp_messages already exist in production (created
-- outside the repository, alongside the `whatsapp-webhook` Edge Function),
-- but no migration ever recorded them. This file reproduces the production
-- definition exactly as extracted read-only from information_schema,
-- pg_constraint, pg_indexes and pg_policies on 2026-09-30, so a fresh
-- environment gets the same schema and RLS.
--
-- Idempotent and behavior-neutral: every statement is IF NOT EXISTS or
-- replaces a policy with the identical definition. Applied to production it
-- is a no-op. No data is changed. No column, constraint, policy or grant
-- differs from production.
--
-- Rollback (fresh/non-production environments only):
--   DROP TABLE IF EXISTS public.whatsapp_messages;
--   DROP TABLE IF EXISTS public.whatsapp_config;
-- Never drop these tables in production: they are the live store used by the
-- deployed Edge Function and by Impostazioni -> WhatsApp Business.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studios') IS NULL OR to_regclass('public.patients') IS NULL THEN
    RAISE EXCEPTION 'POL-WA-001 preflight: studios and patients are required';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  phone_number_id text NOT NULL,
  waba_id text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_config_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_config_phone_number_id_key UNIQUE (phone_number_id),
  CONSTRAINT whatsapp_config_studio_id_fkey FOREIGN KEY (studio_id)
    REFERENCES public.studios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  paziente_id integer,
  telefono text NOT NULL,
  direzione text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  contenuto text,
  wa_message_id text,
  stato text,
  creato_il timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_messages_direzione_check CHECK (direzione = ANY (ARRAY['in'::text, 'out'::text])),
  CONSTRAINT whatsapp_messages_studio_id_fkey FOREIGN KEY (studio_id)
    REFERENCES public.studios(id) ON DELETE CASCADE,
  CONSTRAINT whatsapp_messages_paziente_id_fkey FOREIGN KEY (paziente_id)
    REFERENCES public.patients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_telefono
  ON public.whatsapp_messages USING btree (studio_id, telefono, creato_il DESC);

-- Same studio-scoped JWT-claim policy shape already used by the other
-- studio tables (see 20260818000000_physio_schema_dati.sql). The Edge
-- Function uses the service role and bypasses RLS, filtering by studio_id
-- explicitly in every query.
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_config_studio ON public.whatsapp_config;
CREATE POLICY whatsapp_config_studio ON public.whatsapp_config
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

DROP POLICY IF EXISTS whatsapp_messages_studio ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_studio ON public.whatsapp_messages
  FOR ALL
  USING (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid)
  WITH CHECK (studio_id = ((auth.jwt() -> 'app_metadata' ->> 'studio_id'))::uuid);

COMMIT;
