-- POL-VITA-002 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Equivalente di poliedron/archivio/aggiornamento-lotti.sql (resoconti per lotto dello script
-- di importazione), applicato il 2026-10-13. Unica differenza: la policy si crea solo se manca
-- invece di "drop policy if exists" + create (stesso risultato, idempotente, nessun drop).
-- In più, come per le altre tabelle (20261013090000): niente TRUNCATE/REFERENCES/TRIGGER per authenticated.
-- ROLLBACK: nessuno necessario (tabella nuova, solo dati di resoconto); eventuale rimozione solo con conferma del PO.
create table if not exists lotti_importazione (
  id bigserial primary key,
  periodo text not null unique,
  documenti int not null default 0,
  duplicati int not null default 0,
  errori int not null default 0,
  per_fascicolo jsonb not null default '{}'::jsonb,
  nuove_pratiche jsonb not null default '[]'::jsonb,
  urgenti jsonb not null default '[]'::jsonb,
  creato_il timestamptz not null default now()
);
alter table lotti_importazione enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lotti_importazione' and policyname = 'proprietario') then
    create policy proprietario on lotti_importazione for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on lotti_importazione from authenticated;
revoke all on lotti_importazione from anon;
