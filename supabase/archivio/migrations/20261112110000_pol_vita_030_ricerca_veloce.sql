-- POL-VITA-030 ARCHIVIO-CHIEDI, seconda parte: ricerca veloce.
-- La prima versione impiegava ~7 s (testo ricalcolato e confronto approssimato su ogni riga).
-- Solo aggiunte: colonna testo_ricerca (testo normalizzato, mantenuto da un trigger), indice
-- trigrammi, e cerca_archivio_v2 riscritta per cercare prima con gli indici e poi dare i punti.

alter table documenti add column if not exists testo_ricerca text;

create or replace function documenti_testo_ricerca_aggiorna()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.testo_ricerca := lower(unaccent(concat_ws(' ', new.titolo, new.ente, new.riassunto, new.tipo_documento,
    new.email_mittente, new.email_oggetto, new.nome_file_originale, new.persona, new.categoria, new.fascicolo,
    array_to_string(new.tag, ' '), new.azione_descrizione)));
  return new;
end $$;

drop trigger if exists documenti_testo_ricerca_trg on documenti;
create trigger documenti_testo_ricerca_trg
  before insert or update of titolo, ente, riassunto, tipo_documento, email_mittente, email_oggetto,
    nome_file_originale, persona, categoria, fascicolo, tag, azione_descrizione
  on documenti for each row execute function documenti_testo_ricerca_aggiorna();

-- Riempie solo le righe ancora vuote (rieseguibile).
update documenti set testo_ricerca = lower(unaccent(concat_ws(' ', titolo, ente, riassunto, tipo_documento,
    email_mittente, email_oggetto, nome_file_originale, persona, categoria, fascicolo,
    array_to_string(tag, ' '), azione_descrizione)))
where testo_ricerca is null;

create index if not exists documenti_testo_ricerca_trgm on documenti using gin (testo_ricerca gin_trgm_ops);

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
  alt0 as (
    select p.w, p.w as alt, 1.0::real as peso from parole p
    union
    select p.w, trim(regexp_replace(lower(unaccent(e)), '[^a-z0-9 ]+', ' ', 'g')), 0.9::real
    from parole p
    join sinonimi_ricerca s on trim(regexp_replace(lower(unaccent(s.parola)), '[^a-z0-9 ]+', ' ', 'g')) = p.w
    cross join lateral unnest(string_to_array(s.equivale, ',')) as e
  ),
  alternative as (
    select w, alt, max(peso) as peso, plainto_tsquery('italian', alt) as tsq,
           case when length(alt) <= 3 then '\m' || alt || '\M' else alt end as rx
    from alt0 where length(alt) > 1 group by w, alt
  ),
  trovati as (
    select a.w, d.id from alternative a join documenti d on d.ricerca @@ a.tsq
    union
    select a.w, d.id from alternative a join documenti d on d.testo_ricerca ~ a.rx
    union
    select a.w, d.id from alternative a join documenti d on a.alt <% d.testo_ricerca where length(a.alt) >= 4
  ),
  punti as (
    select t.id, t.w, max(a.peso * greatest(
             case when lower(unaccent(concat_ws(' ', d.titolo, d.ente))) ~ a.rx then 3 else 0 end,
             case when d.ricerca @@ a.tsq then 2 else 0 end,
             case when d.testo_ricerca ~ a.rx then 1.5 else 0 end,
             case when length(a.alt) >= 4 then word_similarity(a.alt, d.testo_ricerca) else 0 end
           )) as s
    from trovati t
    join alternative a on a.w = t.w
    join documenti d on d.id = t.id
    group by t.id, t.w
  ),
  totale as (
    select id, sum(s) as punteggio from punti where s > 0 group by id
    having count(*) = (select count(*) from parole)
  ),
  base as (
    select d.id, coalesce(t.punteggio, 0) as punteggio, coalesce(d.data_documento, d.email_data::date) as quando
    from documenti d
    left join totale t on t.id = d.id
    where ((select count(*) from parole) = 0 or t.id is not null)
  )
  select d.* from base b join documenti d on d.id = b.id, f
  where (f.fascicoli is null or d.fascicolo = any(f.fascicoli))
    and (f.persona is null or d.persona ilike f.persona)
    and (f.ente is null or d.ente = f.ente)
    and (f.tipo is null or d.tipo_documento = f.tipo)
    and (f.da is null or b.quando >= f.da)
    and (f.a is null or b.quando <= f.a)
    and (f.imin is null or d.importo >= f.imin)
    and (f.imax is null or d.importo <= f.imax)
    and (f.poco or f.fascicoli is not null or f.ente is not null or d.rilevanza is null or d.rilevanza <> 'bassa')
  order by b.punteggio desc, b.quando desc nulls last
  limit least(greatest(coalesce(p_lim, 200), 1), 500);
$$;

revoke all on function cerca_archivio_v2(text, jsonb, integer) from public, anon;
grant execute on function cerca_archivio_v2(text, jsonb, integer) to authenticated;
