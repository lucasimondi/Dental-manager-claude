-- POL-VITA-035, terza parte: soglia relativa per la ricerca per significato.
-- Con i primi vettori reali di Gemini (2026-11-16) le distanze tra documenti stanno tutte sotto 0,32
-- (stesso ente ~0,02, mediana ~0,26): la soglia fissa 0,6 lasciava passare tutto. Ora si tengono
-- solo i documenti vicini quasi quanto il migliore (margine 0,12: con i dati reali i documenti dello stesso ente stanno entro 0,105 dal primo, gli scollegati da 0,187 in su), sempre entro p_distanza.
-- Stessa firma: solo create or replace.

-- Carica il modulo pgvector in questa sessione: senza, «set hnsw.ef_search» nella definizione
-- viene rifiutato (permission denied to set parameter).
do $$ begin perform '[1,0]'::extensions.vector(2) <=> '[0,1]'::extensions.vector(2); end $$;

create or replace function cerca_significato(p_vettore text, p_filtri jsonb default '{}'::jsonb,
                                             p_lim integer default 30, p_distanza real default 0.6)
returns setof documenti
language plpgsql
stable
security invoker
set search_path = public, extensions
set hnsw.ef_search = 200          -- di base l'indice ne restituisce al massimo 40
as $$
declare
  v extensions.vector(768) := p_vettore::extensions.vector(768);
  v_fasc text[] := case when jsonb_typeof(p_filtri->'fascicoli') = 'array'
                        then array(select jsonb_array_elements_text(p_filtri->'fascicoli')) end;
  v_da date := nullif(p_filtri->>'da', '')::date;
  v_a date := nullif(p_filtri->>'a', '')::date;
begin
  return query
  with c as (
    select x.documento_id, x.vettore <=> v as distanza
    from documenti_vettori x
    where x.vettore is not null
    order by x.vettore <=> v
    limit 200
  ),
  ammessi as (
    select c.documento_id, c.distanza
    from c
    join documenti d on d.id = c.documento_id
    where d.fascicolo <> 'clinico_pazienti'
      and (v_fasc is null or d.fascicolo = any(v_fasc))
      and (v_da is null or coalesce(d.data_documento, d.email_data::date) >= v_da)
      and (v_a is null or coalesce(d.data_documento, d.email_data::date) <= v_a)
  ),
  migliore as (select min(distanza) as m from ammessi)
  select d.* from ammessi a
  join documenti d on d.id = a.documento_id, migliore
  where a.distanza <= least(p_distanza, migliore.m + 0.12)
  order by a.distanza
  limit least(greatest(coalesce(p_lim, 30), 1), 100);
end $$;
revoke all on function cerca_significato(text, jsonb, integer, real) from public, anon;
grant execute on function cerca_significato(text, jsonb, integer, real) to authenticated, service_role;
