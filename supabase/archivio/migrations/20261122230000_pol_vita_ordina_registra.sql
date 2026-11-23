-- POL-VITA-ORDINA fase 3 — spostamenti fatti da Claude Code con il connettore Google Drive di Luca
-- (lo script era fermo per il limite giornaliero di Google). Claude Code sposta e rinomina il file su Drive,
-- poi registra qui lo spostamento con riordino_registra(): stesso registro e stesso «Annulla lotto» dello script.
-- Migrazione additiva e idempotente.

-- Cartelle Drive dell'archivio PRIMA del riordino (percorso relativo ad «Archivio personale» → id), dalla
-- diagnosi della fase 1: servono per sapere dove rimettere un file con «Annulla lotto».
create table if not exists cartelle_drive_prima (
  percorso  text primary key,
  drive_id  text not null
);
alter table cartelle_drive_prima enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cartelle_drive_prima' and policyname = 'proprietario') then
    create policy proprietario on cartelle_drive_prima for select to authenticated using ((select e_proprietario()));
  end if;
end $$;
revoke all on cartelle_drive_prima from anon, public;
revoke insert, update, delete, truncate, references, trigger on cartelle_drive_prima from authenticated;

-- Registra come eseguiti i file già spostati e rinominati su Drive (solo righe approvate, mai «99», mai clinici):
-- registro con cartella e nome di prima, documento fissato nella cartella dell'app (gemella), riga «eseguito».
create or replace function riordino_registra(p_lotto uuid, p_file_ids text[])
returns integer language plpgsql set search_path = public as $$
declare r record; n integer := 0; prima uuid[];
begin
  for r in
    select p.id as piano_id, p.documento_id, p.file_id, p.percorso_attuale, p.nome_attuale, p.nome_nuovo,
           m.id as cartella, m.drive_cartella_id, d.drive_fissa, d.drive_cartella, d.drive_rinomina, d.fascicolo
    from piano_riordino p
    join categorie c on c.percorso = p.percorso_nuovo
    join cartelle_mie m on m.categoria_id = c.id and m.archiviata_il is null
    left join documenti d on d.id = p.documento_id
    where p.file_id = any(p_file_ids) and p.stato = 'approvato' and p.percorso_nuovo not like '99 %'
  loop
    continue when r.fascicolo = 'clinico_pazienti';
    prima := coalesce((select array_agg(cartella_id) from cartelle_mie_documenti where documento_id = r.documento_id), '{}');
    insert into log_spostamenti (lotto, piano_id, documento_id, file_id, da_padre_id, da_nome, a_padre_id, a_nome, cartella_mia,
      cartelle_prima, drive_fissa_prima, drive_cartella_prima, drive_rinomina_prima, esito)
    values (p_lotto, r.piano_id, r.documento_id, r.file_id,
      (select drive_id from cartelle_drive_prima where percorso = coalesce(r.percorso_attuale, '')), r.nome_attuale,
      r.drive_cartella_id, r.nome_nuovo, r.cartella, prima, r.drive_fissa, r.drive_cartella, r.drive_rinomina, 'eseguito');
    if r.documento_id is not null then
      update documenti set drive_fissa = true, drive_rinomina = false, drive_cartella = 'cartella:' || r.cartella where id = r.documento_id;
      delete from cartelle_mie_documenti where documento_id = r.documento_id and cartella_id <> r.cartella;
      insert into cartelle_mie_documenti (cartella_id, documento_id) values (r.cartella, r.documento_id) on conflict do nothing;
    end if;
    update piano_riordino set stato = 'eseguito' where id = r.piano_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function riordino_registra(uuid, text[]) from anon, public, authenticated;
