-- POL-VITA-001 — test locale: proprietario unico, registrazioni chiuse, privilegi,
-- registrazione con deduplica e cancellazione definitiva senza residui.
-- Ordine: bootstrap_locale.sql → migrazioni in supabase/archivio/migrations → questo file.
\set ON_ERROR_STOP on
begin;

create function pg_temp.ok(condizione boolean, messaggio text) returns void
language plpgsql as $$
begin
  if not coalesce(condizione, false) then raise exception 'TEST FALLITO: %', messaggio; end if;
end $$;

create function pg_temp.rifiutato(sql text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception when insufficient_privilege then return true;
end $$;

-- Utente reale del PO, email confermata.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', 'luca.simondi@gmail.com', now());

-- Registrazioni chiuse per qualsiasi altra email (anche senza email).
select pg_temp.ok(pg_temp.rifiutato($q$insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000002', 'altro@example.com')$q$), 'registrazione di un''altra email bloccata');
select pg_temp.ok(pg_temp.rifiutato($q$insert into auth.users (id) values ('00000000-0000-4000-8000-000000000003')$q$), 'utente senza email bloccato');
select pg_temp.ok(pg_temp.rifiutato($q$update auth.users set email = 'altro@example.com' where id = '00000000-0000-4000-8000-000000000001'$q$), 'cambio email del proprietario bloccato');

-- Dati registrati come la funzione di import (service role).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temp table esito as
select registra_documento($j${
  "hash_sha256":"h1","gmail_message_id":"m1","gmail_thread_id":"t1",
  "email_oggetto":"Fattura Edison settembre","email_mittente":"edison@example.com",
  "nome_file_originale":"fattura.pdf","drive_file_id":"drive-1","fascicolo":"utenze",
  "titolo":"Fattura Edison","riassunto":"Fattura luce Via Piccona 33","importo":"120,50",
  "tag":["edison","luce"],"azione_richiesta":"true",
  "pratica":{"nuova_titolo":"Edison – Via Piccona 33"},
  "soggetti":[{"nome":"Edison","tipo":"azienda","ruolo":"emittente"}],
  "scadenze":[{"data":"2026-11-15","descrizione":"Pagamento fattura","importo":"120,50"}]
}$j$::jsonb) as r;
select pg_temp.ok((select (r->>'esistente')::boolean = false from esito), 'primo documento registrato');
select pg_temp.ok((select (registra_documento('{"hash_sha256":"h1","gmail_message_id":"m1"}')->>'esistente')::boolean), 'stesso hash: nessun duplicato');
select registra_documento(jsonb_build_object(
  'hash_sha256','h2','gmail_message_id','m2','drive_file_id','drive-2','fascicolo','utenze',
  'titolo','Sollecito Fides','pratica',jsonb_build_object('id_esistente',(select r->>'pratica_id' from esito)),
  'soggetti',jsonb_build_array(jsonb_build_object('nome','Edison','tipo','azienda'),jsonb_build_object('nome','Fides','tipo','azienda')),
  'scadenze',jsonb_build_array(jsonb_build_object('data','2026-12-01','descrizione','Ultimo avviso'))));
insert into log_elaborazione (riferimento, errore) values ('m1', 'prova');
insert into scadenze (pratica_id, data, descrizione) select (r->>'pratica_id')::uuid, '2027-01-10', 'Scadenza della pratica' from esito;
select pg_temp.ok((select count(*) = 2 from documenti), 'due documenti, nessun doppione');
reset role;

-- anon: nessun accesso.
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select pg_temp.ok(pg_temp.rifiutato('select count(*) from documenti'), 'anon non legge documenti');
select pg_temp.ok(pg_temp.rifiutato('select count(*) from v_pratiche'), 'anon non legge le viste');
select pg_temp.ok(pg_temp.rifiutato($q$select * from cerca_documenti('edison')$q$), 'anon non esegue la ricerca');
select pg_temp.ok(pg_temp.rifiutato($q$select elimina_documento(gen_random_uuid())$q$), 'anon non cancella');
reset role;

-- Altro utente autenticato (B): non vede nulla, non scrive, non cancella, non svuota.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","email":"altro@example.com","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 0 from documenti), 'B non vede documenti');
select pg_temp.ok((select count(*) = 0 from scadenze), 'B non vede scadenze');
select pg_temp.ok((select count(*) = 0 from cerca_documenti('edison')), 'B non trova nulla');
select pg_temp.ok(pg_temp.rifiutato($q$insert into pratiche (titolo) values ('intrusa')$q$), 'B non scrive');
select pg_temp.ok(pg_temp.rifiutato($q$select elimina_documento((select id from documenti limit 1))$q$), 'B non cancella');
select pg_temp.ok(pg_temp.rifiutato('truncate documenti cascade'), 'B non può TRUNCATE');
select pg_temp.ok(pg_temp.rifiutato($q$select registra_documento('{}')$q$), 'B non registra documenti');

-- Email del PO nel token ma nessun utente reale con quell'email: non vede nulla.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","email":"luca.simondi@gmail.com","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 0 from documenti), 'token con email del PO ma utente diverso: nulla');
reset role;

-- Utente del PO con email non confermata: non vede nulla.
update auth.users set email_confirmed_at = null where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","email":"luca.simondi@gmail.com","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 0 from documenti), 'email non confermata: nulla');
reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-000000000001';

