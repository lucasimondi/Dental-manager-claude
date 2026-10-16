-- POL-VITA-007 — progetto separato `archivio-documenti` (tkcwvjzjkfhcuebrjvsp).
-- Catalogazione migliore: nuove categorie per ciò che finiva in "Altro" (pubblicità, formazione,
-- candidature, foto e video, corrispondenza personale), importanza del documento (le cose poco
-- utili si nascondono), ente principale (fornitore, ufficio, banca…) per cercare e sfogliare.
-- Il riordino dello script conserva titolo e fascicolo di prima (titolo_originale,
-- fascicolo_originale): nessun dato si perde.
-- Solo aggiunte idempotenti. ROLLBACK: nessuno necessario; rimozione solo con conferma del PO.
insert into fascicoli (codice, nome, ordine) values
  ('formazione', 'Formazione e congressi', 17),
  ('personale_studio', 'Studio - personale e candidature', 18),
  ('corrispondenza', 'Corrispondenza personale', 19),
  ('foto_video', 'Foto e video', 20),
  ('pubblicita', 'Pubblicità e offerte', 21)
on conflict (codice) do nothing;

alter table documenti add column if not exists rilevanza text;
alter table documenti add column if not exists ente text;
alter table documenti add column if not exists riordinato_il timestamptz;
alter table documenti add column if not exists titolo_originale text;
alter table documenti add column if not exists fascicolo_originale text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documenti_rilevanza_check') then
    alter table documenti add constraint documenti_rilevanza_check check (rilevanza is null or rilevanza in ('alta', 'normale', 'bassa'));
  end if;
end $$;
create index if not exists documenti_ente_idx on documenti (ente) where ente is not null;
create index if not exists documenti_rilevanza_idx on documenti (rilevanza);
create index if not exists documenti_da_riordinare_idx on documenti (email_data) where riordinato_il is null;

-- Enti con quanti documenti e l'ultimo arrivato (mai i pazienti).
create or replace view v_enti with (security_invoker = true) as
select d.ente,
       count(*)::int as n,
       max(coalesce(d.data_documento, d.email_data::date)) as ultimo,
       mode() within group (order by d.fascicolo) as fascicolo
from documenti d
where d.ente is not null and d.fascicolo <> 'clinico_pazienti'
group by d.ente;
revoke all on v_enti from anon;
