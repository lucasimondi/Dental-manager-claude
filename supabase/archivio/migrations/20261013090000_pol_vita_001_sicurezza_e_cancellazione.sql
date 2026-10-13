-- POL-VITA-001 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Sopra lo schema di Cowork (20261012201509), approvato dal PO come base il 2026-10-13.
--
-- 1. Proprietario: non basta più l'email scritta nel JWT. Serve un utente reale in
--    auth.users con quell'email CONFERMATA. Chi si registrasse con l'email del PO senza
--    poterla confermare non vede nulla.
-- 2. Registrazioni: auth.users accetta solo l'email del PO (nessun altro account possibile).
-- 3. Privilegi: anon non ha più accesso a tabelle, viste e funzioni; authenticated perde
--    TRUNCATE/REFERENCES/TRIGGER (TRUNCATE non è filtrato dalla RLS).
-- 4. Cancellazione definitiva (art. 17 GDPR): elimina_documento / elimina_pratica tolgono
--    in una sola transazione documento, testo estratto e indice di ricerca (stessa riga),
--    scadenze, collegamenti ai soggetti, soggetti rimasti orfani e righe di log collegate.
--    Restituiscono gli id dei file su Google Drive: il chiamante (funzione di import, Fase 1)
--    deve cancellarli da Drive. Nessun soft-delete.
-- 5. Correzione in registra_documento: senza `azione_richiesta` nel JSON la registrazione
--    falliva (NULL in una colonna NOT NULL). Ora vale false. Resto della funzione invariato.
--
-- ROLLBACK (in quest'ordine):
--   (registra_documento: ripristinare la definizione di 20261012201509 e i suoi grant)
--   drop function if exists elimina_pratica(uuid);
--   drop function if exists elimina_documento(uuid);
--   drop trigger if exists archivio_solo_proprietario on auth.users;
--   drop function if exists archivio_blocca_registrazioni();
--   create or replace function e_proprietario() returns boolean language sql stable
--     set search_path = public as $$ select coalesce(auth.jwt() ->> 'email', '') = 'luca.simondi@gmail.com' $$;
--   grant execute on function e_proprietario(), cerca_documenti(text,text,int),
--     archivia_pratiche_ferme(int), _data(text), _num(text), documenti_ricerca_aggiorna() to public, anon;
--   grant all on all tables in schema public to anon, authenticated;
--   grant all on all sequences in schema public to anon;
--   alter default privileges for role postgres in schema public grant all on tables to anon;
--   alter default privileges for role postgres in schema public grant all on sequences to anon;
--   alter default privileges for role postgres in schema public grant execute on functions to anon;

-- 1. Proprietario -----------------------------------------------------------------------
create or replace function e_proprietario() returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'luca.simondi@gmail.com'
     and exists (
       select 1 from auth.users u
       where u.id = auth.uid()
         and lower(u.email) = 'luca.simondi@gmail.com'
         and u.email_confirmed_at is not null
     )
$$;

-- 2. Solo l'account del PO --------------------------------------------------------------
create or replace function archivio_blocca_registrazioni() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email, '')) <> 'luca.simondi@gmail.com' then
    raise exception 'Archivio personale: registrazioni chiuse' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists archivio_solo_proprietario on auth.users;
create trigger archivio_solo_proprietario
  before insert or update of email on auth.users
  for each row execute function archivio_blocca_registrazioni();

-- 3. Privilegi --------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function e_proprietario(), cerca_documenti(text, text, int),
  archivia_pratiche_ferme(int) to authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- 4. Cancellazione definitiva -----------------------------------------------------------
