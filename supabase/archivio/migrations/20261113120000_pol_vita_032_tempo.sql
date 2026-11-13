-- POL-VITA-032 ARCHIVIO-TEMPO (PO 2026-11-13: "Vai con punti due e tre").
-- Conteggi dei documenti per mese e categoria, per la linea del tempo dell'app (vista «Anni» e
-- elenco dei mesi). Solo una vista, con la RLS di chi legge; esclusi i documenti dei pazienti e
-- quelli poco utili. Nessun dato nuovo, nessuna modifica alle tabelle.
create or replace view v_tempo_mesi with (security_invoker = true) as
select date_trunc('month', coalesce(d.data_documento, d.email_data::date))::date as mese,
       d.fascicolo,
       count(*)::integer as n
from documenti d
where coalesce(d.data_documento, d.email_data::date) is not null
  and d.fascicolo is distinct from 'clinico_pazienti'
  and (d.rilevanza is null or d.rilevanza <> 'bassa')
group by 1, 2;
revoke all on v_tempo_mesi from anon;
grant select on v_tempo_mesi to authenticated;
