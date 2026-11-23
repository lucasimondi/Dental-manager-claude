-- POL-VITA-ORDINA fase 3b — correzione di riordino_registra_v2 (funzione nuova della fase 3b; riordino_registra
-- non si tocca). Primo giro di prova (lotto b35cbdc7…): 56 file su 100 erano GIÀ nella cartella e col nome del
-- piano, spostati da una sessione chat senza registro. Per questi la cartella «di prima» letta su Drive è quella
-- di destinazione: si usa invece quella della diagnosi. Verifica: per i 44 file spostati dallo script, cartella e
-- nome reali coincidono al 100% con cartelle_drive_prima / nome_attuale.

create or replace function riordino_registra_v2(p_lotto uuid, p_righe jsonb)
returns integer language plpgsql set search_path = public as $$
declare
  j jsonb; r record; n integer := 0; prima uuid[]; sc_ids text[]; sc_cartelle uuid[]; da_padre text; da_nome text;
begin
  if p_lotto is null or jsonb_typeof(p_righe) is distinct from 'array' then
    raise exception 'riordino_registra_v2: lotto o righe non validi';
  end if;
  for j in select value from jsonb_array_elements(p_righe) loop
    select p.id as piano_id, p.documento_id, p.file_id, p.nome_nuovo, p.percorso_attuale, p.nome_attuale,
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
    da_padre := j->>'da_padre_id';
    da_nome := j->>'da_nome';
    -- File trovato GIÀ nella cartella e col nome del piano (spostato da altri senza registro): la posizione di
    -- prima vera è quella della diagnosi (cartelle_drive_prima + nome_attuale), altrimenti «Annulla» non lo rimette a posto.
    if da_padre = r.drive_cartella_id and da_nome = r.nome_nuovo then
      da_padre := coalesce((select drive_id from cartelle_drive_prima where percorso = coalesce(r.percorso_attuale, '')), da_padre);
      da_nome := coalesce(r.nome_attuale, da_nome);
    end if;
    sc_ids := coalesce((select array_agg(s->>'id') from jsonb_array_elements(coalesce(j->'scorciatoie', '[]'::jsonb)) s), '{}');
    sc_cartelle := coalesce((select array_agg((s->>'cartella_id')::uuid) from jsonb_array_elements(coalesce(j->'scorciatoie', '[]'::jsonb)) s
                             where s->>'cartella_id' is not null), '{}');
    prima := coalesce((select array_agg(cartella_id) from cartelle_mie_documenti where documento_id = r.documento_id), '{}');
    insert into log_spostamenti (lotto, piano_id, documento_id, file_id, da_padre_id, da_nome, a_padre_id, a_nome, cartella_mia,
      cartelle_prima, drive_fissa_prima, drive_cartella_prima, drive_rinomina_prima, scorciatoie, esito)
    values (p_lotto, r.piano_id, r.documento_id, r.file_id, da_padre, da_nome,
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

revoke execute on function riordino_registra_v2(uuid, jsonb) from anon, public, authenticated;
grant execute on function riordino_registra_v2(uuid, jsonb) to service_role;

-- Stessa correzione sulle 56 righe del primo giro (solo dati del registro, nessun file).
update log_spostamenti l set da_padre_id = c.drive_id, da_nome = p.nome_attuale
from piano_riordino p, cartelle_drive_prima c
where l.lotto = 'b35cbdc7-6ed0-4aa4-b0f9-c13cfe86fd9a' and p.id = l.piano_id and c.percorso = coalesce(p.percorso_attuale, '')
  and l.da_padre_id = l.a_padre_id and l.da_nome = l.a_nome and p.nome_attuale is not null;
