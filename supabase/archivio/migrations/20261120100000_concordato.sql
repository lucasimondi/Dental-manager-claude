-- CONCORDATO (PO 2026-11-20: "crea una sezione concordato dove dentro ci mettiamo il documento degli immobili
-- […] PDF dell'elenco dei miei beni le quote […] e poi una sottosezione divisione in cui si possa inserire poi i
-- valori di perizia […] cose a me cose ad Anna, conguagli […] come fosse un excel ma su app").
-- Solo aggiunte:
--  * concordato_beni: i beni immobili di Luca dalla visura catastale (dati catastali, titolo, quota di Luca,
--    quota di Anna se il bene è in comune con lei, vincoli, valore di mercato dell'intero bene inserito da Luca).
--  * divisione_scenari: le proposte di divisione con Anna (a chi va ogni bene, voci di conguaglio, note).
-- Lettura e scrittura solo per il proprietario (stessa regola delle altre tabelle dell'archivio).

create table if not exists concordato_beni (
  id                  uuid primary key default gen_random_uuid(),
  ordine              integer not null default 0,
  gruppo              text,
  nome                text,
  catasto             text not null check (catasto in ('F', 'T')),
  comune              text not null,
  indirizzo           text,
  piano               text,
  foglio              text,
  particella          text,
  subalterno          text,
  categoria           text,
  classe              text,
  consistenza         text,
  rendita             numeric,
  reddito_dominicale  numeric,
  reddito_agrario     numeric,
  titolo              text not null default 'Proprietà',
  quota_luca          text not null check (quota_luca ~ '^[0-9]+/[0-9]+$'),
  quota_anna          text check (quota_anna is null or quota_anna ~ '^[0-9]+/[0-9]+$'),
  altri_comproprietari text,
  in_divisione        boolean not null default false,
  vincoli             text,
  note                text,
  valore              numeric check (valore is null or valore >= 0),
  valore_fonte        text,
  fonte               text,
  creato_il           timestamptz not null default now(),
  aggiornato_il       timestamptz not null default now()
);
create index if not exists concordato_beni_ordine on concordato_beni (ordine);

create table if not exists divisione_scenari (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(nome) between 1 and 120),
  descrizione   text,
  assegnazioni  jsonb not null default '{}'::jsonb,
  voci          jsonb not null default '[]'::jsonb,
  note          text,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (jsonb_typeof(assegnazioni) = 'object'),
  check (jsonb_typeof(voci) = 'array')
);

alter table concordato_beni enable row level security;
alter table divisione_scenari enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'concordato_beni' and policyname = 'proprietario') then
    create policy proprietario on concordato_beni for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'divisione_scenari' and policyname = 'proprietario') then
    create policy proprietario on divisione_scenari for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on concordato_beni, divisione_scenari from authenticated;
revoke all on concordato_beni, divisione_scenari from anon;
-- I beni non si cancellano dall'app (si tolgono dalla divisione); le proposte sì, dopo una conferma.
revoke delete on concordato_beni from authenticated;
