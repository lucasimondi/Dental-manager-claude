-- Synthetic database only. Never run this fixture on a linked/production project.
create table public.appointments (id bigint primary key, studio_id text not null, data date not null);
create table public.impegni_personali (id bigint primary key, studio_id text not null, data_inizio date not null, visibile_studio boolean not null default true);
insert into public.appointments values (1,'a','2020-01-01'),(2,'b','2020-01-01');
insert into public.impegni_personali values (1,'a','2020-01-01',true),(2,'a','2020-01-01',false),(3,'b','2020-01-01',true);
-- Representative tenant policies verify this additive DDL leaves policy definitions unchanged.
alter table public.appointments enable row level security;
alter table public.impegni_personali enable row level security;
create role agenda_test_user nologin;
grant usage on schema public to agenda_test_user;
grant select,insert,update on public.appointments,public.impegni_personali to agenda_test_user;
create policy tenant_appointments on public.appointments to agenda_test_user
  using (studio_id = current_setting('test.studio_id',true))
  with check (studio_id = current_setting('test.studio_id',true));
create policy tenant_events on public.impegni_personali to agenda_test_user
  using (studio_id = current_setting('test.studio_id',true))
  with check (studio_id = current_setting('test.studio_id',true));
create temp table policies_before as select * from pg_policies where tablename in ('appointments','impegni_personali');
