-- DOCUMENTI-TAG (PO 2026-11-10): "nei file da allegare inserisci anche foto e altri file utili tipo doc;
-- metti la possibilità dei tag così la ricerca diventa più semplice e di aggiungere il tipo (etichette)".
-- Solo aggiunte e vincoli allargati: nessun dato esistente cambia, RLS e permessi restano gli stessi.
--   1. tag text[]: etichette libere per la ricerca (al massimo 20).
--   2. tipo libero (1-40 caratteri): i sette tipi di prima restano validi e sono i suggerimenti dell'app.
--   3. Altri formati: Word, Excel, OpenDocument, testo, RTF, CSV (tabella e bucket privato).
--   4. cerca_documenti_studio cerca anche nei tag (stessa firma, SECURITY INVOKER).
BEGIN;
ALTER TABLE public.documenti_studio ADD COLUMN IF NOT EXISTS tag text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.documenti_studio DROP CONSTRAINT IF EXISTS documenti_studio_tag_check;
ALTER TABLE public.documenti_studio ADD CONSTRAINT documenti_studio_tag_check CHECK (cardinality(tag) <= 20 AND char_length(array_to_string(tag, '')) <= 800);
ALTER TABLE public.documenti_studio DROP CONSTRAINT IF EXISTS documenti_studio_tipo_check;
ALTER TABLE public.documenti_studio ADD CONSTRAINT documenti_studio_tipo_check CHECK (char_length(btrim(tipo)) BETWEEN 1 AND 40);
ALTER TABLE public.documenti_studio DROP CONSTRAINT IF EXISTS documenti_studio_mime_check;
ALTER TABLE public.documenti_studio ADD CONSTRAINT documenti_studio_mime_check CHECK (mime IN (
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain', 'application/rtf', 'text/csv'
));
CREATE INDEX IF NOT EXISTS documenti_studio_tag_idx ON public.documenti_studio USING gin (tag);
GRANT UPDATE (tag) ON public.documenti_studio TO authenticated;

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain', 'application/rtf', 'text/csv'
] WHERE id = 'documenti-studio';

CREATE OR REPLACE FUNCTION public.cerca_documenti_studio(q text DEFAULT '', lim integer DEFAULT 20)
RETURNS TABLE (tabella text, id text, titolo text, tipo text, data date, paziente_id bigint, paziente_nome text, file_path text, mime text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH parole AS (
    SELECT array_remove(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+'), '') AS w
  ), righe AS (
    SELECT 'documenti_studio'::text AS tabella, d.id::text AS id, d.titolo, d.tipo, d.data, d.paziente_id,
      nullif(btrim(coalesce(pa.nome, '') || ' ' || coalesce(pa.cognome, '')), '') AS paziente_nome, d.file_path, d.mime,
      lower(d.titolo || ' ' || d.tipo || ' ' || d.note || ' ' || array_to_string(d.tag, ' ') || ' ' || coalesce(pa.nome, '') || ' ' || coalesce(pa.cognome, '')) AS testo
    FROM public.documenti_studio d LEFT JOIN public.patients pa ON pa.id = d.paziente_id
    UNION ALL
    SELECT 'documenti_medici', m.id::text, coalesce(nullif(m.titolo, ''), m.tipo), m.tipo, m.data, m.paziente_id, m.paziente_nome, NULL, 'application/pdf',
      lower(coalesce(m.titolo, '') || ' ' || m.tipo || ' ' || coalesce(m.paziente_nome, ''))
    FROM public.documenti_medici m
    UNION ALL
    SELECT 'documenti_fiscali', f.id::text, initcap(f.tipo) || coalesce(' n. ' || f.numero, ''), f.tipo, f.data, f.paziente_id, f.paziente_nome, NULL, 'application/pdf',
      lower(f.tipo || ' ' || coalesce(f.numero, '') || ' ' || coalesce(f.paziente_nome, ''))
    FROM public.documenti_fiscali f
  )
  SELECT r.tabella, r.id, r.titolo, r.tipo, r.data, r.paziente_id, r.paziente_nome, r.file_path, r.mime
  FROM righe r, parole p
  WHERE NOT EXISTS (SELECT 1 FROM unnest(p.w) AS x(parola) WHERE position(x.parola IN r.testo) = 0)
  ORDER BY r.data DESC NULLS LAST, r.id DESC
  LIMIT least(greatest(coalesce(lim, 20), 1), 50)
$$;
REVOKE ALL ON FUNCTION public.cerca_documenti_studio(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerca_documenti_studio(text, integer) TO authenticated;
COMMIT;
