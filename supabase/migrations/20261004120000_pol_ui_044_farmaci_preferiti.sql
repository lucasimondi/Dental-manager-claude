-- POL-UI-044: scorciatoie farmaci della Ricetta, per studio.
-- Una sola colonna nuova su public.studio_info. Nessuna nuova policy: la
-- RLS esistente di studio_info (riga dello studio del claim) copre già la
-- colonna. NULL = lo studio non ha ancora personalizzato la lista (l'app
-- mostra la lista iniziale); '[]' = lista svuotata di proposito.
--
-- Rollback:
--   ALTER TABLE public.studio_info DROP CONSTRAINT IF EXISTS studio_info_farmaci_preferiti_check;
--   ALTER TABLE public.studio_info DROP COLUMN IF EXISTS farmaci_preferiti;
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studio_info') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studio_info' AND column_name='studio_id'
  ) THEN
    RAISE EXCEPTION 'POL-UI-044 preflight: public.studio_info(studio_id) is required';
  END IF;
END
$preflight$;

ALTER TABLE public.studio_info
  ADD COLUMN IF NOT EXISTS farmaci_preferiti jsonb;

ALTER TABLE public.studio_info
  DROP CONSTRAINT IF EXISTS studio_info_farmaci_preferiti_check;
ALTER TABLE public.studio_info
  ADD CONSTRAINT studio_info_farmaci_preferiti_check
  CHECK (
    farmaci_preferiti IS NULL
    OR (jsonb_typeof(farmaci_preferiti) = 'array' AND jsonb_array_length(farmaci_preferiti) <= 60)
  );

COMMENT ON COLUMN public.studio_info.farmaci_preferiti IS
  'POL-UI-044 scorciatoie farmaci della Ricetta: array di {id, farmaco, dosaggio, posologia, durata, note}. NULL = lista iniziale dell''app.';

COMMIT;
