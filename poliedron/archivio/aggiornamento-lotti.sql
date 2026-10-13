-- Aggiornamento: tabella dei resoconti per lotto (Supabase > SQL Editor > Run)
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
drop policy if exists proprietario on lotti_importazione;
create policy proprietario on lotti_importazione for all to authenticated
  using ((select e_proprietario())) with check ((select e_proprietario()));
