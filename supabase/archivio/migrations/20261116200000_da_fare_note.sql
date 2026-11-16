-- DA-FARE v4 (2026-11-16, Luca: "per gli altri si inoltra paga ecc vanno bene"): note di avanzamento sul
-- promemoria ("chiamato il 18/11, mi richiamano"). Aggiunta idempotente, nessuna cancellazione.
alter table promemoria_azioni add column if not exists note text;
