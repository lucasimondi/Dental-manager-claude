-- POL-VITA-035, seconda parte: niente vettore per i documenti il cui testo lo script ha escluso
-- (riconosciuti come clinici dalle regole di eClinico_ anche se il fascicolo non è ancora clinico).
-- Solo create or replace; un eventuale vettore già scritto per questi documenti viene svuotato.

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
      and t.stato <> 'escluso'
  ) x
  where x.vecchia is null or x.vecchia <> md5(x.testo)
  order by (x.vecchia is null) desc, x.quando desc nulls last
  limit least(greatest(coalesce(p_lim, 50), 1), 100);
$$;
revoke all on function documenti_senza_vettore(integer) from public, anon, authenticated;
grant execute on function documenti_senza_vettore(integer) to service_role;

update documenti_vettori v set vettore = null, aggiornato_il = now()
from documenti_testo t
where t.documento_id = v.documento_id and t.stato = 'escluso' and v.vettore is not null;
