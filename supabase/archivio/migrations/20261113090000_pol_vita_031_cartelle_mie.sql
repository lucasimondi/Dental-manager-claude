-- POL-VITA-031 CARTELLE-MIE (PO 2026-11-13: "Voglio la possibilità di creare delle cartelle e
-- sottocartelle che possa selezionare anche per intere o i singoli documenti all'interno e modificare
-- condividere zippare per inviarle metter una password per apertura se voglio, e avere tutto a portata di mano").
-- Cartelle create da Luca, con sottocartelle. Un documento può stare in più cartelle (come un'etichetta):
-- i file su Drive non si spostano, l'archivio e le cartelle per ente restano come sono.
-- Solo aggiunte. Le cartelle non si cancellano: si archiviano (archiviata_il) e si possono ripristinare.
-- La vecchia tabella `cartelle` dello schema iniziale non si usa e non si tocca.

create table if not exists cartelle_mie (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) between 1 and 80),
  padre_id      uuid references cartelle_mie(id),
  colore        text,
  posizione     integer not null default 0,
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  archiviata_il timestamptz
);
create index if not exists cartelle_mie_padre on cartelle_mie (padre_id);

create table if not exists cartelle_mie_documenti (
  cartella_id  uuid not null references cartelle_mie(id) on delete cascade,
  documento_id uuid not null references documenti(id) on delete cascade,
  aggiunto_il  timestamptz not null default now(),
  primary key (cartella_id, documento_id)
);
create index if not exists cartelle_mie_documenti_doc on cartelle_mie_documenti (documento_id);

alter table cartelle_mie enable row level security;
alter table cartelle_mie_documenti enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cartelle_mie' and policyname = 'proprietario') then
    create policy proprietario on cartelle_mie for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cartelle_mie_documenti' and policyname = 'proprietario') then
    create policy proprietario on cartelle_mie_documenti for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on cartelle_mie, cartelle_mie_documenti from authenticated;
revoke all on cartelle_mie, cartelle_mie_documenti from anon;

-- Una cartella non può finire dentro sé stessa o dentro una sua sottocartella; nome ripulito.
create or replace function cartelle_mie_controlla()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.modificato_il := now();
  if new.padre_id is not null then
    if new.padre_id = new.id then
      raise exception 'Una cartella non può stare dentro sé stessa';
    end if;
    if exists (
      with recursive su as (
        select c.id, c.padre_id from cartelle_mie c where c.id = new.padre_id
        union all
        select c.id, c.padre_id from cartelle_mie c join su on c.id = su.padre_id
      )
      select 1 from su where su.id = new.id
    ) then
      raise exception 'Una cartella non può stare dentro una sua sottocartella';
    end if;
  end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'cartelle_mie_controlla_trg' and tgrelid = 'public.cartelle_mie'::regclass) then
    create trigger cartelle_mie_controlla_trg before insert or update on cartelle_mie
      for each row execute function cartelle_mie_controlla();
  end if;
end $$;

-- Elenco con i conteggi (documenti diretti e sottocartelle attive), con la RLS di chi legge.
create or replace view v_cartelle_mie with (security_invoker = true) as
select c.id, c.nome, c.padre_id, c.colore, c.posizione, c.creato_il, c.modificato_il, c.archiviata_il,
       (select count(*) from cartelle_mie_documenti cd where cd.cartella_id = c.id) as n_documenti,
       (select count(*) from cartelle_mie s where s.padre_id = c.id and s.archiviata_il is null) as n_sottocartelle
from cartelle_mie c;
revoke all on v_cartelle_mie from anon;
grant select on v_cartelle_mie to authenticated;
