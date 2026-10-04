-- POL-UI-045: colonna mancante per Impostazioni → Documenti.
-- L'app scrive studio_info.documenti_settings (levette "Archiviazione
-- documenti") da tempo, ma la colonna non è mai stata creata in
-- produzione (verificato in sola lettura il 2026-10-04): l'upsert di
-- studio_info falliva con colonna sconosciuta e le preferenze non venivano
-- salvate. Una sola colonna nuova, nullable: NULL = valori predefiniti
-- dell'app (DEF_DOCUMENTI_SETTINGS). Nessuna nuova policy: la RLS
-- esistente di studio_info copre già la colonna.
--
-- Rollback:
--   ALTER TABLE public.studio_info DROP CONSTRAINT IF EXISTS studio_info_documenti_settings_check;
--   ALTER TABLE public.studio_info DROP COLUMN IF EXISTS documenti_settings;
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studio_info') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_info' AND column_name='studio_id'
  ) THEN
    RAISE EXCEPTION 'POL-UI-045 preflight: public.studio_info(studio_id) is required';
  END IF;
END
$preflight$;

ALTER TABLE public.studio_info
  ADD COLUMN IF NOT EXISTS documenti_settings jsonb;

ALTER TABLE public.studio_info
  DROP CONSTRAINT IF EXISTS studio_info_documenti_settings_check;
ALTER TABLE public.studio_info
  ADD CONSTRAINT studio_info_documenti_settings_check
  CHECK (documenti_settings IS NULL OR jsonb_typeof(documenti_settings) = 'object');

COMMENT ON COLUMN public.studio_info.documenti_settings IS
  'POL-UI-045 Impostazioni → Documenti: {tipo_documento: boolean} = archivia il PDF generato. NULL = predefiniti dell''app.';

COMMIT;
