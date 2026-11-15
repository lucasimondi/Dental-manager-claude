-- Rinomina dei file su Drive dopo il cambio di titolo nell'archivio (2026-11-15, Luca:
-- "Rinomina anche i file su drive"). Additiva e idempotente.
alter table public.documenti add column if not exists drive_rinomina boolean not null default false;
create index if not exists documenti_drive_rinomina_idx on public.documenti (drive_rinomina) where drive_rinomina;
