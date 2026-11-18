-- VETTORI-CODA-VELOCE (PO 2026-11-18: "Sì fai il punto 1"). documenti_senza_vettore impiegava ~5,6 s
-- (testo completo di ~7.000 documenti passato come riga intera e ordinato su disco) e a volte superava
-- il tempo massimo (57014, 4 volte il 18/11). Stessa firma, stessi risultati, stesso ordine:
--  1) i documenti mai calcolati: si scelgono solo gli id (anti-join, ordinati per data), la scheda si
--     costruisce soltanto per quelli scelti;
--  2) se ne mancano, quelli con la scheda o il testo cambiati: non si ricalcola più l'impronta di tutti
--     (3,2 s oggi, ~8 s a coda finita) ma solo dei vettori segnati «da_rifare», che un trigger accende
--     quando cambiano i campi della scheda o il testo e che si spegne da solo quando lo script salva il
--     vettore nuovo. L'impronta resta il controllo finale.
-- Solo aggiunte (una colonna, un indice parziale, tre trigger) e la funzione riscritta; mai i clinici;
-- grant invariati (coda solo per service_role).

alter table documenti_vettori add column if not exists da_rifare boolean not null default false;
create index if not exists documenti_vettori_da_rifare on documenti_vettori (documento_id) where da_rifare;

-- Scheda o testo cambiati → il vettore va rifatto. security definer: le modifiche arrivano anche
-- dall'app (authenticated), che su documenti_vettori non può scrivere.
create or replace function documenti_vettori_segna_da_rifare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update documenti_vettori set da_rifare = true where documento_id = new.id and not da_rifare;
  return null;
end $$;
revoke all on function documenti_vettori_segna_da_rifare() from public, anon, authenticated;
create or replace function documenti_testo_segna_vettore_da_rifare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update documenti_vettori set da_rifare = true where documento_id = new.documento_id and not da_rifare;
  return null;
end $$;
revoke all on function documenti_testo_segna_vettore_da_rifare() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'documenti_vettore_da_rifare_trg' and tgrelid = 'public.documenti'::regclass) then
    create trigger documenti_vettore_da_rifare_trg
      after update of titolo, ente, tipo_documento, riassunto, azione_descrizione, tag, persona, email_oggetto, nome_file_originale
      on documenti for each row
      when (row(old.titolo, old.ente, old.tipo_documento, old.riassunto, old.azione_descrizione, old.tag, old.persona, old.email_oggetto, old.nome_file_originale)
            is distinct from
            row(new.titolo, new.ente, new.tipo_documento, new.riassunto, new.azione_descrizione, new.tag, new.persona, new.email_oggetto, new.nome_file_originale))
      execute function documenti_vettori_segna_da_rifare();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'documenti_testo_vettore_da_rifare_trg' and tgrelid = 'public.documenti_testo'::regclass) then
    create trigger documenti_testo_vettore_da_rifare_trg
      after update of testo on documenti_testo for each row
      when (old.testo is distinct from new.testo)
      execute function documenti_testo_segna_vettore_da_rifare();
  end if;
end $$;

-- Vettore salvato di nuovo dallo script (impronta o data cambiate) → non è più da rifare.
create or replace function documenti_vettori_rifatto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.impronta is distinct from old.impronta or new.aggiornato_il is distinct from old.aggiornato_il then
    new.da_rifare := false;
  end if;
  return new;
end $$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'documenti_vettori_rifatto_trg' and tgrelid = 'public.documenti_vettori'::regclass) then
    create trigger documenti_vettori_rifatto_trg before insert or update on documenti_vettori
      for each row execute function documenti_vettori_rifatto();
  end if;
end $$;

-- I vettori già oggi diversi dalla scheda attuale (impronta che non torna) partono segnati.
update documenti_vettori v set da_rifare = true
from documenti d, documenti_testo t
where d.id = v.documento_id and t.documento_id = v.documento_id and not v.da_rifare
  and v.impronta is distinct from md5(testo_per_vettore(d, t));

create or replace function documenti_senza_vettore(p_lim integer default 50)
returns table (id uuid, testo text, impronta text)
language plpgsql
stable
set search_path = public
as $$
declare
  v_lim integer := least(greatest(coalesce(p_lim, 50), 1), 100);
  v_n integer;
begin
  return query
  select d.id, x.testo, md5(x.testo)
  from (
    select d0.id
    from documenti d0
    join documenti_testo t0 on t0.documento_id = d0.id
    where d0.fascicolo <> 'clinico_pazienti'
      and t0.stato <> 'escluso'
      and not exists (select 1 from documenti_vettori v where v.documento_id = d0.id)
    order by coalesce(d0.data_documento, d0.email_data::date) desc nulls last
    limit v_lim
  ) s
  join documenti d on d.id = s.id
  join documenti_testo t on t.documento_id = d.id
  cross join lateral (select testo_per_vettore(d, t) as testo) x
  order by coalesce(d.data_documento, d.email_data::date) desc nulls last;
  get diagnostics v_n = row_count;
  if v_n >= v_lim then
    return;
  end if;

  return query
  select d.id, x.testo, md5(x.testo)
  from documenti_vettori v
  join documenti d on d.id = v.documento_id
  join documenti_testo t on t.documento_id = d.id
  cross join lateral (select testo_per_vettore(d, t) as testo) x
  where v.da_rifare
    and d.fascicolo <> 'clinico_pazienti'
    and t.stato <> 'escluso'
    and v.impronta is distinct from md5(x.testo)
  order by coalesce(d.data_documento, d.email_data::date) desc nulls last
  limit v_lim - v_n;
end $$;
revoke all on function documenti_senza_vettore(integer) from public, anon, authenticated;
grant execute on function documenti_senza_vettore(integer) to service_role;
