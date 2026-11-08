-- NOTE-PERSONALI (PO 2026-11-07): note veloci della persona, visibili in Studio e in Personal.
-- Stesso database e stessa autorità degli impegni personali: lo studio dal JWT e l'utente che
-- le scrive. Ogni nota è privata del suo autore dentro il suo studio; nessuna nota è condivisa.
-- Il collegamento facoltativo a un paziente richiede che il paziente sia dello stesso studio.
BEGIN;
CREATE TABLE public.note_personali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  testo text NOT NULL CHECK (char_length(btrim(testo)) BETWEEN 1 AND 4000),
  area text NOT NULL DEFAULT 'personale' CHECK (area IN ('studio', 'famiglia', 'casa', 'idee', 'personale')),
  fissata boolean NOT NULL DEFAULT false,
  paziente_id bigint REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX note_personali_owner_idx ON public.note_personali (studio_id, user_id, fissata DESC, updated_at DESC);
CREATE INDEX note_personali_patient_fk_idx ON public.note_personali (paziente_id);
ALTER TABLE public.note_personali ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_personali_owner_read ON public.note_personali FOR SELECT TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND user_id = (SELECT auth.uid())
);
CREATE POLICY note_personali_owner_insert ON public.note_personali FOR INSERT TO authenticated WITH CHECK (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND user_id = (SELECT auth.uid())
  AND (paziente_id IS NULL OR EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = note_personali.studio_id))
);
CREATE POLICY note_personali_owner_update ON public.note_personali FOR UPDATE TO authenticated
  USING (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid()))
  WITH CHECK (
    studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
    AND user_id = (SELECT auth.uid())
    AND (paziente_id IS NULL OR EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = note_personali.studio_id))
  );
CREATE POLICY note_personali_owner_delete ON public.note_personali FOR DELETE TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND user_id = (SELECT auth.uid())
);
REVOKE ALL ON public.note_personali FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.note_personali TO authenticated;
-- Studio, autore e data di creazione restano fissi; si modificano solo contenuto e stato.
GRANT UPDATE (testo, area, fissata, paziente_id, updated_at) ON public.note_personali TO authenticated;
COMMENT ON TABLE public.note_personali IS 'Note veloci private del loro autore (Studio e Personal). Nessun dato clinico strutturato: il collegamento al paziente è solo un riferimento.';
COMMIT;
