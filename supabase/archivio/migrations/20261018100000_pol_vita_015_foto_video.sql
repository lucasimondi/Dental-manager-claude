-- POL-VITA-015 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Area Foto e video di Poliedron Personal (PO 2026-10-18: "Dobbiamo fare una area foto e video e
-- catalogare bene"): album e luogo di ogni foto o video. Solo aggiunte idempotenti.
-- ROLLBACK (solo con conferma del PO): alter table documenti drop column if exists album, drop column if exists luogo;
alter table documenti add column if not exists album text;
alter table documenti add column if not exists luogo text;
create index if not exists documenti_album_idx on documenti (album) where album is not null;
