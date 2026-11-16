-- POL-VITA-034 TESTO-COMPLETO (PO 2026-11-16: "Sì, parti dal primo e poi fai il secondo").
-- Ricerca nel testo intero dei file, non solo nella scheda (titolo, riassunto, tag…).
-- Solo aggiunte: tabella documenti_testo (una riga per documento, scritta dallo script con la
-- chiave di servizio, letta solo dal proprietario), indice tsvector, coda per lo script, e
-- cerca_archivio_v2 che cerca anche nel testo. I documenti clinici dei pazienti non hanno mai
-- testo salvato: la tabella lo rifiuta e lo toglie se un documento diventa clinico.

create table if not exists documenti_testo (
  documento_id  uuid primary key references documenti(id) on delete cascade,
  stato         text not null check (stato in ('letto', 'vuoto', 'non_leggibile', 'errore', 'escluso')),
  fonte         text,          -- pdf, immagine, word, foglio, google_doc, testo, xml, email
  testo         text,
  ricerca       tsvector,
  errore        text,
  tentativi     integer not null default 1,
  aggiornato_il timestamptz not null default now()
);
create index if not exists documenti_testo_ricerca_idx on documenti_testo using gin (ricerca);
create index if not exists documenti_testo_errori_idx on documenti_testo (aggiornato_il) where stato = 'errore';

alter table documenti_testo enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documenti_testo' and policyname = 'proprietario_legge') then
    create policy proprietario_legge on documenti_testo for select to authenticated using ((select e_proprietario()));
  end if;
end $$;
revoke all on documenti_testo from anon;
revoke insert, update, delete, truncate, references, trigger on documenti_testo from authenticated;
grant select on documenti_testo to authenticated;

-- Testo normalizzato (minuscolo, senza accenti) come le parole cercate da cerca_archivio_v2.
-- Mai testo per i clinici, anche se lo script sbagliasse.
create or replace function documenti_testo_prepara()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if exists (select 1 from documenti d where d.id = new.documento_id and d.fascicolo = 'clinico_pazienti') then
    new.stato := 'escluso';
    new.testo := null;
    new.fonte := null;
  end if;
  new.testo := nullif(left(new.testo, 100000), '');
  new.ricerca := case when new.testo is null then null
                      else to_tsvector('italian', lower(unaccent(new.testo))) end;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'documenti_testo_prepara_trg' and tgrelid = 'public.documenti_testo'::regclass) then
    create trigger documenti_testo_prepara_trg before insert or update on documenti_testo
      for each row execute function documenti_testo_prepara();
  end if;
end $$;

-- Un documento che diventa clinico perde il testo salvato.
create or replace function documenti_clinico_senza_testo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update documenti_testo set stato = 'escluso', testo = null, fonte = null, aggiornato_il = now()
  where documento_id = new.id and (testo is not null or stato <> 'escluso');
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'documenti_clinico_senza_testo_trg' and tgrelid = 'public.documenti'::regclass) then
    create trigger documenti_clinico_senza_testo_trg after insert or update of fascicolo on documenti
      for each row when (new.fascicolo = 'clinico_pazienti')
      execute function documenti_clinico_senza_testo();
  end if;
end $$;

-- Coda per lo script: documenti con file su Drive ancora senza testo, poi gli errori da riprovare
-- (al massimo 3 tentativi, uno al giorno). Prima i più recenti.
create or replace function documenti_senza_testo(p_lim integer default 25)
returns table (id uuid, drive_file_id text, mime_type text, nome_file_originale text, dimensione_byte bigint,
               fascicolo text, gmail_message_id text, email_oggetto text, email_mittente text, tentativi integer)
language sql
stable
security invoker
set search_path = public
as $$
  select d.id, d.drive_file_id, d.mime_type, d.nome_file_originale, d.dimensione_byte::bigint,
         d.fascicolo, d.gmail_message_id, d.email_oggetto, d.email_mittente, coalesce(t.tentativi, 0)
  from documenti d
  left join documenti_testo t on t.documento_id = d.id
  where d.drive_file_id is not null
    and (t.documento_id is null
         or (t.stato = 'errore' and t.tentativi < 3 and t.aggiornato_il < now() - interval '1 day'))
  order by (t.documento_id is null) desc, coalesce(d.data_documento, d.email_data::date) desc nulls last
  limit least(greatest(coalesce(p_lim, 25), 1), 200);
$$;
revoke all on function documenti_senza_testo(integer) from public, anon, authenticated;
grant execute on function documenti_senza_testo(integer) to service_role;

-- Avanzamento (per l'app e per i controlli): quanti documenti per stato.
create or replace view v_testo_avanzamento with (security_invoker = true) as
select coalesce(t.stato, 'in_coda') as stato, count(*)::int as n
from documenti d
left join documenti_testo t on t.documento_id = d.id
where d.drive_file_id is not null
group by 1;
revoke all on v_testo_avanzamento from anon;
grant select on v_testo_avanzamento to authenticated;

-- cerca_archivio_v2: come POL-VITA-030 (terza parte), più il testo completo.
-- Per ogni parola: la query di prima sulla scheda, UNION gli id trovati nel testo (indice GIN,
-- mai dei clinici); nei punti il testo vale 1 (meno della scheda: titolo 3, tsvector 2, testo scheda 1.5).
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
  v_ids_testo uuid[];
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

    v_sql := format('select array_agg(id) from documenti where testo_ricerca ~ %L', v_rx);
    if v_tsq is not null then
      v_sql := v_sql || format(' or ricerca @@ %L::tsquery', v_tsq);
    end if;
    if length(v_w) >= 4 then
      v_sql := v_sql || format(' or %L <%% testo_ricerca', v_w);
    end if;
    execute v_sql into v_ids;

    -- Testo completo dei file (query a parte: usa il suo indice).
    v_ids_testo := null;
    if v_tsq is not null then
      execute format('select array_agg(t.documento_id) from documenti_testo t join documenti d on d.id = t.documento_id
                      where t.ricerca @@ %L::tsquery and d.fascicolo <> %L', v_tsq, 'clinico_pazienti')
        into v_ids_testo;
    end if;
    v_ids := array(select unnest(coalesce(v_ids, '{}')) union select unnest(coalesce(v_ids_testo, '{}')));

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
             case when a.alt = a.w and length(a.alt) >= 4 then word_similarity(a.alt, d.testo_ricerca) else 0 end,
             case when t.ricerca @@ a.tsq and d.fascicolo <> 'clinico_pazienti' then 1 else 0 end
           )) as s
    from scelti s
    join documenti d on d.id = s.id
    left join documenti_testo t on t.documento_id = s.id
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
