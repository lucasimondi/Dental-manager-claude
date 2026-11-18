-- LEGAL-SCHEDE (PO 2026-11-18: "dobbiamo prendere i documenti legali ed economici, analizzarli […] la sezione
-- legal […] la dobbiamo rendere attiva sia nella creazione di una tabella scadenze e punti salienti e passi da
-- fare attenzionare" → esempio UnoEnergy → "Sì vai, parti dalla tabella scadenze e scheda pratica").
-- Solo aggiunte:
--  * pratiche_schede: la scheda di una pratica (in sintesi, punti salienti, da attenzionare), scritta dallo
--    script leggendo i documenti (mai quelli dei pazienti) o da Claude Code in sessione con Luca.
--    Lettura solo per il proprietario; scrittura solo con la chiave di servizio.
--  * promemoria_azioni.pratica_id: i «passi da fare» della scheda sono promemoria di «Da fare» collegati alla
--    pratica: spuntati in un posto, spuntati anche nell'altro.

create table if not exists pratiche_schede (
  pratica_id   uuid primary key references pratiche(id) on delete cascade,
  oggetto      text,
  controparte  text,
  autorita     text,
  importo      numeric,
  sintesi      text,
  punti        jsonb not null default '[]'::jsonb,
  attenzione   jsonb not null default '[]'::jsonb,
  fonti        uuid[] not null default '{}',
  modello      text,
  generata_il  timestamptz not null default now()
);
alter table pratiche_schede enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pratiche_schede' and policyname = 'proprietario_legge') then
    create policy proprietario_legge on pratiche_schede for select to authenticated using ((select e_proprietario()));
  end if;
end $$;
revoke all on pratiche_schede from anon;
revoke insert, update, delete, truncate, references, trigger on pratiche_schede from authenticated;
grant select on pratiche_schede to authenticated;

alter table promemoria_azioni add column if not exists pratica_id uuid references pratiche(id) on delete set null;
create index if not exists promemoria_azioni_pratica_idx on promemoria_azioni (pratica_id) where pratica_id is not null;
