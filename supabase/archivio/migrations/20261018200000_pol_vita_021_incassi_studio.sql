-- POL-VITA-021 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Incassi di studio o di collaborazione registrati da Personal anche nel gestionale dello studio
-- (PO 2026-10-18: "Gli incassi se sono di studio o collaborazione vanno anche registrati in studio,
-- stessa logica"). Il movimento ricorda la riga creata nello studio (payments o pagamenti_esterni)
-- per aggiornarla o eliminarla insieme. Solo aggiunte idempotenti.
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
