-- Disposable local-only seed for the POL-003F shadow reconciliation.
INSERT INTO public.spese(id,studio_id,data,importo,tipo_costo,ricorrente,frequenza,data_fine) VALUES
 (5901,'59000000-0000-4000-8000-000000000001','2025-01-10',100,'fisso',false,NULL,NULL),
 (5902,'59000000-0000-4000-8000-000000000001','2025-01-01',300,'fisso',true,'Mensile','2025-03-31'),
 (5903,'59000000-0000-4000-8000-000000000001','2025-02-01',120,'variabile',true,'Bimestrale','2025-03-31'),
 (5910,'59100000-0000-4000-8000-000000000001','2025-01-10',777,'fisso',false,NULL,NULL);
INSERT INTO public.personale(id,studio_id,costo_mensile,attivo,data_inizio) VALUES
 (5921,'59000000-0000-4000-8000-000000000001',1000,true,'2025-02-01');
INSERT INTO public.financial_personnel_cost_versions_v1(
 studio_id,personnel_id,valid_from,monthly_cost,authority_ref
) VALUES
 ('59000000-0000-4000-8000-000000000001',5921,'2025-02-01',1000,'synthetic-shadow-contract-v1');
INSERT INTO public.macchinari(id,studio_id,costo_acquisto,data_acquisto,anni_ammortamento,attivo) VALUES
 (5931,'59000000-0000-4000-8000-000000000001',12000,'2024-01-01',5,true);
INSERT INTO public.studio_info(studio_id,config_orario) VALUES
 ('59000000-0000-4000-8000-000000000001','{"giorni_settimana":5,"ore_al_giorno":8,"num_postazioni":2}');
INSERT INTO public.appointments(id,studio_id,data,stato,durata) VALUES
 (5941,'59000000-0000-4000-8000-000000000001','2025-02-10','confermato',60);
SELECT * FROM private.run_pol_003f_costs_hours_adapter_v1(
 '59000000-0000-4000-8000-000000000001','2025-01-01','2025-03-31');
