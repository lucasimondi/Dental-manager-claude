-- PASSWORD-PERSONALI (PO 2026-11-08): "password deve essere un registro su cui registro e devono vedersi".
-- Registro privato del suo autore, stesso database e stessa autorità delle note personali:
-- lo studio dal JWT e l'utente che scrive. Nessuna riga è condivisa, nemmeno nello stesso studio.
-- La password resta leggibile solo dal suo autore (RLS); non entra mai in ricerche lato server,
-- in Poliedron o in modelli: l'app la mostra solo su richiesta, nella pagina Password.
BEGIN;
CREATE TABLE public.password_personali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  titolo text NOT NULL CHECK (char_length(btrim(titolo)) BETWEEN 1 AND 200),
  utente text NOT NULL DEFAULT '' CHECK (char_length(utente) <= 320),
  segreto text NOT NULL DEFAULT '' CHECK (char_length(segreto) <= 1000),
  sito text NOT NULL DEFAULT '' CHECK (char_length(sito) <= 500),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_personali_owner_idx ON public.password_personali (studio_id, user_id, titolo);
ALTER TABLE public.password_personali ENABLE ROW LEVEL SECURITY;
CREATE POLICY password_personali_owner_read ON public.password_personali FOR SELECT TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid())
);
CREATE POLICY password_personali_owner_insert ON public.password_personali FOR INSERT TO authenticated WITH CHECK (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid())
);
CREATE POLICY password_personali_owner_update ON public.password_personali FOR UPDATE TO authenticated
  USING (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid()))
  WITH CHECK (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid()));
CREATE POLICY password_personali_owner_delete ON public.password_personali FOR DELETE TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid AND user_id = (SELECT auth.uid())
);
REVOKE ALL ON public.password_personali FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.password_personali TO authenticated;
-- Studio, autore e data di creazione restano fissi.
GRANT UPDATE (titolo, utente, segreto, sito, note, updated_at) ON public.password_personali TO authenticated;
COMMENT ON TABLE public.password_personali IS 'Registro password privato del suo autore (Studio e Personal). Mai inviato a Poliedron o a modelli.';
COMMIT;
