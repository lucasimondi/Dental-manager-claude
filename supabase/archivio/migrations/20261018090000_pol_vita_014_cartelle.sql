-- POL-VITA-016 (file 014, già applicata) — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Cartelle in Documenti: una cartella per ente (es. "Kerdos") con periodo, contatti, etichette,
-- note, sintesi dell'AI e promemoria. I documenti restano dove sono: la cartella è il loro ente.
-- Solo aggiunte idempotenti: nessuna colonna o riga esistente viene tolta.
-- ROLLBACK: nessuno necessario; eventuale rimozione solo con conferma del PO.

-- (Esiste già una tabella `cartelle` dello schema iniziale, non usata: non si tocca.)
create table if not exists cartelle_ente (
  ente          text primary key,
  etichette     text[] not null default '{}',
  note          text,
  sintesi       text,
  sintesi_il    timestamptz,
  creata_il     timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);
alter table cartelle_ente enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cartelle_ente' and policyname = 'proprietario') then
    create policy proprietario on cartelle_ente for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on cartelle_ente from authenticated;
revoke all on cartelle_ente from anon;

-- Promemoria di una cartella: sono scadenze (Agenda, Oggi, riepilogo delle 7) con la cartella.
alter table scadenze add column if not exists cartella text;
create index if not exists scadenze_cartella_idx on scadenze (cartella) where cartella is not null;

-- Elenco delle cartelle (mai i documenti clinici dei pazienti).
create or replace view v_cartelle with (security_invoker = true) as
select d.ente,
       count(*)::int as n,
       count(*) filter (where d.rilevanza is distinct from 'bassa')::int as n_utili,
       min(coalesce(d.data_documento, d.email_data::date)) as dal,
       max(coalesce(d.data_documento, d.email_data::date)) as al,
       mode() within group (order by d.fascicolo) as fascicolo,
       count(*) filter (where d.azione_richiesta)::int as n_da_fare,
       count(*) filter (where d.da_analizzare)::int as n_da_analizzare,
       sum(d.importo) as totale,
       count(distinct d.email_mittente)::int as n_contatti,
       c.etichette, c.note, c.sintesi, c.sintesi_il,
       (select count(*)::int from scadenze s where not s.completata
          and (s.cartella = d.ente or s.documento_id in (select x.id from documenti x where x.ente = d.ente))) as n_promemoria
from documenti d
left join cartelle_ente c on c.ente = d.ente
where d.ente is not null and d.fascicolo <> 'clinico_pazienti'
group by d.ente, c.etichette, c.note, c.sintesi, c.sintesi_il;
revoke all on v_cartelle from anon;

-- Rinomina una cartella (o la unisce a un'altra con quel nome): cambia l'ente dei documenti,
-- porta etichette, note e promemoria. Gira con i permessi di chi la chiama (RLS del proprietario).
create or replace function rinomina_cartella(da text, a text) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_a text := nullif(trim(a), '');
  v_n int;
begin
  if v_a is null or da is null or da = v_a then
    return 0;
  end if;
  update documenti set ente = v_a where ente = da and fascicolo <> 'clinico_pazienti';
  get diagnostics v_n = row_count;
  update scadenze set cartella = v_a where cartella = da;
  if exists (select 1 from cartelle_ente where ente = da) then
    insert into cartelle_ente (ente, etichette, note, sintesi, sintesi_il)
      select v_a, etichette, note, sintesi, sintesi_il from cartelle_ente where ente = da
    on conflict (ente) do update set
      etichette = (select array(select distinct unnest(cartelle_ente.etichette || excluded.etichette))),
      note = nullif(concat_ws(E'\n', cartelle_ente.note, excluded.note), ''),
      aggiornata_il = now();
    update cartelle_ente set etichette = '{}', note = null, sintesi = null, sintesi_il = null, aggiornata_il = now() where ente = da;
  end if;
  return v_n;
end $$;
revoke execute on function rinomina_cartella(text, text) from public, anon;
grant execute on function rinomina_cartella(text, text) to authenticated;
