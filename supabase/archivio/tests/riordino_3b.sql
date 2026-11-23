-- POL-VITA-ORDINA fase 3b — test di riordino_prossimi, riordino_registra_v2, riordino_errore e
-- v_riordino_errori_ripetuti. Tutto dentro UNA transazione annullata alla fine: righe di prova sintetiche
-- (file_id 'TEST3B-…'), nessun dato reale modificato. Ruoli simulati con SET LOCAL role + request.jwt.claims
-- nello stesso blocco. Si lancia dopo la migrazione 20261123200000_pol_vita_ordina_script.sql.
\set ON_ERROR_STOP on
begin;

create function pg_temp.ok(condizione boolean, messaggio text) returns void language plpgsql as $$
begin
  if not coalesce(condizione, false) then raise exception 'TEST FALLITO: %', messaggio; end if;
end $$;
create function pg_temp.rifiutato(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when insufficient_privilege then return true;
end $$;

-- Una cartella della tassonomia con gemella su Drive (destinazione) e una «99» (mai toccata).
create temp table t_dest as
select c.percorso, m.id as cartella, m.drive_cartella_id from categorie c
join cartelle_mie m on m.categoria_id = c.id and m.archiviata_il is null and m.drive_cartella_id is not null
where c.percorso not like '99 %' order by c.percorso limit 1;
create temp table t_99 as select percorso from categorie where percorso like '99 %' order by percorso limit 1;
select pg_temp.ok((select count(*) from t_dest) = 1 and (select count(*) from t_99) = 1, 'cartelle di prova trovate');
grant select on t_dest, t_99 to service_role;   -- le tabelle temporanee servono anche al ruolo simulato dello script

-- Documenti sintetici: uno normale, uno clinico.
insert into documenti (id, hash_sha256, gmail_message_id, titolo, fascicolo, drive_fissa, drive_rinomina, drive_cartella) values
  ('3b000000-0000-4000-8000-000000000001', 'test3b-h1', 'test3b-m1', 'Prova 3b', 'altro', false, true, 'Altro/2020'),
  ('3b000000-0000-4000-8000-000000000002', 'test3b-h2', 'test3b-m2', 'Prova 3b clinico', 'clinico_pazienti', false, false, null),
  ('3b000000-0000-4000-8000-000000000003', 'test3b-h3', 'test3b-m3', 'Prova 3b errori', 'altro', false, false, null);
insert into piano_riordino (file_id, documento_id, percorso_attuale, nome_attuale, percorso_nuovo, nome_nuovo, confidenza, stato) values
  ('TEST3B-ok',   '3b000000-0000-4000-8000-000000000001', 'Altro', 'vecchio.pdf', (select percorso from t_dest), '2020-01-01_Prova_Test_Ok.pdf', 0.9, 'approvato'),
  ('TEST3B-clin', '3b000000-0000-4000-8000-000000000002', 'Altro', 'c.pdf', (select percorso from t_dest), '2020-01-01_Prova_Test_Clin.pdf', 0.9, 'approvato'),
  ('TEST3B-99',   null, 'Altro', 'n.pdf', (select percorso from t_99), '2020-01-01_Prova_Test_99.pdf', 0.4, 'approvato'),
  ('TEST3B-prop', null, 'Altro', 'p.pdf', (select percorso from t_dest), '2020-01-01_Prova_Test_Prop.pdf', 0.9, 'proposto'),
  ('TEST3B-err',  '3b000000-0000-4000-8000-000000000003', 'Altro', 'e.pdf', (select percorso from t_dest), '2020-01-01_Prova_Test_Err.pdf', 0.9, 'approvato');

-- 1. anon e un utente qualsiasi: niente funzioni dello script, niente righe dalla vista.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.ok(pg_temp.rifiutato('select * from riordino_prossimi(10)'), 'anon: riordino_prossimi negata');
select pg_temp.ok(pg_temp.rifiutato($q$select riordino_registra_v2('3b000000-0000-4000-8000-0000000000aa', '[]')$q$), 'anon: registra_v2 negata');
select pg_temp.ok(pg_temp.rifiutato($q$select riordino_errore('3b000000-0000-4000-8000-0000000000aa', 'TEST3B-ok', 'x')$q$), 'anon: riordino_errore negata');
select pg_temp.ok(pg_temp.rifiutato('select * from v_riordino_errori_ripetuti'), 'anon: vista negata');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"3b000000-0000-4000-8000-0000000000ff","email":"altro@example.com"}', true);
select pg_temp.ok(pg_temp.rifiutato('select * from riordino_prossimi(10)'), 'altro utente: riordino_prossimi negata');
select pg_temp.ok(pg_temp.rifiutato($q$select riordino_registra_v2('3b000000-0000-4000-8000-0000000000aa', '[]')$q$), 'altro utente: registra_v2 negata');
select pg_temp.ok((select count(*) from v_riordino_errori_ripetuti) = 0, 'altro utente: la vista non mostra nulla (RLS)');
reset role;

