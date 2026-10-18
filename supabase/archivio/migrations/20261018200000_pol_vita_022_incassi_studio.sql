-- POL-VITA-022 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Incassi di studio o di collaborazione registrati da Personal anche nel gestionale dello studio
-- (PO 2026-10-18: "Gli incassi se sono di studio o collaborazione vanno anche registrati in studio,
-- stessa logica"). Prima idea: il movimento ricordava la riga creata nello studio. Decisione finale
-- del PO (stesso giorno): una sola fonte, gli incassi stanno solo nello studio e Personal ne legge il
-- netto; queste colonne restano vuote e non usate (già applicate, non si tolgono). Solo aggiunte idempotenti.
-- Applicata sul progetto con il nome pol_vita_021_incassi_studio (numero poi cambiato per una collisione).
-- ROLLBACK: nessuno necessario; eventuale rimozione solo con conferma del PO.
alter table movimenti add column if not exists studio_tabella text;
alter table movimenti add column if not exists studio_riga bigint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'movimenti_studio_tabella_check') then
    alter table movimenti add constraint movimenti_studio_tabella_check
      check (studio_tabella is null or studio_tabella in ('payments', 'pagamenti_esterni'));
  end if;
end $$;
