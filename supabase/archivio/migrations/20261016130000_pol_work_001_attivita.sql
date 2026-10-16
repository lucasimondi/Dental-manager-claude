-- POL-WORK-001: activity records belong only to the authenticated Personal account.
create table if not exists public.attivita_esterne (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 titolo text not null check (char_length(btrim(titolo)) between 1 and 240),
 origine text not null default 'work_manuale' check (origine in ('api','work_manuale','browser_agent')),
 stato text not null default 'in_attesa' check (stato in ('in_attesa','in_corso','richiede_conferma','completata','errore')),
 prova text,
 risultato text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.attivita_esterne enable row level security;
create policy "attivita_select_own" on public.attivita_esterne for select to authenticated using (user_id = (select auth.uid()));
create policy "attivita_insert_own" on public.attivita_esterne for insert to authenticated with check (user_id = (select auth.uid()));
create policy "attivita_update_own" on public.attivita_esterne for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists attivita_esterne_owner_updated on public.attivita_esterne(user_id, updated_at desc);
revoke all on public.attivita_esterne from anon;
grant select, insert, update on public.attivita_esterne to authenticated;
