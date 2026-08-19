-- Synthetic-only setup for exercising the read-only shadow report.
-- Run only against the disposable POL-003D local database.
INSERT INTO public.plans VALUES
  (3301,'33000000-0000-4000-8000-000000000001',33001,'2025-02-01',
   '[{"prestazione":"Synthetic A","prezzo":100,"eseguita":true,"dataEsec":"2025-02-10"},{"prestazione":"Synthetic B","prezzo":200,"eseguita":true,"dataEsec":"2025-02-11"}]',
   'attivo',30,'eur'),
  (3401,'34000000-0000-4000-8000-000000000001',34001,'2025-02-01',
   '[{"prestazione":"Synthetic tenant B","prezzo":999,"eseguita":true,"dataEsec":"2025-02-10"}]',
   'attivo',0,'pct');

INSERT INTO public.payments VALUES
  (3311,'33000000-0000-4000-8000-000000000001',33001,'2025-02-12',150,'pagato'),
  (3411,'34000000-0000-4000-8000-000000000001',34001,'2025-02-12',999,'pagato');

SELECT * FROM private.run_pol_003b_legacy_adapter_v1('33000000-0000-4000-8000-000000000001');
SELECT * FROM private.run_pol_003b_legacy_adapter_v1('34000000-0000-4000-8000-000000000001');
