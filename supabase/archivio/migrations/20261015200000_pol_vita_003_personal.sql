-- POL-VITA-003 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Poliedron Personal per telefono: fascicolo Riscaldamento, documenti personali per persona e
-- categoria (carta d'identità, codice fiscale, ...), impostazioni dell'app (sezioni, persone).
-- Solo aggiunte idempotenti: nessuna colonna o riga esistente viene modificata o tolta.
-- ROLLBACK: nessuno necessario; eventuale rimozione solo con conferma del PO.
insert into fascicoli (codice, nome, ordine) values ('riscaldamento', 'Riscaldamento', 7)
on conflict (codice) do nothing;

alter table documenti add column if not exists persona text;
alter table documenti add column if not exists categoria text;
create index if not exists documenti_persona_idx on documenti (persona) where persona is not null;
create index if not exists documenti_categoria_idx on documenti (categoria) where categoria is not null;

create table if not exists impostazioni_app (
  chiave        text primary key,
  valore        jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now()
);
alter table impostazioni_app enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'impostazioni_app' and policyname = 'proprietario') then
    create policy proprietario on impostazioni_app for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on impostazioni_app from authenticated;
revoke all on impostazioni_app from anon;