-- 2. Lo script (service role): selezione con gli stessi filtri di riordino_registra.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temp table t_sel as select * from riordino_prossimi(100000) where file_id like 'TEST3B-%';
select pg_temp.ok((select array_agg(file_id order by file_id) from t_sel) = array['TEST3B-err', 'TEST3B-ok'], 'selezione: solo approvati, mai 99 / clinici / proposti');
select pg_temp.ok((select drive_cartella_id from t_sel where file_id = 'TEST3B-ok') = (select drive_cartella_id from t_dest), 'selezione: cartella Drive di destinazione');
select pg_temp.ok((select count(*) from riordino_prossimi(100000) r join documenti d on d.id = r.documento_id where d.fascicolo = 'clinico_pazienti') = 0, 'selezione: nessun clinico in tutto il piano');
select pg_temp.ok((select count(*) from riordino_prossimi(100000) where percorso_nuovo like '99 %') = 0, 'selezione: nessun 99 in tutto il piano');
select pg_temp.ok((select bool_and(file_id >= prec) from (select file_id, lag(file_id, 1, '') over (order by n) as prec
  from riordino_prossimi(500) with ordinality as x(file_id, a, b, c, d, e, n)) y), 'selezione: ordinata per file_id');
select pg_temp.ok((select count(*) from riordino_prossimi(3)) <= 3 and (select count(*) from riordino_prossimi(0)) = 0, 'selezione: rispetta il limite');

-- 3. registra_v2: cartella e nome di prima dalla riga (valore REALE di Drive), non da cartelle_drive_prima.
select pg_temp.ok(riordino_registra_v2('3b000000-0000-4000-8000-0000000000aa', $j$[
  {"file_id":"TEST3B-ok","da_padre_id":"PADRE-REALE","da_nome":"nome reale.pdf"},
  {"file_id":"TEST3B-clin","da_padre_id":"X","da_nome":"x"},
  {"file_id":"TEST3B-99","da_padre_id":"X","da_nome":"x"},
  {"file_id":"TEST3B-prop","da_padre_id":"X","da_nome":"x"},
  {"file_id":"TEST3B-err","da_padre_id":"","da_nome":"x"},
  {"file_id":"TEST3B-non-esiste","da_padre_id":"X","da_nome":"x"}
]$j$) = 1, 'registra_v2: registra solo la riga approvata valida');
select pg_temp.ok((select count(*) from log_spostamenti where lotto = '3b000000-0000-4000-8000-0000000000aa') = 1, 'registra_v2: una sola riga di registro');
select pg_temp.ok((select da_padre_id = 'PADRE-REALE' and da_nome = 'nome reale.pdf' and esito = 'eseguito'
  and a_padre_id = (select drive_cartella_id from t_dest) and a_nome = '2020-01-01_Prova_Test_Ok.pdf'
  and cartella_mia = (select cartella from t_dest) and drive_fissa_prima = false and drive_rinomina_prima = true and drive_cartella_prima = 'Altro/2020'
  from log_spostamenti where lotto = '3b000000-0000-4000-8000-0000000000aa'), 'registra_v2: registro completo per «Annulla lotto»');
