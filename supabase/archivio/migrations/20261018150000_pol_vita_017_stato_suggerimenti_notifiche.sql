-- POL-VITA-017 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- 1) Stato delle cartelle (aperta, in attesa, chiusa) con la data del cambio.
-- 2) Cartelle suggerite: cartelle diverse con lo stesso dominio del mittente (es. due persone di
--    prelios.com per la stessa pratica Kerdos) → proposta di unirle; i suggerimenti scartati restano scartati.
-- 3) Notifiche sul telefono (web push): iscrizioni dei dispositivi di Luca, chiavi del server
--    (create e lette solo dalla funzione `notifiche-personal`, mai dall'app) e promemoria già notificati.
-- Solo aggiunte idempotenti. ROLLBACK: nessuno necessario; eventuale rimozione solo con conferma del PO.

-- 1) Stato
alter table cartelle_ente add column if not exists stato text;
alter table cartelle_ente add column if not exists stato_dal timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cartelle_ente_stato_valido') then
    alter table cartelle_ente add constraint cartelle_ente_stato_valido check (stato is null or stato in ('aperta', 'in_attesa', 'chiusa'));
  end if;
end $$;

create or replace view v_cartelle with (security_invoker = true) as
select d.ente,
       count(*)::int as n,
       count(*) filter (where d.rilevanza is distinct from 'bassa')::int as n_utili,
       min(coalesce(d.data_documento, d.email_data::date)) as dal,
       max(coalesce(d.data_documento, d.email_data::date)) as al,
       mode() within group (order by d.fascicolo) as fascicolo,
       count(*) filter (where d.azione_richiesta)::int as n_da_fare,
       count(*) filter (where d.da_analizzare)::int as n_da_analizzare,
       sum(d.importo) as totale,
       count(distinct d.email_mittente)::int as n_contatti,
       c.etichette, c.note, c.sintesi, c.sintesi_il,
       (select count(*)::int from scadenze s where not s.completata
          and (s.cartella = d.ente or s.documento_id in (select x.id from documenti x where x.ente = d.ente))) as n_promemoria,
       c.stato, c.stato_dal
from documenti d
left join cartelle_ente c on c.ente = d.ente
where d.ente is not null and d.fascicolo <> 'clinico_pazienti'
group by d.ente, c.etichette, c.note, c.sintesi, c.sintesi_il, c.stato, c.stato_dal;
revoke all on v_cartelle from anon;

-- 2) Suggerimenti
create table if not exists suggerimenti_ignorati (
  chiave    text primary key,
  creato_il timestamptz not null default now()
);
alter table suggerimenti_ignorati enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'suggerimenti_ignorati' and policyname = 'proprietario') then
    create policy proprietario on suggerimenti_ignorati for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on suggerimenti_ignorati from authenticated;
revoke all on suggerimenti_ignorati from anon;

create or replace view v_suggerimenti_cartelle with (security_invoker = true) as
with per_dominio as (
  select lower(substring(d.email_mittente from '@([A-Za-z0-9.-]+\.[A-Za-z]{2,})')) as dominio, d.ente, count(*)::int as n
  from documenti d
  where d.ente is not null and d.fascicolo <> 'clinico_pazienti' and d.email_mittente like '%@%'
  group by 1, 2
)
select 'dominio:' || p.dominio as chiave, p.dominio,
       array_agg(p.ente order by p.n desc) as enti,
       sum(p.n)::int as n
from per_dominio p
where p.dominio is not null
  and p.dominio !~ '(^|\.)(gmail|googlemail|libero|hotmail|outlook|live|msn|icloud|me|mac|yahoo|ymail|alice|tim|tin|tiscali|virgilio|fastwebnet|email|inwind|aruba|pec|legalmail|postecert|poste|vodafone|wind|iol|katamail|jumpy)\.[a-z.]+$'
  and not exists (select 1 from suggerimenti_ignorati i where i.chiave = 'dominio:' || p.dominio)
group by p.dominio
having count(*) between 2 and 8;
revoke all on v_suggerimenti_cartelle from anon;

-- 3) Notifiche sul telefono
create table if not exists push_iscrizioni (
  id           uuid primary key default gen_random_uuid(),
  endpoint     text not null unique,
  chiavi       jsonb not null,
  dispositivo  text,
  attiva       boolean not null default true,
  creata_il    timestamptz not null default now(),
  ultimo_invio timestamptz
);
alter table push_iscrizioni enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_iscrizioni' and policyname = 'proprietario') then
    create policy proprietario on push_iscrizioni for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on push_iscrizioni from authenticated;
revoke all on push_iscrizioni from anon;

-- Chiavi VAPID del server: nessuna policy, quindi nessun accesso dall'app; solo la funzione (service role).
create table if not exists push_chiavi (
  id        int primary key check (id = 1),
  pubblica  text not null,
  privata   text not null,
  creata_il timestamptz not null default now()
);
alter table push_chiavi enable row level security;
revoke all on push_chiavi from anon, authenticated;

-- Promemoria già notificati (una sola notifica al giorno per promemoria).
create table if not exists push_inviate (
  scadenza_id uuid not null,
  giorno      date not null,
  inviata_il  timestamptz not null default now(),
  primary key (scadenza_id, giorno)
);
alter table push_inviate enable row level security;
revoke all on push_inviate from anon, authenticated;