-- SECURITY INVOKER: la RLS vale anche qui; il controllo esplicito dà solo un errore chiaro.
-- Possono chiamarle il proprietario (app) e il service role (funzione di import).
create or replace function elimina_documento(p_id uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v documenti%rowtype;
  v_soggetti uuid[];
begin
  if not (select e_proprietario()) and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Archivio personale: operazione non consentita' using errcode = '42501';
  end if;

  select * into v from documenti where id = p_id for update;
  if not found then
    return jsonb_build_object('eliminato', false);
  end if;

  select coalesce(array_agg(soggetto_id), '{}') into v_soggetti
  from documenti_soggetti where documento_id = p_id;

  delete from log_elaborazione
  where riferimento in (p_id::text, v.hash_sha256, v.gmail_message_id);

  -- documenti_soggetti e scadenze vanno via in cascata.
  delete from documenti where id = p_id;

  delete from soggetti s
  where s.id = any(v_soggetti)
    and not exists (select 1 from documenti_soggetti ds where ds.soggetto_id = s.id);

  return jsonb_build_object('eliminato', true, 'drive_file_ids',
    case when v.drive_file_id is null then '[]'::jsonb else jsonb_build_array(v.drive_file_id) end);
end $$;

create or replace function elimina_pratica(p_id uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_doc uuid;
  v_drive jsonb := '[]'::jsonb;
  r jsonb;
begin
  if not (select e_proprietario()) and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Archivio personale: operazione non consentita' using errcode = '42501';
  end if;

  perform 1 from pratiche where id = p_id for update;
  if not found then
    return jsonb_build_object('eliminato', false);
  end if;

  for v_doc in select id from documenti where pratica_id = p_id loop
    r := elimina_documento(v_doc);
    v_drive := v_drive || coalesce(r->'drive_file_ids', '[]'::jsonb);
  end loop;

  delete from scadenze where pratica_id = p_id;
  delete from pratiche where id = p_id;

  return jsonb_build_object('eliminato', true, 'drive_file_ids', v_drive);
end $$;

revoke execute on function elimina_documento(uuid), elimina_pratica(uuid) from public, anon;
grant execute on function elimina_documento(uuid), elimina_pratica(uuid) to authenticated, service_role;

-- 5. Correzione registra_documento --------------------------------------------------------
create or replace function registra_documento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid; v_pratica uuid; v_sog uuid; v_fasc text; v_urg text; v_tipo text;
  v_azione boolean := coalesce((p->>'azione_richiesta') = 'true', false);
  s jsonb;
begin
  select id, pratica_id into v_doc, v_pratica from documenti where hash_sha256 = p->>'hash_sha256';
  if v_doc is not null then
    return jsonb_build_object('documento_id', v_doc, 'pratica_id', v_pratica, 'esistente', true);
  end if;

  select codice into v_fasc from fascicoli where codice = p->>'fascicolo';
  v_fasc := coalesce(v_fasc, 'altro');
  v_urg  := case when p->>'urgenza' in ('bassa','media','alta') then p->>'urgenza' end;

  if coalesce(p->'pratica'->>'id_esistente','') ~ '^[0-9a-f-]{36}$' then
    select id into v_pratica from pratiche where id = (p->'pratica'->>'id_esistente')::uuid;
  end if;

  if v_pratica is null and coalesce(trim(p->'pratica'->>'nuova_titolo'),'') <> '' then
    insert into pratiche (titolo, fascicolo, urgenza)
    values (trim(p->'pratica'->>'nuova_titolo'), v_fasc, coalesce(v_urg,'media'))
    returning id into v_pratica;
  elsif v_pratica is not null then
    update pratiche set
      aggiornata_il = now(),
      urgenza = case when v_urg = 'alta' then 'alta' else urgenza end,
      stato   = case when stato in ('risolta','archiviata') and v_azione then 'aperta' else stato end
    where id = v_pratica;
  end if;

  insert into documenti (
    hash_sha256, gmail_message_id, gmail_thread_id, email_oggetto, email_mittente, email_data,
    nome_file_originale, mime_type, dimensione_byte, drive_file_id, drive_url,
    fascicolo, tipo_documento, titolo, riassunto, data_documento, importo, tag,
    azione_richiesta, azione_descrizione, urgenza, analisi_contenuto, dati_estratti, pratica_id
  ) values (
    p->>'hash_sha256', p->>'gmail_message_id', p->>'gmail_thread_id', p->>'email_oggetto',
    p->>'email_mittente', nullif(p->>'email_data','')::timestamptz,
    p->>'nome_file_originale', p->>'mime_type', _num(p->>'dimensione_byte')::bigint,
    p->>'drive_file_id', p->>'drive_url',
    v_fasc, p->>'tipo_documento', p->>'titolo', p->>'riassunto', _data(p->>'data_documento'),
    _num(p->>'importo'),
    case when jsonb_typeof(p->'tag') = 'array'
         then array(select jsonb_array_elements_text(p->'tag')) else '{}' end,
    v_azione, nullif(p->>'azione_descrizione',''), v_urg,
    coalesce((p->>'analisi_contenuto') <> 'false', true),
    case when jsonb_typeof(p->'dati_estratti') = 'object' then p->'dati_estratti' else '{}'::jsonb end,
    v_pratica
  ) returning id into v_doc;

  if jsonb_typeof(p->'soggetti') = 'array' then
    for s in select * from jsonb_array_elements(p->'soggetti') loop
      continue when coalesce(trim(s->>'nome'),'') = '';
      v_tipo := case when s->>'tipo' in ('persona','azienda','ente','professionista','banca')
                     then s->>'tipo' else 'altro' end;
      insert into soggetti (nome, tipo) values (trim(s->>'nome'), v_tipo)
        on conflict (nome_norm) do update set nome = soggetti.nome
        returning id into v_sog;
      insert into documenti_soggetti (documento_id, soggetto_id, ruolo)
        values (v_doc, v_sog, s->>'ruolo') on conflict do nothing;
    end loop;
  end if;

  if jsonb_typeof(p->'scadenze') = 'array' then
    for s in select * from jsonb_array_elements(p->'scadenze') loop
      continue when _data(s->>'data') is null;
      insert into scadenze (documento_id, pratica_id, data, descrizione, importo)
      values (v_doc, v_pratica, _data(s->>'data'),
              coalesce(nullif(s->>'descrizione',''),'Scadenza'), _num(s->>'importo'));
    end loop;
  end if;

  return jsonb_build_object('documento_id', v_doc, 'pratica_id', v_pratica, 'esistente', false);
end $$;

revoke execute on function registra_documento(jsonb) from public, anon, authenticated;
grant  execute on function registra_documento(jsonb) to service_role;
