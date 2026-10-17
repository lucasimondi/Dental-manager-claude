-- POL-VITA-013 — eventi di Poliedron Personal nascondibili dall'agenda dello studio.
-- Richiesta PO: "quello che inserisco nel personale si aggiunga a studio, con tastino di
-- deselezione se non voglio che si veda". Solo aggiunta: default true = comportamento attuale
-- (ogni impegno resta visibile nello studio). Nessuna modifica a RLS o a dati esistenti.
-- ROLLBACK (solo con conferma del PO): alter table public.impegni_personali drop column if exists visibile_studio;
alter table public.impegni_personali add column if not exists visibile_studio boolean not null default true;
comment on column public.impegni_personali.visibile_studio is 'false = evento visibile solo in Poliedron Personal, nascosto nell''agenda dello studio.';
