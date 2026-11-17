-- DOCUMENTI-FIRMATI (PO 2026-11-17): "I documenti firmati devono poter essere salvati in cartella drive
-- Documenti Firmati […] Deve esserci una sottosezione in documenti che si chiama documenti firmati
-- esattamente come in drive […] possibilità di salvarlo in cartelle di drive eventualmente creandone
-- di nuove che vanno sia in poliedron sia in drive".
-- Solo aggiunte:
--  * cartelle_mie.drive_cartella_id: la cartella di Drive gemella (la crea lo script la prima volta che
--    ci si salva un file; nome e posizione seguono quelli di Poliedron);
--  * cartelle_mie.speciale = 'firmati': la cartella «Documenti firmati», una sola;
--  * documenti.drive_fissa: il file sta nella cartella scelta da Luca, lo script non lo sposta
--    (ordinaDrive_) e non lo rinomina.

alter table cartelle_mie add column if not exists drive_cartella_id text;
alter table cartelle_mie add column if not exists speciale text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cartelle_mie_speciale_valida') then
    alter table cartelle_mie add constraint cartelle_mie_speciale_valida check (speciale is null or speciale in ('firmati'));
  end if;
end $$;
create unique index if not exists cartelle_mie_drive_unica on cartelle_mie (drive_cartella_id) where drive_cartella_id is not null;
create unique index if not exists cartelle_mie_speciale_unica on cartelle_mie (speciale) where speciale is not null;

alter table documenti add column if not exists drive_fissa boolean not null default false;

-- La cartella «Documenti firmati» esiste da subito (vuota), così la sezione dell'app la trova.
insert into cartelle_mie (nome, speciale)
select 'Documenti firmati', 'firmati'
where not exists (select 1 from cartelle_mie where speciale = 'firmati');

-- Stessa vista di POL-VITA-031 con le due colonne nuove in fondo.
create or replace view v_cartelle_mie with (security_invoker = true) as
select c.id, c.nome, c.padre_id, c.colore, c.posizione, c.creato_il, c.modificato_il, c.archiviata_il,
       (select count(*) from cartelle_mie_documenti cd where cd.cartella_id = c.id) as n_documenti,
       (select count(*) from cartelle_mie s where s.padre_id = c.id and s.archiviata_il is null) as n_sottocartelle,
       c.drive_cartella_id, c.speciale
from cartelle_mie c;
revoke all on v_cartelle_mie from anon;
grant select on v_cartelle_mie to authenticated;
