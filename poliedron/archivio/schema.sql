-- =====================================================================
-- ARCHIVIO DOCUMENTI — schema Supabase
-- Incolla tutto in Supabase > SQL Editor > Run. Si può rieseguire.
-- Se accedi alla dashboard con un'email diversa, cambiala in e_proprietario().
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Fascicoli ----------
create table if not exists fascicoli (
  codice text primary key,
  nome   text not null,
  ordine int  not null default 0
);

insert into fascicoli (codice, nome, ordine) values
  ('identita','Identità',1),
  ('immobili','Immobili e catasto',2),
  ('successione','Successione',3),
  ('conti','Conti e banche',4),
  ('fiscale','Fiscale e tasse',5),
  ('previdenza','Previdenza ed ENPAM',6),
  ('utenze','Utenze',7),
  ('studio_fornitori','Studio - fornitori',8),
  ('studio_fatture_emesse','Studio - fatture emesse',9),
  ('legale','Legale e contenziosi',10),
  ('assicurazioni','Assicurazioni',11),
  ('veicoli','Veicoli',12),
  ('famiglia_scuola','Famiglia e scuola',13),
  ('sanitario_famiglia','Sanitario famiglia',14),
  ('clinico_pazienti','Clinico pazienti',15),
  ('servizi','Abbonamenti e servizi',16),
  ('acquisti','Acquisti',17),
  ('altro','Altro',99)
on conflict (codice) do update set nome = excluded.nome, ordine = excluded.ordine;

