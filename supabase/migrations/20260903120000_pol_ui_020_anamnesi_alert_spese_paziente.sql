-- POL-UI-020: Product Owner — la croce nell'header della scheda paziente
-- deve segnalare anamnesi mancante (bianca), nessun allarme (verde) o
-- allarme (rossa lampeggiante, con popup automatico) leggendo allergie,
-- malattie cardiache, oncologiche e tutte le altre controindicazioni.
--
-- Scoperto mentre si investigava: PatientClinicalHistory.jsx salva oggi
-- l'anamnesi su `patient.noteGenerale`, un campo SENZA colonna DB
-- corrispondente (patients ha solo `note`, un campo manuale distinto,
-- mai popolato dal flusso anamnesi). Ogni "Salva anamnesi" quindi
-- aggiorna solo lo stato React locale — il giro di sincronizzazione
-- (App.jsx `makeSyncSetter` -> DB.update) invia comunque un campo
-- inesistente, e l'anamnesi sparisce al primo refresh. Corretto qui alla
-- radice con colonne reali, invece di continuare a scrivere su un campo
-- fantasma.
--
-- Additive, nullable/default, reversibile: nessuna RLS nuova necessaria
-- (patients_studio è già scoperta solo su studio_id).
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anamnesi_compilata_il timestamptz;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anamnesi_nota text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anamnesi_allarme boolean NOT NULL DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anamnesi_allarme_dettagli jsonb NOT NULL DEFAULT '[]'::jsonb;

-- POL-UI-020: Product Owner — la nuova azione veloce "Spesa" in scheda
-- paziente deve scrivere una vera spesa (stessa tabella/modale di Spese),
-- con associazione al paziente facoltativa. Additiva, nullable, nessuna
-- RLS nuova (spese_studio è già scoperta solo su studio_id).
ALTER TABLE public.spese ADD COLUMN IF NOT EXISTS paziente_id bigint REFERENCES public.patients(id) ON DELETE SET NULL;
