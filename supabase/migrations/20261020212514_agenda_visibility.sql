-- AGENDA-CONDIVISA: additive presentation settings, no copies of events.
-- Defaults apply equally to all historical rows and future inserts.
-- Preserve previously explicit visibile_studio=false exclusions.
alter table public.appointments
  add column if not exists visibile_studio boolean not null default true,
  add column if not exists visibile_personal boolean not null default true;
alter table public.impegni_personali
  add column if not exists visibile_personal boolean not null default true;
comment on column public.appointments.visibile_studio is 'Presentation only: show this canonical appointment in Studio.';
comment on column public.appointments.visibile_personal is 'Presentation only: show this canonical appointment in Personal.';
comment on column public.impegni_personali.visibile_personal is 'Presentation only: show this canonical event in Personal.';
-- Rollback: revert frontend; keep additive columns to preserve user choices.