-- Proprietario: vede, cerca, cancella senza residui.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","email":"luca.simondi@gmail.com","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 2 from documenti), 'il proprietario vede i suoi documenti');
select pg_temp.ok((select count(*) >= 1 from cerca_documenti('edison')), 'ricerca del proprietario');
select pg_temp.ok((select prossima_scadenza is not null from v_pratiche), 'vista pratiche con scadenza');

create temp table cancellato as
select elimina_documento((select id from documenti where hash_sha256 = 'h1')) as r;
select pg_temp.ok((select r->'drive_file_ids' = '["drive-1"]'::jsonb from cancellato), 'restituisce il file Drive da cancellare');
select pg_temp.ok((select count(*) = 0 from documenti where hash_sha256 = 'h1'), 'documento cancellato');
select pg_temp.ok((select count(*) = 0 from cerca_documenti('Piccona')), 'testo non più trovabile');
select pg_temp.ok((select count(*) = 0 from scadenze where descrizione = 'Pagamento fattura'), 'scadenze del documento cancellate');
select pg_temp.ok((select count(*) = 0 from log_elaborazione where riferimento = 'm1'), 'log del documento cancellato');
select pg_temp.ok((select count(*) = 1 from soggetti where nome = 'Edison'), 'soggetto ancora usato da un altro documento resta');
select pg_temp.ok((select (elimina_documento(gen_random_uuid())->>'eliminato')::boolean = false), 'id inesistente: nessun errore, nulla cancellato');

create temp table pratica_cancellata as
select elimina_pratica((select id from pratiche limit 1)) as r;
select pg_temp.ok((select r->'drive_file_ids' = '["drive-2"]'::jsonb from pratica_cancellata), 'pratica: restituisce i file Drive');
select pg_temp.ok((select count(*) = 0 from documenti), 'nessun documento residuo');
select pg_temp.ok((select count(*) = 0 from pratiche), 'nessuna pratica residua');
select pg_temp.ok((select count(*) = 0 from scadenze), 'nessuna scadenza residua');
select pg_temp.ok((select count(*) = 0 from documenti_soggetti), 'nessun collegamento residuo');
select pg_temp.ok((select count(*) = 0 from soggetti), 'nessun soggetto orfano');
select pg_temp.ok((select count(*) = 18 from fascicoli), 'i fascicoli restano');
reset role;

select 'archivio_rls_cancellazione: tutti i test superati' as esito;
rollback;
