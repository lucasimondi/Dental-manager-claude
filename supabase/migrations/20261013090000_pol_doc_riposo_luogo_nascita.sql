-- Certificato riposo (Product Owner, 2026-10-13): the certificate prints the
-- patient's place of birth, so the patient record gets that field. Nullable,
-- free text ("Cisternino (BR)"); no other change: the existing patients RLS
-- policies already cover every column of the row.
--
-- Rollback: ALTER TABLE public.patients DROP COLUMN IF EXISTS luogo_nascita;
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS luogo_nascita text
  CHECK (luogo_nascita IS NULL OR char_length(luogo_nascita) <= 120);
