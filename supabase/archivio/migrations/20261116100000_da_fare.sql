-- DA-FARE (2026-11-16, Luca: "metti in una sezione creata dei remind sintetici ed esplicativi con i tastini
-- per cliccare gestita rimuovi dimmi cosa fare rispondi ad email"). Promemoria d'azione scritti leggendo
-- email e documenti: titolo breve, spiegazione, passi da fare, eventuale bozza di risposta. «Rimuovi» non
-- cancella: stato = 'rimosso'. Solo aggiunte idempotenti; RLS come le altre tabelle (solo il proprietario).
create table if not exists promemoria_azioni (
  id              uuid primary key default gen_random_uuid(),
  documento_id    uuid references documenti(id) on delete set null,
  ente            text,
  titolo          text not null,
  spiegazione     text,
  cosa_fare       text,
  bozza_risposta  text,
  scadenza        date,
  importo         numeric,
  priorita        text not null default 'media',
  stato           text not null default 'aperto',
  stato_il        timestamptz,
  creato_il       timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promemoria_azioni_priorita') then
    alter table promemoria_azioni add constraint promemoria_azioni_priorita check (priorita in ('alta', 'media', 'bassa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promemoria_azioni_stato') then
    alter table promemoria_azioni add constraint promemoria_azioni_stato check (stato in ('aperto', 'gestito', 'rimosso'));
  end if;
end $$;
create index if not exists promemoria_azioni_aperti_idx on promemoria_azioni (stato, priorita, scadenza);
create index if not exists promemoria_azioni_documento_idx on promemoria_azioni (documento_id);
alter table promemoria_azioni enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'promemoria_azioni' and policyname = 'proprietario') then
    create policy proprietario on promemoria_azioni for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on promemoria_azioni from authenticated;
revoke all on promemoria_azioni from anon;
