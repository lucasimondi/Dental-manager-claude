-- Run after fixture + the additive migration, in an isolated PostgreSQL 17 database.
do $$
begin
  if exists(select 1 from public.appointments where not visibile_studio or not visibile_personal) then
    raise exception 'Historical appointment defaults failed';
  end if;
  if exists(select 1 from public.impegni_personali where not visibile_personal) then
    raise exception 'Historical event defaults failed';
  end if;
  if (select visibile_studio from public.impegni_personali where id=2) is distinct from false then
    raise exception 'Explicit old Studio exclusion was lost';
  end if;
  if exists((select * from policies_before except select * from pg_policies where tablename in ('appointments','impegni_personali'))
    union all (select * from pg_policies where tablename in ('appointments','impegni_personali') except select * from policies_before)) then
    raise exception 'Migration changed tenant policies';
  end if;
end $$;
set role agenda_test_user;
set test.studio_id='a';
do $$
begin
  if (select count(*) from public.appointments) <> 1 then raise exception 'Cross-tenant read'; end if;
  if exists(select 1 from public.appointments where studio_id='b') then raise exception 'Foreign studio visible'; end if;
  update public.appointments set visibile_personal=false where id=1;
  if (select visibile_personal from public.appointments where id=1) is distinct from false then raise exception 'Choice not persisted'; end if;
  if (select visibile_studio from public.appointments where id=1) is distinct from true then raise exception 'Other agenda changed'; end if;
  update public.appointments set visibile_studio=false where id=2;
  insert into public.appointments(id,studio_id,data) values(3,'a','2026-11-01');
  if exists(select 1 from public.appointments where id=3 and (not visibile_studio or not visibile_personal)) then raise exception 'New defaults failed'; end if;
end $$;
reset role;
do $$
begin
  if (select visibile_studio from public.appointments where id=2) is distinct from true then raise exception 'Foreign tenant modified'; end if;
end $$;
