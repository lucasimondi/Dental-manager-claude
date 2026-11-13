-- POL-VITA-033 CARTELLE-SCRIVANIA (PO 2026-11-13: "rendi le cartelle trascinabili, i file trascinabili
-- anche dentro e fuori le cartelle, i file quando li metti sopra un'altro file crea una cartella,
-- un po' come le icone del desktop").
-- Solo aggiunte:
--   * cartelle_mie_scrivania: i file messi in «Le mie cartelle» fuori da ogni cartella (la scrivania);
--   * sposta_documenti_mie: sposta file tra scrivania e cartelle in un colpo solo;
--   * raggruppa_documenti_mie: file sopra file = nuova cartella con dentro i due (o più) file.
-- SECURITY INVOKER: valgono le RLS del proprietario. I documenti non si cancellano mai: si toglie
-- solo il collegamento con la cartella o la scrivania di partenza.

create table if not exists cartelle_mie_scrivania (
  documento_id uuid primary key references documenti(id) on delete cascade,
  aggiunto_il  timestamptz not null default now()
);
alter table cartelle_mie_scrivania enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cartelle_mie_scrivania' and policyname = 'proprietario') then
    create policy proprietario on cartelle_mie_scrivania for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on cartelle_mie_scrivania from authenticated;
revoke all on cartelle_mie_scrivania from anon;

-- p_da / p_a: id della cartella, oppure null = scrivania.
create or replace function sposta_documenti_mie(p_documenti uuid[], p_da uuid, p_a uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_documenti is null or cardinality(p_documenti) = 0 then return 0; end if;
  if p_da is not distinct from p_a then return 0; end if;
  if p_a is null then
    insert into cartelle_mie_scrivania (documento_id) select unnest(p_documenti) on conflict do nothing;
  else
    insert into cartelle_mie_documenti (cartella_id, documento_id) select p_a, unnest(p_documenti) on conflict do nothing;
  end if;
  if p_da is null then
    delete from cartelle_mie_scrivania where documento_id = any(p_documenti);
  else
    delete from cartelle_mie_documenti where cartella_id = p_da and documento_id = any(p_documenti);
  end if;
  return cardinality(p_documenti);
end $$;

-- Crea la cartella dentro p_dove (null = in cima) e ci sposta i file che erano in p_dove.
create or replace function raggruppa_documenti_mie(p_documenti uuid[], p_dove uuid, p_nome text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  nuova uuid;
begin
  if p_documenti is null or cardinality(p_documenti) < 2 then
    raise exception 'Servono almeno due file per fare una cartella';
  end if;
  insert into cartelle_mie (nome, padre_id) values (coalesce(nullif(btrim(p_nome), ''), 'Nuova cartella'), p_dove) returning id into nuova;
  perform sposta_documenti_mie(p_documenti, p_dove, nuova);
  return nuova;
end $$;

revoke all on function sposta_documenti_mie(uuid[], uuid, uuid) from public, anon;
revoke all on function raggruppa_documenti_mie(uuid[], uuid, text) from public, anon;
grant execute on function sposta_documenti_mie(uuid[], uuid, uuid) to authenticated;
grant execute on function raggruppa_documenti_mie(uuid[], uuid, text) to authenticated;
