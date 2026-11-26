-- RUBRICA (PO 2026-11-26: "Fammi una sezione contatti dove io possa mettere professionisti idraulici aziende
-- manutenzione stufa eccetera, catalogabile così io se ho un problema so chi chiamare, ad esempio anche
-- cartongessisti eccetera dove possa anche inserire note e anche ad esempio promemoria per cambio gomme oppure
-- manutenzione stufa ecc" → mockup → "Ok crea").
-- Solo aggiunte. Due tabelle del proprietario:
--  * rubrica:            un professionista o un'azienda da chiamare, con categorie libere (Idraulico, Stufa e
--                        caldaia, Cartongessista…), recapiti, note e lo storico degli interventi
--                        interventi: [{ "data", "voce", "importo", "note" }]
--  * rubrica_promemoria: una cosa da ricordare (cambio gomme, manutenzione stufa…) con la data, ogni quanto si
--                        ripete e quanti giorni prima avvisare; può essere legata a un contatto della rubrica.
-- Non si cancella: «Archivia» mette archiviato_il; un promemoria «Fatto» che si ripete passa alla data seguente.

create table if not exists rubrica (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  referente     text check (referente is null or length(referente) <= 160),
  categorie     text[] not null default '{}' check (cardinality(categorie) <= 12),
  telefono      text check (telefono is null or length(telefono) <= 60),
  telefono2     text check (telefono2 is null or length(telefono2) <= 60),
  email         text check (email is null or length(email) <= 200),
  indirizzo     text check (indirizzo is null or length(indirizzo) <= 300),
  sito          text check (sito is null or length(sito) <= 300),
  orari         text check (orari is null or length(orari) <= 200),
  parole        text check (parole is null or length(parole) <= 500),
  note          text check (note is null or length(note) <= 8000),
  voto          smallint check (voto is null or voto between 1 and 5),
  preferito     boolean not null default false,
  interventi    jsonb not null default '[]'::jsonb check (jsonb_typeof(interventi) = 'array'),
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  archiviato_il timestamptz
);
create index if not exists rubrica_attivi on rubrica (nome) where archiviato_il is null;

create table if not exists rubrica_promemoria (
  id            uuid primary key default gen_random_uuid(),
  contatto_id   uuid references rubrica (id) on delete set null,
  cosa          text not null check (length(btrim(cosa)) between 1 and 160),
  data          date not null,
  ripeti        text not null default 'mai' check (ripeti in ('mai', '1m', '3m', '6m', '1a', '2a')),
  avviso_giorni integer not null default 30 check (avviso_giorni between 0 and 365),
  note          text check (note is null or length(note) <= 2000),
  ultimo_fatto  date,
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  archiviato_il timestamptz
);
create index if not exists rubrica_promemoria_attivi on rubrica_promemoria (data) where archiviato_il is null;
create index if not exists rubrica_promemoria_contatto on rubrica_promemoria (contatto_id);

alter table rubrica enable row level security;
alter table rubrica_promemoria enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rubrica' and policyname = 'proprietario') then
    create policy proprietario on rubrica for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rubrica_promemoria' and policyname = 'proprietario') then
    create policy proprietario on rubrica_promemoria for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on rubrica, rubrica_promemoria from authenticated;
revoke all on rubrica, rubrica_promemoria from anon;

create or replace function rubrica_tocca()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'rubrica' then
    new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  else
    new.cosa := btrim(regexp_replace(new.cosa, '\s+', ' ', 'g'));
  end if;
  new.modificato_il := now();
  return new;
end $$;
drop trigger if exists rubrica_tocca on rubrica;
create trigger rubrica_tocca before insert or update on rubrica
  for each row execute function rubrica_tocca();
drop trigger if exists rubrica_promemoria_tocca on rubrica_promemoria;
create trigger rubrica_promemoria_tocca before insert or update on rubrica_promemoria
  for each row execute function rubrica_tocca();
