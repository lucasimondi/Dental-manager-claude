-- POL-VITA-030 ARCHIVIO-CHIEDI (PO 2026-11-12: "Si procedi").
-- Ricerca che capisce: sinonimi personali, accenti, plurali, errori di battitura,
-- ordine per pertinenza. Solo aggiunte: estensioni, una tabella di sinonimi
-- (RLS proprietario) e una funzione SECURITY INVOKER (la RLS di documenti resta l'unico filtro).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Sinonimi: una parola cercata -> altre parole equivalenti (separate da virgola).
create table if not exists sinonimi_ricerca (
  id        uuid primary key default gen_random_uuid(),
  parola    text not null,
  equivale  text not null,
  creato_il timestamptz not null default now()
);
create unique index if not exists sinonimi_ricerca_parola on sinonimi_ricerca (lower(parola));
alter table sinonimi_ricerca enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sinonimi_ricerca' and policyname = 'proprietario') then
    create policy proprietario on sinonimi_ricerca for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on sinonimi_ricerca from authenticated;
revoke all on sinonimi_ricerca from anon;

-- Sinonimi di partenza (generici, nessun dato personale). Luca può aggiungerne dall'app.
insert into sinonimi_ricerca (parola, equivale) values
  ('luce', 'energia elettrica,elettricita,enel,hera,edison,a2a,iren,sorgenia,plenitude,acea,servizio elettrico'),
  ('gas', 'metano,gas naturale,italgas,hera,eni,plenitude,edison,a2a,iren'),
  ('acqua', 'servizio idrico,acquedotto,idrico'),
  ('bolletta', 'fattura,bollette,utenza'),
  ('polizza', 'assicurazione,assicurativa,rca,premio'),
  ('assicurazione', 'polizza,assicurativa,rca,premio'),
  ('macchina', 'auto,veicolo,autovettura,automobile'),
  ('auto', 'veicolo,autovettura,automobile,macchina'),
  ('tasse', 'f24,imu,irpef,tributi,imposte,agenzia delle entrate'),
  ('tassa', 'f24,imu,irpef,tributo,imposta'),
  ('stipendio', 'busta paga,cedolino,retribuzione'),
  ('banca', 'conto,estratto conto,bonifico'),
  ('medico', 'visita,referto,esame,ricetta'),
  ('esami', 'referto,analisi,laboratorio'),
  ('casa', 'immobile,abitazione,appartamento,condominio'),
  ('affitto', 'locazione,canone'),
  ('multa', 'sanzione,verbale,contravvenzione'),
  ('documento identita', 'carta identita,carta d identita,cie,passaporto,patente'),
  ('identita', 'carta identita,cie,passaporto,documento'),
  ('telefono', 'telefonia,cellulare,tim,vodafone,windtre,iliad,fastweb'),
  ('internet', 'fibra,adsl,tim,vodafone,windtre,iliad,fastweb'),
  ('riscaldamento', 'pellet,legna,gasolio,gpl,caldaia,stufa'),
  ('scuola', 'iscrizione,mensa,pagella,istituto'),
  ('pensione', 'previdenza,inps,enpam,contributi')
on conflict do nothing;

-- Ricerca. p_filtri (jsonb, tutti facoltativi):
--   fascicoli text[], persona, ente, tipo, da date, a date, importo_min, importo_max, poco_utili bool.
-- Ogni parola deve trovare riscontro (in sé o in un suo sinonimo); il punteggio premia titolo ed ente.
create or replace function cerca_archivio_v2(p_testo text default '', p_filtri jsonb default '{}'::jsonb, p_lim integer default 200)
returns setof documenti
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with f as (
    select
      case when jsonb_typeof(p_filtri->'fascicoli') = 'array'
           then array(select jsonb_array_elements_text(p_filtri->'fascicoli')) end as fascicoli,
      nullif(p_filtri->>'persona', '') as persona,
      nullif(p_filtri->>'ente', '') as ente,
      nullif(p_filtri->>'tipo', '') as tipo,
      nullif(p_filtri->>'da', '')::date as da,
      nullif(p_filtri->>'a', '')::date as a,
      nullif(p_filtri->>'importo_min', '')::numeric as imin,
      nullif(p_filtri->>'importo_max', '')::numeric as imax,
      coalesce((p_filtri->>'poco_utili')::boolean, false) as poco
  ),
  parole as (
    select w from (
      select distinct w from unnest(regexp_split_to_array(lower(unaccent(coalesce(p_testo, ''))), '[^a-z0-9]+')) as w
      where length(w) > 1
    ) x limit 8
  ),
  alternative as (
    select p.w, p.w as alt, 1.0::real as peso from parole p
    union
    select p.w, trim(lower(unaccent(e))), 0.9::real
    from parole p
    join sinonimi_ricerca s on lower(unaccent(s.parola)) = p.w
    cross join lateral unnest(string_to_array(s.equivale, ',')) as e
    where length(trim(e)) > 1
  ),
  cand as (
    select d.id,
           coalesce(d.data_documento, d.email_data::date) as quando,
           d.ricerca,
           lower(unaccent(concat_ws(' ', d.titolo, d.ente))) as t1,
           lower(unaccent(concat_ws(' ', d.titolo, d.ente, d.riassunto, d.tipo_documento, d.email_mittente,
                 d.email_oggetto, d.nome_file_originale, d.persona, d.categoria, d.fascicolo,
                 array_to_string(d.tag, ' '), d.azione_descrizione))) as hay
    from documenti d, f
    where (f.fascicoli is null or d.fascicolo = any(f.fascicoli))
      and (f.persona is null or d.persona ilike f.persona)
      and (f.ente is null or d.ente = f.ente)
      and (f.tipo is null or d.tipo_documento = f.tipo)
      and (f.da is null or coalesce(d.data_documento, d.email_data::date) >= f.da)
      and (f.a is null or coalesce(d.data_documento, d.email_data::date) <= f.a)
      and (f.imin is null or d.importo >= f.imin)
      and (f.imax is null or d.importo <= f.imax)
      and (f.poco or f.fascicoli is not null or f.ente is not null or d.rilevanza is null or d.rilevanza <> 'bassa')
  ),
  punti as (
    select c.id, a.w, max(a.peso * greatest(
             case when c.t1 like '%' || a.alt || '%' then 3 else 0 end,
             case when c.ricerca @@ plainto_tsquery('italian', a.alt) then 2 else 0 end,
             case when c.hay like '%' || a.alt || '%' then 1.5 else 0 end,
             case when length(a.alt) >= 4 and word_similarity(a.alt, c.hay) >= 0.6 then word_similarity(a.alt, c.hay) else 0 end
           )) as s
    from cand c cross join alternative a
    group by c.id, a.w
  ),
  totale as (
    select id, sum(s) as punteggio, count(*) filter (where s > 0) as trovate
    from punti group by id
  ),
  scelti as (
    select c.id, c.quando, coalesce(t.punteggio, 0) as punteggio
    from cand c left join totale t on t.id = c.id
    where (select count(*) from parole) = 0 or t.trovate = (select count(*) from parole)
  )
  select d.* from scelti s join documenti d on d.id = s.id
  order by s.punteggio desc, s.quando desc nulls last
  limit least(greatest(coalesce(p_lim, 200), 1), 500);
$$;

revoke all on function cerca_archivio_v2(text, jsonb, integer) from public, anon;
grant execute on function cerca_archivio_v2(text, jsonb, integer) to authenticated;
