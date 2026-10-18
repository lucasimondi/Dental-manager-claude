-- POL-VITA-014 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Conti › Da pagare = solo pagamenti attuali (PO 2026-10-17: "tutti i documenti che metti lì sotto a
-- pagamento dobbiamo toglierli da lì perché è roba di anni fa ... vanno in documenti").
--   1. scadenze.storica: true = resta nel suo documento ma non compare nei pagamenti da fare.
--      Tutte le scadenze esistenti (ricavate da email 2009–2022) diventano storiche: nessuna riga tolta.
--   2. Le scadenze che arrivano dalla posta già passate da più di 30 giorni nascono storiche.
--   3. categoria (Bollette, Pulizia, Assicurazioni, Bollo, …) e ricorrenza (mensile … annuale):
--      i pagamenti fissi si impostano una volta e, segnati pagati, si ripropongono alla scadenza dopo.
-- Solo aggiunte idempotenti. ROLLBACK (solo con conferma del PO):
--   drop trigger if exists scadenze_storiche on scadenze; drop function if exists scadenza_storica_da_posta();
--   alter table scadenze drop column if exists storica, drop column if exists categoria, drop column if exists ricorrenza;
alter table scadenze add column if not exists storica boolean not null default false;
alter table scadenze add column if not exists categoria text;
alter table scadenze add column if not exists ricorrenza text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scadenze_ricorrenza_valida') then
    alter table scadenze add constraint scadenze_ricorrenza_valida
      check (ricorrenza is null or ricorrenza in ('mensile','bimestrale','trimestrale','semestrale','annuale'));
  end if;
end $$;
create index if not exists scadenze_attuali_idx on scadenze (data) where not storica;

-- Una sola volta: le scadenze già presenti sono tutte ricavate da email di anni fa.
do $$
begin
  if not exists (select 1 from scadenze where storica) then
    update scadenze set storica = true where documento_id is not null;
  end if;
end $$;

create or replace function scadenza_storica_da_posta() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.documento_id is not null and new.data < current_date - 30 and exists (
    select 1 from documenti d where d.id = new.documento_id and coalesce(d.gmail_message_id, '') not like 'caricato:%'
  ) then
    new.storica := true;
  end if;
  return new;
end $$;
drop trigger if exists scadenze_storiche on scadenze;
create trigger scadenze_storiche before insert on scadenze for each row execute function scadenza_storica_da_posta();
