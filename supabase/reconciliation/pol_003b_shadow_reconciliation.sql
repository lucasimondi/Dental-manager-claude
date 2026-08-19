-- POL-003B production shadow reconciliation (READ ONLY, aggregate-only).
-- Supply approved psql variables: studio_id, date_from, date_to.
BEGIN TRANSACTION READ ONLY;
WITH params AS (SELECT :'studio_id'::uuid studio_id,:'date_from'::date date_from,:'date_to'::date date_to),
legacy_lines AS (
 SELECT p.studio_id,p.data proposal_date,p.sconto,p.sconto_tipo,v.item,(v.item->>'prezzo')::numeric gross_amount,
 sum((v.item->>'prezzo')::numeric) OVER(PARTITION BY p.studio_id,p.id) gross_total
 FROM public.plans p JOIN params x ON x.studio_id=p.studio_id CROSS JOIN LATERAL jsonb_array_elements(p.voci) v(item)
 WHERE jsonb_typeof(p.voci)='array' AND coalesce(v.item->>'prezzo','')~'^([0-9]+)([.][0-9]+)?$'),
legacy_values AS (
 SELECT *,gross_amount-GREATEST(0,LEAST(gross_amount,CASE lower(coalesce(sconto_tipo,''))
 WHEN 'pct' THEN gross_amount*coalesce(sconto,0)/100 WHEN 'percent' THEN gross_amount*coalesce(sconto,0)/100
 WHEN 'fixed' THEN CASE WHEN gross_total=0 THEN 0 ELSE coalesce(sconto,0)*gross_amount/gross_total END
 WHEN 'fisso' THEN CASE WHEN gross_total=0 THEN 0 ELSE coalesce(sconto,0)*gross_amount/gross_total END ELSE 0 END)) net_amount FROM legacy_lines),
legacy AS (
 SELECT coalesce(sum(net_amount)FILTER(WHERE proposal_date BETWEEN x.date_from AND x.date_to),0) preventivato,NULL::numeric accettato,
 coalesce(sum(net_amount)FILTER(WHERE coalesce((item->>'eseguita')::boolean,false) AND coalesce(item->>'dataEsec','')~'^([0-9]{4})-([0-9]{2})-([0-9]{2})$' AND (item->>'dataEsec')::date BETWEEN x.date_from AND x.date_to),0) prodotto
 FROM params x LEFT JOIN legacy_values ON true GROUP BY x.date_from,x.date_to),
legacy_cash AS (SELECT coalesce(sum(p.importo),0) incassato FROM public.payments p JOIN params x ON x.studio_id=p.studio_id WHERE lower(coalesce(p.stato,''))='pagato' AND p.importo>0 AND p.data BETWEEN x.date_from AND x.date_to),
canonical AS (
 SELECT coalesce((SELECT sum(v.net_amount) FROM private.financial_line_values_v1 v JOIN params x ON x.studio_id=v.studio_id WHERE v.proposal_date BETWEEN x.date_from AND x.date_to),0) preventivato,
 coalesce((SELECT sum(v.net_amount*e.fraction*e.direction) FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id JOIN params x ON x.studio_id=e.studio_id WHERE e.stage='ACCETTATO' AND e.event_date BETWEEN x.date_from AND x.date_to),0) accettato,
 coalesce((SELECT sum(v.net_amount*e.fraction*e.direction) FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id JOIN params x ON x.studio_id=e.studio_id WHERE e.stage='PRODOTTO' AND e.event_date BETWEEN x.date_from AND x.date_to),0) prodotto,
 coalesce((SELECT sum(e.amount*e.direction) FROM public.financial_payment_events_v1 e JOIN params x ON x.studio_id=e.studio_id WHERE (e.event_kind<>'EXTERNAL_PAYMENT' OR e.reconciled) AND e.event_date BETWEEN x.date_from AND x.date_to),0) incassato)
SELECT metric,legacy_value,canonical_value,canonical_value-legacy_value variance,
 CASE WHEN metric='ACCETTATO' THEN 'APPROXIMATION_NOT_ALLOWED' WHEN canonical_value=0 AND legacy_value<>0 THEN 'SEMANTIC_EXPECTED_NOT_ADAPTED' WHEN canonical_value=legacy_value THEN 'MATCH' ELSE 'REVIEW_DATA_QUALITY_OR_ADAPTER' END classification
FROM legacy l CROSS JOIN legacy_cash lc CROSS JOIN canonical c CROSS JOIN LATERAL(VALUES
('PREVENTIVATO',l.preventivato,c.preventivato),('ACCETTATO',l.accettato,c.accettato),('PRODOTTO',l.prodotto,c.prodotto),('INCASSATO',lc.incassato,c.incassato))r(metric,legacy_value,canonical_value)
ORDER BY metric;
ROLLBACK;