select pg_temp.ok((select drive_fissa and not drive_rinomina and drive_cartella = 'cartella:' || (select cartella from t_dest)
  from documenti where id = '3b000000-0000-4000-8000-000000000001'), 'registra_v2: documento fissato nella cartella');
select pg_temp.ok((select array_agg(cartella_id) from cartelle_mie_documenti where documento_id = '3b000000-0000-4000-8000-000000000001') = array[(select cartella from t_dest)], 'registra_v2: documento nella cartella dell''app');
select pg_temp.ok((select stato from piano_riordino where file_id = 'TEST3B-ok') = 'eseguito', 'registra_v2: piano eseguito');
select pg_temp.ok((select array_agg(stato order by file_id) from piano_riordino where file_id in ('TEST3B-clin', 'TEST3B-99', 'TEST3B-prop', 'TEST3B-err'))
  = array['approvato', 'approvato', 'approvato', 'proposto'], 'registra_v2: le altre righe non cambiano');
select pg_temp.ok((select drive_fissa = false from documenti where id = '3b000000-0000-4000-8000-000000000002'), 'registra_v2: il clinico non si tocca');
select pg_temp.ok(riordino_registra_v2('3b000000-0000-4000-8000-0000000000aa', '[{"file_id":"TEST3B-ok","da_padre_id":"Y","da_nome":"y"}]') = 0, 'registra_v2: una riga già eseguita non si registra due volte');

-- 4. riordino_errore: riga 'errore', piano resta approvato; al terzo errore di fila il file esce dalla selezione.
select pg_temp.ok(riordino_errore('3b000000-0000-4000-8000-0000000000bb', 'TEST3B-err', 'File nel cestino di Drive') = 1, 'errore 1');
select pg_temp.ok((select stato from piano_riordino where file_id = 'TEST3B-err') = 'approvato', 'dopo un errore resta approvato');
select pg_temp.ok(exists (select 1 from riordino_prossimi(100000) where file_id = 'TEST3B-err'), 'dopo un errore viene ritentato');
select pg_temp.ok(riordino_errore('3b000000-0000-4000-8000-0000000000bb', 'TEST3B-err', 'File nel cestino di Drive') = 2, 'errore 2');
select pg_temp.ok(riordino_errore('3b000000-0000-4000-8000-0000000000bb', 'TEST3B-err', 'File nel cestino di Drive') = 3, 'errore 3');
select pg_temp.ok(not exists (select 1 from riordino_prossimi(100000) where file_id = 'TEST3B-err'), 'dopo 3 errori non viene più riproposto');
select pg_temp.ok((select errori = 3 and ultimo_errore = 'File nel cestino di Drive' from v_riordino_errori_ripetuti where file_id = 'TEST3B-err'), 'dopo 3 errori è nella vista con il motivo');
select pg_temp.ok((select count(*) from log_spostamenti where lotto = '3b000000-0000-4000-8000-0000000000bb' and esito = 'errore') = 3, 'tre righe errore nel registro');
reset role;

-- 5. Una riga 'in_corso' recente (un altro processo sta spostando il file) lo esclude dalla selezione.
insert into log_spostamenti (lotto, file_id, esito) values ('3b000000-0000-4000-8000-0000000000cc', 'TEST3B-prop', 'in_corso');
update piano_riordino set stato = 'approvato' where file_id = 'TEST3B-prop';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.ok(not exists (select 1 from riordino_prossimi(100000) where file_id = 'TEST3B-prop'), 'file in corso altrove escluso');
reset role;

-- 6. Privilegi: nessuna funzione nuova eseguibile da anon o PUBLIC.
select pg_temp.ok(not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute'), 'privilegi di ' || f)
from unnest(array['riordino_prossimi(int)', 'riordino_registra_v2(uuid,jsonb)', 'riordino_errore(uuid,text,text)']) f;
select pg_temp.ok(not has_function_privilege('anon', 'riordino_errori_di_fila(text)', 'execute'), 'riordino_errori_di_fila non per anon');
select pg_temp.ok(not has_table_privilege('anon', 'v_riordino_errori_ripetuti', 'select'), 'vista non per anon');

select 'riordino_3b: tutti i test passati' as esito;
rollback;
