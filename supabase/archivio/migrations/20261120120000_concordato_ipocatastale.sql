-- CONCORDATO › situazione ipocatastale (PO 2026-11-20: "prendi oltre queste foto anche i due documenti che ho
-- caricato su drive visura ipocatastale Simondi, matcha i dati, crea un documento fatto bene e arricchisci la
-- sezione […] documenti che possa utilizzare anche con mia sorella").
-- Solo aggiunte:
--  * concordato_beni: superficie catastale, intestatari completi dalla visura (jsonb), provenienza (successione).
--  * concordato_formalita: le note di trascrizione e iscrizione (ipoteche, pignoramenti, domande di divisione,
--    successioni) dalle ispezioni ipotecarie, con i beni a cui si riferiscono e quanto è certo il collegamento.
-- Lettura e scrittura solo per il proprietario.

alter table concordato_beni add column if not exists superficie text;
alter table concordato_beni add column if not exists intestatari jsonb not null default '[]'::jsonb;
alter table concordato_beni add column if not exists provenienza text;

create table if not exists concordato_formalita (
  id                 uuid primary key default gen_random_uuid(),
  ordine             integer not null default 0,
  tipo               text not null check (tipo in ('trascrizione', 'iscrizione', 'annotazione')),
  verso              text not null check (verso in ('favore', 'contro')),
  data               date not null,
  reg_particolare    text,
  reg_generale       text,
  pubblico_ufficiale text,
  repertorio         text,
  atto               text not null,
  natura             text not null check (natura in ('successione', 'accettazione', 'ipoteca_volontaria', 'ipoteca_giudiziale',
                       'pignoramento', 'domanda_divisione', 'convenzione', 'cessione', 'altro')),
  comuni             text,
  creditore          text,
  procedura          text,
  beni               jsonb not null default '[]'::jsonb,
  note               text,
  fonte              text,
  creato_il          timestamptz not null default now(),
  aggiornato_il      timestamptz not null default now(),
  check (jsonb_typeof(beni) = 'array')
);
create index if not exists concordato_formalita_data on concordato_formalita (data);

alter table concordato_formalita enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'concordato_formalita' and policyname = 'proprietario') then
    create policy proprietario on concordato_formalita for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on concordato_formalita from authenticated;
revoke all on concordato_formalita from anon;
revoke delete on concordato_formalita from authenticated;
