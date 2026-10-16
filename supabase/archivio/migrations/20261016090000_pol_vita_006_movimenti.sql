-- POL-VITA-006 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Conti di Poliedron Personal: incassi e spese registrati da Luca, per il bilancino.
-- Un pagamento dell'archivio segnato come pagato può diventare una spesa (scadenza_id, una sola).
-- Solo aggiunte idempotenti: nessuna colonna o riga esistente viene modificata o tolta.
-- ROLLBACK: nessuno necessario; eventuale rimozione solo con conferma del PO.
create table if not exists movimenti (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default current_date,
  tipo          text not null check (tipo in ('entrata', 'uscita')),
  importo       numeric(12,2) not null check (importo >= 0),
  descrizione   text not null,
  categoria     text,
  documento_id  uuid references documenti(id) on delete set null,
  scadenza_id   uuid references scadenze(id) on delete set null,
  note          text,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists movimenti_data_idx on movimenti (data desc);
create unique index if not exists movimenti_scadenza_idx on movimenti (scadenza_id) where scadenza_id is not null;
create index if not exists movimenti_documento_idx on movimenti (documento_id) where documento_id is not null;

alter table movimenti enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movimenti' and policyname = 'proprietario') then
    create policy proprietario on movimenti for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on movimenti from authenticated;
revoke all on movimenti from anon;
