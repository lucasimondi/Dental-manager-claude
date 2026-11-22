-- POL-VITA-ORDINA fase 3 — esecuzione su Drive delle sole righe approvate del piano, a lotti di 100,
-- con registro di ogni spostamento e «Annulla lotto». Migrazione additiva e idempotente.

-- Le cartelle della tassonomia sono cartelle dell'app (cartelle_mie) con la gemella su Drive: stesso albero.
alter table cartelle_mie add column if not exists categoria_id text references categorie(id);
create unique index if not exists cartelle_mie_categoria_unica on cartelle_mie(categoria_id) where categoria_id is not null;

create table if not exists log_spostamenti (
  id                    bigint generated always as identity primary key,
  lotto                 uuid not null,
  piano_id              uuid references piano_riordino(id) on delete set null,
  documento_id          uuid references documenti(id) on delete set null,
  file_id               text not null,
  da_padre_id           text,               -- cartella Drive di prima
  da_nome               text,               -- nome su Drive di prima
  a_padre_id            text,
  a_nome                text,
  cartella_mia          uuid,               -- cartella dell'app dove è entrato
  cartelle_prima        uuid[] not null default '{}',  -- cartelle dell'app dove stava prima
  drive_fissa_prima     boolean,
  drive_cartella_prima  text,
  drive_rinomina_prima  boolean,
  scorciatoie           text[] not null default '{}',  -- id delle scorciatoie Drive create (mai copie)
  esito                 text not null default 'in_corso' check (esito in ('in_corso', 'eseguito', 'errore', 'annullato')),
  errore                text,
  eseguito_il           timestamptz not null default now(),
  annullato_il          timestamptz
);
create index if not exists log_spostamenti_lotto on log_spostamenti(lotto);

alter table log_spostamenti enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'log_spostamenti' and policyname = 'proprietario') then
    create policy proprietario on log_spostamenti for select to authenticated using ((select e_proprietario()));
  end if;
end $$;
revoke all on log_spostamenti from anon, public;
revoke insert, update, delete, truncate, references, trigger on log_spostamenti from authenticated;

-- Lotti per la schermata: quanti spostati, errori, quando, se annullato.
create or replace view v_lotti_riordino with (security_invoker = true) as
select lotto,
       min(eseguito_il) as iniziato_il,
       count(*) filter (where esito = 'eseguito') as eseguiti,
       count(*) filter (where esito = 'errore') as errori,
       count(*) filter (where esito = 'annullato') as annullati,
       max(annullato_il) as annullato_il
from log_spostamenti group by lotto;
revoke all on v_lotti_riordino from anon, public;
