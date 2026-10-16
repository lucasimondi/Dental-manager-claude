-- POL-VITA-008: separate user-facing labels from the constrained shared event type.
-- Additive and nullable for backward compatibility with Poliedra Studio.
ALTER TABLE public.impegni_personali
  ADD COLUMN IF NOT EXISTS etichetta text;
COMMENT ON COLUMN public.impegni_personali.etichetta IS 'Etichetta libera usata da Poliedron Personal; tipo resta vincolato per compatibilità con lo studio.';
