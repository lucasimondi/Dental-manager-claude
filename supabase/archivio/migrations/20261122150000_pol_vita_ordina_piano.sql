-- POL-VITA-ORDINA fase 2 (PO 2026-11-22): tassonomia dell'archivio su Drive e piano di riordino.
-- Solo aggiunte. Niente si sposta qui: il piano contiene proposte che Luca approva una per una o a gruppi.
--  * categorie: la tassonomia (unica fonte di verità, vedi poliedron/archivio/TASSONOMIA.md), un nodo per cartella.
--  * piano_riordino: per ogni file non clinico la cartella e il nome proposti, la confidenza e il motivo.
--    stato: proposto → approvato | rifiutato → eseguito (fase 3). Mai i documenti dei pazienti.

create table if not exists categorie (
  id        text primary key,                 -- percorso stabile, es. '02/cuneo-via-piccona-36'
  percorso  text not null unique,             -- percorso leggibile su Drive, es. '02 Casa e catasto/Cuneo – via Piccona 36'
  nome      text not null,
  parent_id text references categorie(id),
  ordine    integer not null default 0,
  regole    jsonb not null default '{}'::jsonb,
  sinonimi  text[] not null default '{}',
  creato_il timestamptz not null default now()
);
alter table categorie enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categorie' and policyname = 'proprietario') then
    create policy proprietario on categorie for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke all on categorie from anon, public;
revoke truncate, references, trigger on categorie from authenticated;

create table if not exists piano_riordino (
  id               uuid primary key default gen_random_uuid(),
  documento_id     uuid references documenti(id) on delete set null,
  file_id          text not null unique,          -- id del file su Drive
  percorso_attuale text,
  nome_attuale     text,
  percorso_nuovo   text not null,
  nome_nuovo       text not null check (length(nome_nuovo) between 1 and 90 and nome_nuovo !~ '[/\\:*?"<>|]'),
  categoria_id     text references categorie(id),
  tipo             text,
  soggetto         text,
  data_documento   text,                          -- AAAA-MM-GG, AAAA-MM o AAAA
  dettaglio        text,
  confidenza       numeric(3,2) not null check (confidenza between 0 and 1),
  motivo           text,
  scorciatoie      text[] not null default '{}',  -- altre cartelle dove mettere una scorciatoia (mai copie)
  duplicato_di     text,                          -- file_id dell'originale per i duplicati certi
  stato            text not null default 'proposto' check (stato in ('proposto', 'approvato', 'rifiutato', 'eseguito')),
  autore           text not null default 'claude-code',
  creato_il        timestamptz not null default now(),
  aggiornato_il    timestamptz not null default now(),
  deciso_il        timestamptz
);
create index if not exists piano_riordino_stato on piano_riordino (stato, percorso_nuovo);
create index if not exists piano_riordino_documento on piano_riordino (documento_id);

alter table piano_riordino enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piano_riordino' and policyname = 'proprietario') then
    create policy proprietario on piano_riordino for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke all on piano_riordino from anon, public;
revoke truncate, references, trigger on piano_riordino from authenticated;

-- Data di modifica e data della decisione.
create or replace function piano_riordino_aggiorna()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  if new.stato is distinct from old.stato and new.stato in ('approvato', 'rifiutato') then new.deciso_il := now(); end if;
  return new;
end $$;
revoke execute on function piano_riordino_aggiorna() from anon, public;
drop trigger if exists piano_riordino_aggiorna on piano_riordino;
create trigger piano_riordino_aggiorna before update on piano_riordino
  for each row execute function piano_riordino_aggiorna();
