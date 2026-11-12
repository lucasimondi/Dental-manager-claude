-- POL-VITA-030 ARCHIVIO-CHIEDI, terza parte: la funzione usa davvero gli indici.
-- In SQL puro le alternative arrivavano a runtime e il planner scandiva tutta la tabella
-- (oltre 60 s). Ora: per ogni parola UNA query con i valori già scritti dentro
-- (tsquery in OR, regex con le alternative, somiglianza solo sulla parola scritta),
-- poi l'intersezione, poi i punti solo sui documenti trovati. Solo create or replace.

create or replace function cerca_archivio_v2(p_testo text default '', p_filtri jsonb default '{}'::jsonb, p_lim integer default 200)
returns setof documenti
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_parole text[];
  v_w text;
  v_rx text;
  v_tsq text;
  v_alt_w jsonb;
  v_alts jsonb := '[]'::jsonb;
  v_ids uuid[];
  v_cand uuid[];
  v_sql text;
begin
  select array(
    select w from (
      select distinct w from unnest(regexp_split_to_array(lower(unaccent(coalesce(p_testo, ''))), '[^a-z0-9]+')) as w
      where length(w) > 1
    ) x limit 8
  ) into v_parole;

  foreach v_w in array v_parole loop
    -- La parola e i suoi sinonimi (ripuliti: solo lettere, cifre e spazi).
    with alt as (
      select x.alt, max(x.peso) as peso from (
        select v_w as alt, 1.0::real as peso
        union all
        select trim(regexp_replace(lower(unaccent(e)), '[^a-z0-9 ]+', ' ', 'g')), 0.9::real
        from sinonimi_ricerca s
        cross join lateral unnest(string_to_array(s.equivale, ',')) as e
        where trim(regexp_replace(lower(unaccent(s.parola)), '[^a-z0-9 ]+', ' ', 'g')) = v_w
      ) x where length(x.alt) > 1 group by x.alt
    )
    select
      jsonb_agg(jsonb_build_object('w', v_w, 'alt', alt, 'peso', peso)),
      '(' || string_agg(case when length(alt) <= 3 then '\m' || alt || '\M' else alt end, '|') || ')',
      string_agg(nullif(plainto_tsquery('italian', alt)::text, ''), ' | ')
    into v_alt_w, v_rx, v_tsq
    from alt;

    v_alts := v_alts || coalesce(v_alt_w, '[]'::jsonb);

    -- Una sola query per parola, con i valori come letterali: il planner usa gli indici.
    v_sql := format('select array_agg(id) from documenti where testo_ricerca ~ %L', v_rx);
    if v_tsq is not null then
      v_sql := v_sql || format(' or ricerca @@ %L::tsquery', v_tsq);
    end if;
    if length(v_w) >= 4 then
      v_sql := v_sql || format(' or %L <%% testo_ricerca', v_w);
    end if;
    execute v_sql into v_ids;

    v_cand := case when v_cand is null then coalesce(v_ids, '{}')
                   else array(select unnest(v_cand) intersect select unnest(coalesce(v_ids, '{}'))) end;
    exit when cardinality(v_cand) = 0;
  end loop;

  return query
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
  alternative as (
    select x.w, x.alt, x.peso,
           case when length(x.alt) <= 3 then '\m' || x.alt || '\M' else x.alt end as rx,
           plainto_tsquery('italian', x.alt) as tsq
    from jsonb_to_recordset(v_alts) as x(w text, alt text, peso real)
  ),
  scelti as (
    select d.id, coalesce(d.data_documento, d.email_data::date) as quando
    from documenti d, f
    where (v_cand is null or d.id = any(v_cand))
      and (f.fascicoli is null or d.fascicolo = any(f.fascicoli))
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
    select s.id, a.w, max(a.peso * greatest(
             case when lower(unaccent(concat_ws(' ', d.titolo, d.ente))) ~ a.rx then 3 else 0 end,
             case when d.ricerca @@ a.tsq then 2 else 0 end,
             case when d.testo_ricerca ~ a.rx then 1.5 else 0 end,
             case when a.alt = a.w and length(a.alt) >= 4 then word_similarity(a.alt, d.testo_ricerca) else 0 end
           )) as s
    from scelti s
    join documenti d on d.id = s.id
    cross join alternative a
    where v_cand is not null
    group by s.id, a.w
  ),
  totale as (
    select id, sum(s) as punteggio from punti group by id
  )
  select d.* from scelti s
  join documenti d on d.id = s.id
  left join totale t on t.id = s.id
  order by coalesce(t.punteggio, 0) desc, s.quando desc nulls last
  limit least(greatest(coalesce(p_lim, 200), 1), 500);
end $$;

revoke all on function cerca_archivio_v2(text, jsonb, integer) from public, anon;
grant execute on function cerca_archivio_v2(text, jsonb, integer) to authenticated;
