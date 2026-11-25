-- MIEI-DATI (PO 2026-11-25: "una sezione dove trovo i miei dati pronti da copiare ed inviare ed incollare, dati
-- fatturazione con partita iva e PEC ecc, poi scorrere per i vari altri dati delle altre società mie, con i
-- consulenti che le seguono" → "scorre in orizzontale, dati compilabili e modificabili [...] deve poter essere
-- aggiunta roba tipo società o d'altro").
-- Solo aggiunte. Una riga per scheda (Luca, ogni società, altro). I campi e i consulenti sono elenchi jsonb
-- liberi, così Luca aggiunge voci senza cambiare il database.
--  * campi:   [{ "gruppo": "fatturazione|contatti|banca|altro", "etichetta": "...", "valore": "..." }]
--  * persone: [{ "ruolo", "nome", "studio", "email", "pec", "telefono", "note" }]
-- Non si cancella: «Archivia» mette archiviata_il e la scheda sparisce dall'app.

create table if not exists miei_dati (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'societa' check (tipo in ('persona', 'societa', 'altro')),
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  descrizione   text,
  colore        text,
  ordine        integer not null default 0,
  campi         jsonb not null default '[]'::jsonb check (jsonb_typeof(campi) = 'array'),
  persone       jsonb not null default '[]'::jsonb check (jsonb_typeof(persone) = 'array'),
  note          text,
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  archiviata_il timestamptz
);
create index if not exists miei_dati_attive on miei_dati (ordine, creato_il) where archiviata_il is null;

alter table miei_dati enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'miei_dati' and policyname = 'proprietario') then
    create policy proprietario on miei_dati for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on miei_dati from authenticated;
revoke all on miei_dati from anon;

create or replace function miei_dati_tocca()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.modificato_il := now();
  return new;
end $$;
drop trigger if exists miei_dati_tocca on miei_dati;
create trigger miei_dati_tocca before insert or update on miei_dati
  for each row execute function miei_dati_tocca();
