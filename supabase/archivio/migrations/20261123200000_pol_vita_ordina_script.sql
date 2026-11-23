-- POL-VITA-ORDINA fase 3b — lo script Apps Script finisce da solo gli spostamenti approvati.
-- Migrazione SOLO additiva e idempotente: riordino_registra resta com'è; qui solo funzioni e una vista nuove.
-- Regole (Luca 2026-11-23): solo righe 'approvato', mai '99 %', mai fascicolo clinico_pazienti; niente copie,
-- niente cancellazioni su Drive. Le funzioni le chiama solo lo script con la chiave di servizio.

-- Ricerca per file nel registro (errori di fila, righe in corso).
create index if not exists log_spostamenti_file on log_spostamenti(file_id);

-- Errori di fila di un file: quelli dopo l'ultimo spostamento riuscito o annullato.
create or replace function riordino_errori_di_fila(p_file_id text)
returns integer language sql stable set search_path = public as $$
  select count(*)::int from log_spostamenti e
  where e.file_id = p_file_id and e.esito = 'errore'
    and e.eseguito_il > coalesce((select max(greatest(x.eseguito_il, coalesce(x.annullato_il, x.eseguito_il)))
                                  from log_spostamenti x where x.file_id = p_file_id and x.esito in ('eseguito', 'annullato')), '-infinity');
$$;

-- File da spostare al prossimo giro: stessi join e filtri di riordino_registra, ordinati per file_id.
-- Esclusi anche: file con 3 errori di fila (finiscono in v_riordino_errori_ripetuti) e file con una riga
-- 'in_corso' recente nel registro (qualcun altro li sta spostando in questo momento).
create or replace function riordino_prossimi(p_limite int)
returns table (file_id text, documento_id uuid, drive_cartella_id text, nome_nuovo text, percorso_nuovo text, scorciatoie jsonb)
language sql stable set search_path = public as $$
  select p.file_id, p.documento_id, m.drive_cartella_id, p.nome_nuovo, p.percorso_nuovo,
         coalesce((select jsonb_agg(jsonb_build_object('percorso', s.percorso, 'cartella_id', sm.id, 'drive_cartella_id', sm.drive_cartella_id) order by s.ord)
                   from unnest(p.scorciatoie) with ordinality as s(percorso, ord)
                   left join categorie sc on sc.percorso = s.percorso
                   left join cartelle_mie sm on sm.categoria_id = sc.id and sm.archiviata_il is null), '[]'::jsonb)
  from piano_riordino p
  join categorie c on c.percorso = p.percorso_nuovo
  join cartelle_mie m on m.categoria_id = c.id and m.archiviata_il is null
  left join documenti d on d.id = p.documento_id
  where p.stato = 'approvato'
    and p.percorso_nuovo not like '99 %'
    and d.fascicolo is distinct from 'clinico_pazienti'
    and m.drive_cartella_id is not null
    and riordino_errori_di_fila(p.file_id) < 3
    and not exists (select 1 from log_spostamenti l where l.file_id = p.file_id and l.esito = 'in_corso'
                    and l.eseguito_il > now() - interval '15 minutes')
  order by p.file_id
  limit greatest(coalesce(p_limite, 0), 0);
$$;

-- Come riordino_registra, ma cartella e nome di prima arrivano dalla riga: il valore REALE letto su Drive
-- un attimo prima dello spostamento (per un «Annulla lotto» preciso). Ogni riga:
-- {file_id, da_padre_id, da_nome, scorciatoie?: [{id, cartella_id}]}. Restituisce quanti file ha registrato.
create or replace function riordino_registra_v2(p_lotto uuid, p_righe jsonb)
returns integer language plpgsql set search_path = public as $$
declare
  j jsonb; r record; n integer := 0; prima uuid[]; sc_ids text[]; sc_cartelle uuid[];
