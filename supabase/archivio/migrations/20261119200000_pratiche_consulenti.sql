-- PRATICHE-CONSULENTI (PO 2026-11-19: "Metti anche lo spazio per inserire i consulenti che se ne occupano con
-- i contatti per ogni pratica e che vengano poi inseriti anche gli scambi di mail dentro la scheda pratica").
-- Solo aggiunte.
--  * pratiche_consulenti: chi segue la pratica (avvocato, commercialista, perito…) con i contatti.
--    Non si cancella: «Togli» mette tolto_il e la riga sparisce dall'app.
--  * email_pratica(p): le conversazioni email della pratica, una riga per conversazione Gmail:
--    quelle dei documenti della pratica e quelle in archivio con un consulente della pratica come mittente.
--    Mai i documenti dei pazienti.

create table if not exists pratiche_consulenti (
  id            uuid primary key default gen_random_uuid(),
  pratica_id    uuid not null references pratiche(id),
  nome          text not null check (length(btrim(nome)) between 1 and 120),
  ruolo         text,
  studio        text,
  email         text,
  pec           text,
  telefono      text,
  note          text,
  creato_il     timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  tolto_il      timestamptz
);
create index if not exists pratiche_consulenti_pratica on pratiche_consulenti (pratica_id) where tolto_il is null;

alter table pratiche_consulenti enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pratiche_consulenti' and policyname = 'proprietario') then
    create policy proprietario on pratiche_consulenti for all to authenticated
      using ((select e_proprietario())) with check ((select e_proprietario()));
  end if;
end $$;
revoke truncate, references, trigger on pratiche_consulenti from authenticated;
revoke all on pratiche_consulenti from anon;

-- Nome ripulito, indirizzi in minuscolo e senza spazi, data di modifica.
create or replace function pratiche_consulenti_pulisci()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.pec := nullif(lower(btrim(coalesce(new.pec, ''))), '');
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.modificato_il := now();
  return new;
end $$;
drop trigger if exists pratiche_consulenti_pulisci on pratiche_consulenti;
create trigger pratiche_consulenti_pulisci before insert or update on pratiche_consulenti
  for each row execute function pratiche_consulenti_pulisci();

-- Conversazioni della pratica. security invoker: valgono le RLS di documenti e pratiche_consulenti.
create or replace function email_pratica(p_pratica uuid)
returns table (
  thread_id        text,
  oggetto          text,
  mittenti         text[],
  prima            timestamptz,
  ultima           timestamptz,
  ultimo_messaggio text,
  n_documenti      integer,
  documento_email  uuid,
  in_pratica       boolean,
  da_consulente    boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with indirizzi as (
    select distinct a from pratiche_consulenti c,
      lateral unnest(array[c.email, c.pec]) a
    where c.pratica_id = p_pratica and c.tolto_il is null and a is not null and a like '%@%'
  ),
  scelti as (
    select d.*,
           d.pratica_id = p_pratica as della_pratica,
           exists (select 1 from indirizzi i where position(i.a in lower(coalesce(d.email_mittente, ''))) > 0) as dal_consulente
    from documenti d
    where d.gmail_thread_id is not null
      and d.fascicolo is distinct from 'clinico_pazienti'
      and (d.pratica_id = p_pratica
           or exists (select 1 from indirizzi i where position(i.a in lower(coalesce(d.email_mittente, ''))) > 0))
  )
  select s.gmail_thread_id,
         (array_agg(s.email_oggetto order by s.email_data desc nulls last))[1],
         array_remove(array_agg(distinct s.email_mittente), null),
         min(s.email_data),
         max(s.email_data),
         (array_agg(s.gmail_message_id order by s.email_data desc nulls last))[1],
         count(*)::integer,
         (array_agg(s.id) filter (where s.mime_type = 'message/rfc822'))[1],
         bool_or(s.della_pratica),
         bool_or(s.dal_consulente)
  from scelti s
  group by s.gmail_thread_id
  order by max(s.email_data) desc nulls last
  limit 300
$$;
revoke all on function email_pratica(uuid) from public, anon;
grant execute on function email_pratica(uuid) to authenticated;
