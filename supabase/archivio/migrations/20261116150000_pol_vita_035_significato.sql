-- POL-VITA-035 RICERCA PER SIGNIFICATO (PO 2026-11-16: "Facciamo ricerca per significato anche, e poi mergia").
-- Ogni documento ha un vettore (embedding Gemini, 768 numeri) calcolato dallo script da scheda e
-- inizio del testo completo; la ricerca confronta il vettore della domanda con quelli dei documenti.
-- Solo aggiunte: estensione pgvector, tabella documenti_vettori (scrittura solo con la chiave di
-- servizio, lettura del proprietario), coda per lo script, RPC cerca_significato.
-- I documenti clinici dei pazienti non hanno mai un vettore: la tabella lo rifiuta e lo toglie.

create extension if not exists vector with schema extensions;

create table if not exists documenti_vettori (
  documento_id  uuid primary key references documenti(id) on delete cascade,
  vettore       extensions.vector(768),
  modello       text not null,
  impronta      text not null,   -- md5 del testo usato: se la scheda cambia, il vettore si ricalcola
  aggiornato_il timestamptz not null default now()
);
create index if not exists documenti_vettori_hnsw on documenti_vettori
  using hnsw (vettore extensions.vector_cosine_ops);

alter table documenti_vettori enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documenti_vettori' and policyname = 'proprietario_legge') then
    create policy proprietario_legge on documenti_vettori for select to authenticated using ((select e_proprietario()));
  end if;
end $$;
revoke all on documenti_vettori from anon;
revoke insert, update, delete, truncate, references, trigger on documenti_vettori from authenticated;
grant select on documenti_vettori to authenticated;

-- Mai un vettore per un documento clinico, anche se lo script sbagliasse (riga non scritta).
-- Svuotare il vettore (vettore null) resta sempre possibile.
create or replace function documenti_vettori_controlla()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vettore is not null and exists (select 1 from documenti d where d.id = new.documento_id and d.fascicolo = 'clinico_pazienti') then
    return null;
  end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'documenti_vettori_controlla_trg' and tgrelid = 'public.documenti_vettori'::regclass) then
    create trigger documenti_vettori_controlla_trg before insert or update on documenti_vettori
      for each row execute function documenti_vettori_controlla();
  end if;
end $$;

-- Un documento che diventa clinico perde testo (POL-VITA-034) e vettore.
create or replace function documenti_clinico_senza_testo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update documenti_testo set stato = 'escluso', testo = null, fonte = null, aggiornato_il = now()
  where documento_id = new.id and (testo is not null or stato <> 'escluso');
  update documenti_vettori set vettore = null, aggiornato_il = now()
  where documento_id = new.id and vettore is not null;
  return new;
end $$;

-- Testo da cui si calcola il vettore: scheda + inizio del testo completo (mai dei clinici).
create or replace function testo_per_vettore(d documenti, t documenti_testo)
returns text
language sql
immutable
set search_path = public
as $$
  select left(concat_ws(E'\n',
    d.titolo, d.ente, d.tipo_documento, d.riassunto, d.azione_descrizione,
    array_to_string(d.tag, ', '), d.persona, d.email_oggetto, d.nome_file_originale,
    left(t.testo, 2000)), 4000);
$$;

-- Coda per lo script: documenti non clinici il cui testo completo è già stato letto (così il
-- vettore si calcola una volta sola) e senza vettore o con la scheda cambiata. Prima i recenti.
create or replace function documenti_senza_vettore(p_lim integer default 50)
returns table (id uuid, testo text, impronta text)
language sql
stable
security invoker
set search_path = public
as $$
  select x.id, x.testo, md5(x.testo) from (
    select d.id, testo_per_vettore(d, t) as testo, v.impronta as vecchia,
           coalesce(d.data_documento, d.email_data::date) as quando
    from documenti d
    join documenti_testo t on t.documento_id = d.id
    left join documenti_vettori v on v.documento_id = d.id
    where d.fascicolo <> 'clinico_pazienti'
  ) x
  where x.vecchia is null or x.vecchia <> md5(x.testo)
  order by (x.vecchia is null) desc, x.quando desc nulls last
  limit least(greatest(coalesce(p_lim, 50), 1), 100);
$$;
revoke all on function documenti_senza_vettore(integer) from public, anon, authenticated;
grant execute on function documenti_senza_vettore(integer) to service_role;

-- Ricerca per significato: i documenti più vicini al vettore della domanda (testo '[0.1,…]'),
-- con gli stessi filtri di cerca_archivio_v2 (fascicoli, da, a), mai i clinici.
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
  select d.* from (
    select x.documento_id, x.vettore <=> v as distanza
    from documenti_vettori x
    where x.vettore is not null
    order by x.vettore <=> v
    limit 200
  ) c
  join documenti d on d.id = c.documento_id
  where c.distanza <= p_distanza
    and d.fascicolo <> 'clinico_pazienti'
    and (v_fasc is null or d.fascicolo = any(v_fasc))
    and (v_da is null or coalesce(d.data_documento, d.email_data::date) >= v_da)
    and (v_a is null or coalesce(d.data_documento, d.email_data::date) <= v_a)
  order by c.distanza
  limit least(greatest(coalesce(p_lim, 30), 1), 100);
end $$;
revoke all on function cerca_significato(text, jsonb, integer, real) from public, anon;
grant execute on function cerca_significato(text, jsonb, integer, real) to authenticated, service_role;

-- Avanzamento dei vettori (documenti non clinici).
create or replace view v_significato_avanzamento with (security_invoker = true) as
select case when v.vettore is not null then 'calcolato' else 'in_coda' end as stato, count(*)::int as n
from documenti d
left join documenti_vettori v on v.documento_id = d.id
where d.fascicolo <> 'clinico_pazienti'
group by 1;
revoke all on v_significato_avanzamento from anon;
grant select on v_significato_avanzamento to authenticated;
