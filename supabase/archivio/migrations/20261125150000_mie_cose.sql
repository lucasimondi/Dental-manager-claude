-- APP-AUTO-CASA-SALUTE (PO 2026-11-25: "sviluppa bene come una app la sezione auto e motori con le info di cui
-- necessita quindi assicurazione tagliandi ecc foto del mezzo, cosicché sia anche una icona del personale, che ci
-- sia in home e che sia app a parte, così si deve fare anche con la sezione/app casa con le cose che servono
-- aggiungibili così come la sezione salute come app e come sezione").
-- Solo aggiunte. Una riga per «cosa» di un'app: un veicolo (auto), un immobile (casa), una persona (salute).
--  * campi:    [{ "gruppo", "etichetta", "valore", "tipo": "testo|data|numero", "avviso": bool }]
--              le date con avviso sono scadenze (assicurazione, bollo, revisione, caldaia, tessera sanitaria…)
--  * registro: [{ "data", "voce", "km", "importo", "note" }]  tagliandi, lavori, visite
--  * persone:  [{ "ruolo", "nome", "telefono", "email", "indirizzo", "note" }]  officina, idraulico, medico…
--  * foto:     una foto della cosa, JPEG ridotto dall'app (data URL, massimo ~450 KB)
-- Non si cancella: «Archivia» mette archiviata_il e la scheda sparisce dall'app.

create table if not exists mie_cose (
  id            uuid primary key default gen_random_uuid(),
  ambito        text not null check (ambito in ('auto', 'casa', 'salute')),
  tipo          text not null default 'altro' check (length(tipo) between 1 and 30),
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  descrizione   text,
  colore        text,
  ordine        integer not null default 0,
  foto          text check (foto is null or (length(foto) <= 600000 and foto ~ '^data:image/(jpeg|png|webp);base64,')),
  campi         jsonb not null default '[]'::jsonb check (jsonb_typeof(campi) = 'array'),
  registro      jsonb not null default '[]'::jsonb check (jsonb_typeof(registro) = 'array'),
  persone       jsonb not null default '[]'::jsonb check (jsonb_typeof(persone) = 'array'),
  note          text,
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  archiviata_il timestamptz
);
create index if not exists mie_cose_attive on mie_cose (ambito, ordine, creato_il) where archiviata_il is null;

alter table mie_cose enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mie_cose' and policyname = 'proprietario') then
    create policy proprietario on mie_cose for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on mie_cose from authenticated;
revoke all on mie_cose from anon;

create or replace function mie_cose_tocca()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.modificato_il := now();
  return new;
end $$;
drop trigger if exists mie_cose_tocca on mie_cose;
create trigger mie_cose_tocca before insert or update on mie_cose
  for each row execute function mie_cose_tocca();