-- ---------- Pratiche (questioni con un seguito) ----------
create table if not exists pratiche (
  id            uuid primary key default gen_random_uuid(),
  titolo        text not null,
  fascicolo     text references fascicoli(codice) default 'altro',
  stato         text not null default 'aperta'
                check (stato in ('aperta','in_corso','risolta','archiviata')),
  urgenza       text not null default 'media'
                check (urgenza in ('bassa','media','alta')),
  note          text,
  creata_il     timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

-- ---------- Documenti ----------
create table if not exists documenti (
  id                  uuid primary key default gen_random_uuid(),
  hash_sha256         text unique not null,
  gmail_message_id    text not null,
  gmail_thread_id     text,
  email_oggetto       text,
  email_mittente      text,
  email_data          timestamptz,
  nome_file_originale text,
  mime_type           text,
  dimensione_byte     bigint,
  drive_file_id       text,
  drive_url           text,
  fascicolo           text references fascicoli(codice) default 'altro',
  tipo_documento      text,
  titolo              text,
  riassunto           text,
  data_documento      date,
  importo             numeric(12,2),
  tag                 text[] not null default '{}',
  azione_richiesta    boolean not null default false,
  azione_descrizione  text,
  urgenza             text check (urgenza in ('bassa','media','alta')),
  analisi_contenuto   boolean not null default true,  -- false = catalogato solo da email e nome file
  dati_estratti       jsonb not null default '{}'::jsonb,
  pratica_id          uuid references pratiche(id) on delete set null,
  creato_il           timestamptz not null default now(),
  ricerca             tsvector
);

create index if not exists documenti_fascicolo_idx on documenti (fascicolo);
create index if not exists documenti_pratica_idx   on documenti (pratica_id);
create index if not exists documenti_data_idx      on documenti (email_data desc);
create index if not exists documenti_ricerca_idx   on documenti using gin (ricerca);

create or replace function documenti_ricerca_aggiorna() returns trigger
language plpgsql as $$
begin
  new.ricerca :=
    setweight(to_tsvector('italian', coalesce(new.titolo,'')), 'A') ||
    setweight(to_tsvector('italian', coalesce(array_to_string(new.tag,' '),'')), 'B') ||
    setweight(to_tsvector('italian', coalesce(new.riassunto,'')), 'B') ||
    setweight(to_tsvector('italian',
      coalesce(new.email_oggetto,'') || ' ' || coalesce(new.nome_file_originale,'') || ' ' ||
      coalesce(new.email_mittente,'') || ' ' || coalesce(new.dati_estratti::text,'')), 'C');
  return new;
end $$;

drop trigger if exists documenti_ricerca_trg on documenti;
create trigger documenti_ricerca_trg before insert or update on documenti
  for each row execute function documenti_ricerca_aggiorna();

-- ---------- Soggetti (persone, aziende, enti) ----------
create table if not exists soggetti (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  nome_norm text generated always as (lower(nome)) stored unique,
  tipo      text not null default 'altro'
            check (tipo in ('persona','azienda','ente','professionista','banca','altro'))
);

create table if not exists documenti_soggetti (
  documento_id uuid references documenti(id) on delete cascade,
  soggetto_id  uuid references soggetti(id) on delete cascade,
  ruolo        text,
  primary key (documento_id, soggetto_id)
);

-- ---------- Scadenze ----------
create table if not exists scadenze (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid references documenti(id) on delete cascade,
  pratica_id   uuid references pratiche(id) on delete set null,
  data         date not null,
  descrizione  text not null,
  importo      numeric(12,2),
  completata   boolean not null default false
);
create index if not exists scadenze_data_idx on scadenze (data) where not completata;

-- ---------- Log errori ----------
create table if not exists log_elaborazione (
  id        bigserial primary key,
  riferimento text,
  errore    text,
  creato_il timestamptz not null default now()
);

-- ---------- Funzioni di supporto ----------
create or replace function _data(t text) returns date language plpgsql immutable as $$
begin return nullif(trim(t),'')::date; exception when others then return null; end $$;

create or replace function _num(t text) returns numeric language plpgsql immutable as $$
begin return nullif(replace(trim(t), ',', '.'),'')::numeric; exception when others then return null; end $$;

-- Registra un documento analizzato (chiamata solo dallo script con la chiave segreta)
create or replace function registra_documento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid; v_pratica uuid; v_sog uuid; v_fasc text; v_urg text; v_tipo text;
  v_azione boolean := (p->>'azione_richiesta') = 'true';
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

-- ---------- Viste per la dashboard ----------
create or replace view v_conteggi_fascicoli with (security_invoker = true) as
select f.codice, f.nome, f.ordine,
       count(d.id)::int as n,
       count(d.id) filter (where d.azione_richiesta)::int as n_azioni
from fascicoli f left join documenti d on d.fascicolo = f.codice
group by f.codice, f.nome, f.ordine;

create or replace view v_pratiche with (security_invoker = true) as
select p.*,
       (select count(*)::int from documenti d where d.pratica_id = p.id) as n_documenti,
       (select max(coalesce(d.data_documento, d.email_data::date)) from documenti d where d.pratica_id = p.id) as ultima_attivita,
       (select min(s.data) from scadenze s where s.pratica_id = p.id and not s.completata and s.data >= current_date) as prossima_scadenza
from pratiche p;

-- Ricerca: testo libero su titolo, riassunto, oggetto, mittente, dati estratti e soggetti
create or replace function cerca_documenti(q text, fasc text default null, lim int default 100)
returns setof documenti language sql stable security invoker as $$
  select d.* from documenti d
  where (fasc is null or d.fascicolo = fasc)
    and (
      coalesce(q,'') = ''
      or d.ricerca @@ websearch_to_tsquery('italian', q)
      or d.titolo ilike '%' || q || '%'
      or d.email_mittente ilike '%' || q || '%'
      or d.nome_file_originale ilike '%' || q || '%'
      or exists (select 1 from documenti_soggetti ds join soggetti s on s.id = ds.soggetto_id
                 where ds.documento_id = d.id and s.nome ilike '%' || q || '%')
    )
  order by
    case when coalesce(q,'') = '' then 0
         else ts_rank(d.ricerca, websearch_to_tsquery('italian', q)) end desc,
    d.email_data desc nulls last
  limit lim;
$$;

-- Archivia in blocco le pratiche ferme (utile dopo il recupero dello storico)
create or replace function archivia_pratiche_ferme(mesi int default 12) returns int
language sql security invoker as $$
  with x as (
    update pratiche p set stato = 'archiviata', aggiornata_il = now()
    where p.stato in ('aperta','in_corso')
      and coalesce(
            (select max(coalesce(d.data_documento, d.email_data::date)) from documenti d where d.pratica_id = p.id),
            p.creata_il::date
          ) < current_date - make_interval(months => mesi)
    returning 1
  )
  select count(*)::int from x;
$$;

-- ---------- Sicurezza: accesso solo al proprietario ----------
create or replace function e_proprietario() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'luca.simondi@gmail.com'
$$;

do $$
declare t text;
begin
  foreach t in array array['fascicoli','pratiche','documenti','soggetti',
                           'documenti_soggetti','scadenze','log_elaborazione'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists proprietario on %I', t);
    execute format('create policy proprietario on %I for all to authenticated
                    using (e_proprietario()) with check (e_proprietario())', t);
  end loop;
end $$;

create table if not exists lotti_importazione (
  id bigserial primary key,
  periodo text not null unique,
  documenti int not null default 0,
  duplicati int not null default 0,
  errori int not null default 0,
  per_fascicolo jsonb not null default '{}'::jsonb,
  nuove_pratiche jsonb not null default '[]'::jsonb,
  urgenti jsonb not null default '[]'::jsonb,
  creato_il timestamptz not null default now()
);
alter table lotti_importazione enable row level security;
drop policy if exists proprietario on lotti_importazione;
create policy proprietario on lotti_importazione for all to authenticated
  using ((select e_proprietario())) with check ((select e_proprietario()));