begin
  if p_lotto is null or jsonb_typeof(p_righe) is distinct from 'array' then
    raise exception 'riordino_registra_v2: lotto o righe non validi';
  end if;
  for j in select value from jsonb_array_elements(p_righe) loop
    select p.id as piano_id, p.documento_id, p.file_id, p.nome_nuovo,
           m.id as cartella, m.drive_cartella_id, d.drive_fissa, d.drive_cartella, d.drive_rinomina, d.fascicolo
      into r
    from piano_riordino p
    join categorie c on c.percorso = p.percorso_nuovo
    join cartelle_mie m on m.categoria_id = c.id and m.archiviata_il is null
    left join documenti d on d.id = p.documento_id
    where p.file_id = j->>'file_id' and p.stato = 'approvato' and p.percorso_nuovo not like '99 %';
    continue when not found;
    continue when r.fascicolo = 'clinico_pazienti';
    continue when coalesce(j->>'da_padre_id', '') = '';   -- senza la cartella di prima non si potrebbe annullare
    sc_ids := coalesce((select array_agg(s->>'id') from jsonb_array_elements(coalesce(j->'scorciatoie', '[]'::jsonb)) s), '{}');
    sc_cartelle := coalesce((select array_agg((s->>'cartella_id')::uuid) from jsonb_array_elements(coalesce(j->'scorciatoie', '[]'::jsonb)) s
                             where s->>'cartella_id' is not null), '{}');
    prima := coalesce((select array_agg(cartella_id) from cartelle_mie_documenti where documento_id = r.documento_id), '{}');
    insert into log_spostamenti (lotto, piano_id, documento_id, file_id, da_padre_id, da_nome, a_padre_id, a_nome, cartella_mia,
      cartelle_prima, drive_fissa_prima, drive_cartella_prima, drive_rinomina_prima, scorciatoie, esito)
    values (p_lotto, r.piano_id, r.documento_id, r.file_id, j->>'da_padre_id', j->>'da_nome',
      r.drive_cartella_id, r.nome_nuovo, r.cartella, prima, r.drive_fissa, r.drive_cartella, r.drive_rinomina, sc_ids, 'eseguito');
    if r.documento_id is not null then
      update documenti set drive_fissa = true, drive_rinomina = false, drive_cartella = 'cartella:' || r.cartella where id = r.documento_id;
      delete from cartelle_mie_documenti where documento_id = r.documento_id and cartella_id <> r.cartella and not (cartella_id = any(sc_cartelle));
      insert into cartelle_mie_documenti (cartella_id, documento_id)
        select x, r.documento_id from unnest(array[r.cartella] || sc_cartelle) x on conflict do nothing;
    end if;
    update piano_riordino set stato = 'eseguito' where id = r.piano_id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Un file non riuscito: riga 'errore' nel registro, il piano resta 'approvato' e il file torna al giro dopo.
-- Restituisce gli errori di fila di quel file (al terzo riordino_prossimi smette di riproporlo).
create or replace function riordino_errore(p_lotto uuid, p_file_id text, p_errore text)
returns integer language plpgsql set search_path = public as $$
declare r record;
begin
  if p_lotto is null or coalesce(p_file_id, '') = '' then raise exception 'riordino_errore: lotto o file non validi'; end if;
  select p.id, p.documento_id into r from piano_riordino p where p.file_id = p_file_id;
  insert into log_spostamenti (lotto, piano_id, documento_id, file_id, esito, errore)
  values (p_lotto, r.id, r.documento_id, p_file_id, 'errore', left(coalesce(p_errore, 'errore'), 300));
  return riordino_errori_di_fila(p_file_id);
end $$;

-- Per la schermata «Piano di riordino»: file approvati fermi dopo 3 errori di fila, con l'ultimo motivo.
create or replace view v_riordino_errori_ripetuti with (security_invoker = true) as
select p.file_id, p.documento_id, p.nome_attuale, p.nome_nuovo, p.percorso_nuovo,
       riordino_errori_di_fila(p.file_id) as errori,
       (select l.errore from log_spostamenti l where l.file_id = p.file_id and l.esito = 'errore' order by l.id desc limit 1) as ultimo_errore,
       (select max(l.eseguito_il) from log_spostamenti l where l.file_id = p.file_id and l.esito = 'errore') as ultimo_il
from piano_riordino p
where p.stato = 'approvato' and riordino_errori_di_fila(p.file_id) >= 3;

-- Solo lo script (chiave di servizio). Mai anon / PUBLIC; le funzioni neanche agli utenti dell'app.
revoke execute on function riordino_prossimi(int) from anon, public, authenticated;
revoke execute on function riordino_errori_di_fila(text) from anon, public;
revoke execute on function riordino_registra_v2(uuid, jsonb) from anon, public, authenticated;
revoke execute on function riordino_errore(uuid, text, text) from anon, public, authenticated;
grant execute on function riordino_prossimi(int), riordino_errori_di_fila(text), riordino_registra_v2(uuid, jsonb), riordino_errore(uuid, text, text) to service_role;
-- La vista la legge l'app di Luca (RLS proprietario su piano_riordino e log_spostamenti, security_invoker).
revoke all on v_riordino_errori_ripetuti from anon, public;
grant select on v_riordino_errori_ripetuti to authenticated;
grant execute on function riordino_errori_di_fila(text) to authenticated;
