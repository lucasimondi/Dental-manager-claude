-- DOCUMENTI-STUDIO (PO 2026-11-08): "Fai ancora la modifica del db in modo che si possano cercare
-- documenti anche in studio e crearli". Studio aveva solo documenti generati dall'app
-- (documenti_fiscali, documenti_medici, salvati come PDF nella riga). Qui:
--   1. documenti_studio: documenti ACQUISITI (foto o file) dello studio, facoltativamente legati
--      a un paziente dello stesso studio; il file sta nel bucket privato documenti-studio, nella
--      cartella dello studio (<studio_id>/<uuid>.<ext>).
--   2. cerca_documenti_studio(q, lim): una ricerca unica su acquisiti, medici e fiscali, con i
--      permessi di chi chiama (SECURITY INVOKER: valgono le RLS di ogni tabella). Nessun contenuto
--      del file viene letto o indicizzato: solo titolo, tipo, numero e nome del paziente.
BEGIN;
CREATE TABLE public.documenti_studio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  titolo text NOT NULL CHECK (char_length(btrim(titolo)) BETWEEN 1 AND 200),
  tipo text NOT NULL DEFAULT 'documento' CHECK (tipo IN ('documento', 'referto', 'consenso', 'fattura_fornitore', 'ricevuta', 'preventivo', 'altro')),
  paziente_id bigint REFERENCES public.patients(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  file_path text NOT NULL UNIQUE CHECK (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,5}$' AND split_part(file_path, '/', 1) = studio_id::text),
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  dimensione integer NOT NULL CHECK (dimensione BETWEEN 1 AND 15728640),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documenti_studio_studio_idx ON public.documenti_studio (studio_id, data DESC);
CREATE INDEX documenti_studio_patient_fk_idx ON public.documenti_studio (paziente_id);
ALTER TABLE public.documenti_studio ENABLE ROW LEVEL SECURITY;
-- Come gli altri documenti dello studio: visibili a chi lavora nello studio del JWT.
CREATE POLICY documenti_studio_read ON public.documenti_studio FOR SELECT TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
);
CREATE POLICY documenti_studio_insert ON public.documenti_studio FOR INSERT TO authenticated WITH CHECK (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND user_id = (SELECT auth.uid())
  AND (paziente_id IS NULL OR EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = documenti_studio.studio_id))
);
CREATE POLICY documenti_studio_update ON public.documenti_studio FOR UPDATE TO authenticated
  USING (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid)
  WITH CHECK (
    studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
    AND (paziente_id IS NULL OR EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = documenti_studio.studio_id))
  );
CREATE POLICY documenti_studio_delete ON public.documenti_studio FOR DELETE TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
);
REVOKE ALL ON public.documenti_studio FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.documenti_studio TO authenticated;
-- Studio, autore, file e data di caricamento restano fissi.
GRANT UPDATE (titolo, tipo, paziente_id, data, note) ON public.documenti_studio TO authenticated;
COMMENT ON TABLE public.documenti_studio IS 'Documenti acquisiti dallo studio (foto o file nel bucket privato documenti-studio). Mai inviati a modelli.';

-- Bucket privato, una cartella per studio.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documenti-studio', 'documenti-studio', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY documenti_studio_files_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'documenti-studio' AND (storage.foldername(name))[1] = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')
);
CREATE POLICY documenti_studio_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documenti-studio' AND (storage.foldername(name))[1] = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')
);
CREATE POLICY documenti_studio_files_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'documenti-studio' AND (storage.foldername(name))[1] = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')
);

-- Ricerca unica: ogni parola deve comparire (titolo, tipo, numero, paziente). Vuota = i più recenti.
CREATE FUNCTION public.cerca_documenti_studio(q text DEFAULT '', lim integer DEFAULT 20)
RETURNS TABLE (tabella text, id text, titolo text, tipo text, data date, paziente_id bigint, paziente_nome text, file_path text, mime text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH parole AS (
    SELECT array_remove(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+'), '') AS w
  ), righe AS (
    SELECT 'documenti_studio'::text AS tabella, d.id::text AS id, d.titolo, d.tipo, d.data, d.paziente_id,
      nullif(btrim(coalesce(pa.nome, '') || ' ' || coalesce(pa.cognome, '')), '') AS paziente_nome, d.file_path, d.mime,
      lower(d.titolo || ' ' || d.tipo || ' ' || d.note || ' ' || coalesce(pa.nome, '') || ' ' || coalesce(pa.cognome, '')) AS testo
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
