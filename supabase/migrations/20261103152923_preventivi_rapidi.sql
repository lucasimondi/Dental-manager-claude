-- PREVENTIVI-RAPIDI: immutable document snapshots, not a second financial ledger.
-- Baseline columns and plans/patients studio policies inspected read-only 2026-11-03.
BEGIN;
CREATE TABLE public.preventivi (
  id uuid PRIMARY KEY,
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  piano_id bigint REFERENCES public.plans(id) ON DELETE SET NULL,
  paziente_id bigint NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  paziente_nome text NOT NULL,
  titolo text NOT NULL,
  data date NOT NULL,
  numero text NOT NULL,
  plan_snapshot jsonb NOT NULL CHECK (jsonb_typeof(plan_snapshot) = 'object'),
  pdf_base64 text NOT NULL CHECK (pdf_base64 LIKE 'data:application/pdf;%base64,%' AND octet_length(pdf_base64) BETWEEN 16 AND 20971520),
  archiviato boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, numero)
);
CREATE INDEX preventivi_studio_data_idx ON public.preventivi (studio_id, archiviato, created_at DESC, id);
CREATE INDEX preventivi_paziente_idx ON public.preventivi (studio_id, paziente_id, created_at DESC);
CREATE INDEX preventivi_piano_idx ON public.preventivi (piano_id);
CREATE INDEX preventivi_patient_fk_idx ON public.preventivi (paziente_id);
ALTER TABLE public.preventivi ENABLE ROW LEVEL SECURITY;
-- Same tenant authority as plans, also requiring continued visibility of the source.
CREATE POLICY preventivi_read ON public.preventivi FOR SELECT TO authenticated USING (
  studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = preventivi.studio_id)
  AND (piano_id IS NULL OR EXISTS (SELECT 1 FROM public.plans p WHERE p.id = piano_id AND p.studio_id = preventivi.studio_id AND p.paziente_id = preventivi.paziente_id))
);
CREATE POLICY preventivi_insert ON public.preventivi FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid())
  AND studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
  AND piano_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.plans p JOIN public.patients a ON a.id = p.paziente_id AND a.studio_id = p.studio_id
    WHERE p.id = piano_id AND p.studio_id = preventivi.studio_id AND a.id = preventivi.paziente_id)
);
CREATE POLICY preventivi_archive ON public.preventivi FOR UPDATE TO authenticated
  USING (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid
    AND EXISTS (SELECT 1 FROM public.patients a WHERE a.id = paziente_id AND a.studio_id = preventivi.studio_id)
  AND (piano_id IS NULL OR EXISTS (SELECT 1 FROM public.plans p WHERE p.id = piano_id AND p.studio_id = preventivi.studio_id AND p.paziente_id = preventivi.paziente_id)))
  WITH CHECK (studio_id = ((SELECT auth.jwt())->'app_metadata'->>'studio_id')::uuid);
REVOKE ALL ON public.preventivi FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.preventivi TO authenticated;
-- Only lifecycle flag is mutable. PDF, prices, source and authorship remain immutable.
GRANT UPDATE (archiviato) ON public.preventivi TO authenticated;
COMMENT ON TABLE public.preventivi IS 'Immutable issued quote PDFs. Financial source remains plans; native sharing is never evidence of delivery.';
COMMIT;
