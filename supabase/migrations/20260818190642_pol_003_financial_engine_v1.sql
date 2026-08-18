-- POL-003A — additive canonical financial engine v1 with PO-locked semantics.
-- No legacy adapter, remote application or production rollout is included.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studio_users') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_users'
      AND column_name IN ('user_id', 'studio_id', 'stato')
    GROUP BY table_schema, table_name HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'POL-003A preflight: studio_users(user_id,studio_id,stato) is required';
  END IF;
END
$preflight$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.financial_current_studio_v1()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
  SELECT CASE
    WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (auth.jwt() -> 'app_metadata' ->> 'studio_id')::uuid
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION private.financial_has_tenant_access_v1(p_studio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT auth.uid() IS NOT NULL
    AND p_studio_id IS NOT NULL
    AND p_studio_id = private.financial_current_studio_v1()
    AND EXISTS (
      SELECT 1 FROM public.studio_users su
      WHERE su.user_id = auth.uid() AND su.studio_id = p_studio_id AND su.stato = 'attivo'
    );
$function$;

REVOKE ALL ON FUNCTION private.financial_current_studio_v1() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.financial_has_tenant_access_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.financial_current_studio_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION private.financial_has_tenant_access_v1(uuid) TO authenticated;

CREATE TABLE public.financial_contracts_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  patient_id bigint,
  proposal_date date NOT NULL,
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  discount_kind text NOT NULL DEFAULT 'NONE' CHECK (discount_kind IN ('NONE','PERCENT','FIXED')),
  discount_value numeric(18,6) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_contracts_v1_percent_check CHECK (discount_kind <> 'PERCENT' OR discount_value <= 100),
  CONSTRAINT financial_contracts_v1_none_check CHECK (discount_kind <> 'NONE' OR discount_value = 0),
  CONSTRAINT financial_contracts_v1_source_key UNIQUE (studio_id, source_table, source_id),
  CONSTRAINT financial_contracts_v1_tenant_key UNIQUE (id, studio_id)
);

CREATE TABLE public.financial_contract_lines_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_id bigint NOT NULL,
  patient_id bigint,
  service_ref text,
  operator_ref text,
  gross_amount numeric(18,6) NOT NULL CHECK (gross_amount >= 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  source_line_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_contract_lines_v1_contract_fk FOREIGN KEY (contract_id,studio_id)
    REFERENCES public.financial_contracts_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_contract_lines_v1_source_key UNIQUE (studio_id,source_table,source_id,source_line_id),
  CONSTRAINT financial_contract_lines_v1_tenant_key UNIQUE (id,studio_id)
);

CREATE TABLE public.financial_line_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_line_id bigint NOT NULL,
  stage text NOT NULL CHECK (stage IN ('ACCETTATO','PRODOTTO')),
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1,1)),
  fraction numeric(12,9) NOT NULL CHECK (fraction > 0 AND fraction <= 1),
  event_kind text NOT NULL CHECK (event_kind IN ('ORIGINAL','CANCELLATION','PRODUCTION_REVERSAL')),
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  source_line_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_line_events_v1_kind_check CHECK (
    (event_kind = 'ORIGINAL' AND direction = 1)
    OR (event_kind = 'CANCELLATION' AND stage = 'ACCETTATO' AND direction = -1)
    OR (event_kind = 'PRODUCTION_REVERSAL' AND stage = 'PRODOTTO' AND direction = -1)
  ),
  CONSTRAINT financial_line_events_v1_line_fk FOREIGN KEY (contract_line_id,studio_id)
    REFERENCES public.financial_contract_lines_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_line_events_v1_source_key UNIQUE (studio_id,source_table,source_id)
);

CREATE TABLE public.financial_invoice_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_id bigint,
  contract_line_id bigint,
  patient_id bigint NOT NULL,
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1,1)),
  taxable_amount numeric(18,6) NOT NULL CHECK (taxable_amount >= 0),
  vat_amount numeric(18,6) NOT NULL CHECK (vat_amount >= 0),
  gross_document_amount numeric(18,6) GENERATED ALWAYS AS (taxable_amount + vat_amount) STORED,
  event_kind text NOT NULL CHECK (event_kind IN ('INVOICE','CREDIT_NOTE')),
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  source_line_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_invoice_events_v1_kind_check CHECK (
    (event_kind = 'INVOICE' AND direction = 1) OR (event_kind = 'CREDIT_NOTE' AND direction = -1)
  ),
  CONSTRAINT financial_invoice_events_v1_contract_fk FOREIGN KEY (contract_id,studio_id)
    REFERENCES public.financial_contracts_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_invoice_events_v1_line_fk FOREIGN KEY (contract_line_id,studio_id)
    REFERENCES public.financial_contract_lines_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_invoice_events_v1_source_key UNIQUE (studio_id,source_table,source_id,source_line_id),
  CONSTRAINT financial_invoice_events_v1_tenant_key UNIQUE (id,studio_id)
);

CREATE TABLE public.financial_payment_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_id bigint,
  patient_id bigint NOT NULL,
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1,1)),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  event_kind text NOT NULL CHECK (event_kind IN ('PAYMENT','REFUND','EXTERNAL_PAYMENT')),
  reconciled boolean NOT NULL DEFAULT true,
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_payment_events_v1_kind_check CHECK (
    (event_kind IN ('PAYMENT','EXTERNAL_PAYMENT') AND direction = 1)
    OR (event_kind = 'REFUND' AND direction = -1)
  ),
  CONSTRAINT financial_payment_events_v1_external_check CHECK (
    event_kind = 'EXTERNAL_PAYMENT' OR reconciled
  ),
  CONSTRAINT financial_payment_events_v1_contract_fk FOREIGN KEY (contract_id,studio_id)
    REFERENCES public.financial_contracts_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_payment_events_v1_source_key UNIQUE (studio_id,source_table,source_id),
  CONSTRAINT financial_payment_events_v1_tenant_key UNIQUE (id,studio_id)
);

CREATE TABLE public.financial_payment_allocations_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  payment_event_id bigint NOT NULL,
  invoice_event_id bigint,
  contract_id bigint,
  contract_line_id bigint,
  allocation_method text NOT NULL CHECK (allocation_method = 'EXPLICIT'),
  amount numeric(18,6) NOT NULL CHECK (amount > 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_payment_allocations_v1_target_check CHECK (
    invoice_event_id IS NOT NULL OR contract_id IS NOT NULL OR contract_line_id IS NOT NULL
  ),
  CONSTRAINT financial_payment_allocations_v1_payment_fk FOREIGN KEY (payment_event_id,studio_id)
    REFERENCES public.financial_payment_events_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_payment_allocations_v1_invoice_fk FOREIGN KEY (invoice_event_id,studio_id)
    REFERENCES public.financial_invoice_events_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_payment_allocations_v1_contract_fk FOREIGN KEY (contract_id,studio_id)
    REFERENCES public.financial_contracts_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_payment_allocations_v1_line_fk FOREIGN KEY (contract_line_id,studio_id)
    REFERENCES public.financial_contract_lines_v1(id,studio_id) ON DELETE RESTRICT,
  CONSTRAINT financial_payment_allocations_v1_source_key UNIQUE (studio_id,source_table,source_id)
);

CREATE TABLE public.financial_cost_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('PREVISTO','IMPEGNATO','SOSTENUTO')),
  classification text NOT NULL CHECK (classification IN (
    'VARIABILE_ATTRIBUIBILE','FISSO_OPERATIVO','AMMORTAMENTO_DEPREZZAMENTO',
    'INTERESSE','IMPOSTA','STRAORDINARIO'
  )),
  cost_scope text NOT NULL CHECK (cost_scope IN ('STRUCTURE','OPERATOR')),
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1,1)),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  patient_id bigint,
  service_ref text,
  operator_ref text,
  cost_version_ref text NOT NULL,
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_cost_events_v1_operator_check CHECK (
    cost_scope = 'STRUCTURE' OR operator_ref IS NOT NULL
  ),
  CONSTRAINT financial_cost_events_v1_source_key UNIQUE (studio_id,source_table,source_id)
);

CREATE TABLE public.financial_hours_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  event_date date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('STRUCTURE','OPERATOR')),
  hour_kind text NOT NULL CHECK (hour_kind IN ('AVAILABLE','WORKED')),
  operator_ref text,
  hours numeric(14,6) NOT NULL CHECK (hours >= 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_hours_v1_operator_check CHECK (
    (scope = 'STRUCTURE' AND operator_ref IS NULL)
    OR (scope = 'OPERATOR' AND operator_ref IS NOT NULL)
  ),
  CONSTRAINT financial_hours_v1_source_key UNIQUE (studio_id,source_table,source_id)
);

CREATE OR REPLACE FUNCTION private.validate_financial_allocation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_payment public.financial_payment_events_v1%ROWTYPE;
  v_invoice public.financial_invoice_events_v1%ROWTYPE;
  v_payment_allocated numeric;
  v_invoice_allocated numeric;
BEGIN
  SELECT * INTO v_payment FROM public.financial_payment_events_v1
    WHERE id=NEW.payment_event_id AND studio_id=NEW.studio_id;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'POL-003A: allocation payment mismatch';
  END IF;
  IF NEW.invoice_event_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.financial_invoice_events_v1
      WHERE id=NEW.invoice_event_id AND studio_id=NEW.studio_id;
    IF v_invoice.id IS NULL OR v_payment.patient_id<>v_invoice.patient_id OR v_invoice.event_kind<>'INVOICE' THEN
      RAISE EXCEPTION 'POL-003A: allocation tenant/patient/invoice mismatch';
    END IF;
  ELSIF NEW.contract_line_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_contract_lines_v1 l
    JOIN public.financial_contracts_v1 c ON c.id=l.contract_id AND c.studio_id=l.studio_id
    WHERE l.id=NEW.contract_line_id AND l.studio_id=NEW.studio_id
      AND COALESCE(l.patient_id,c.patient_id)=v_payment.patient_id
  ) THEN
    RAISE EXCEPTION 'POL-003A: allocation tenant/patient/line mismatch';
  ELSIF NEW.contract_line_id IS NULL AND NEW.contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_contracts_v1 c
    WHERE c.id=NEW.contract_id AND c.studio_id=NEW.studio_id AND c.patient_id=v_payment.patient_id
  ) THEN
    RAISE EXCEPTION 'POL-003A: allocation tenant/patient/contract mismatch';
  END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_payment_allocated
  FROM public.financial_payment_allocations_v1
  WHERE payment_event_id=NEW.payment_event_id AND studio_id=NEW.studio_id;
  IF v_payment_allocated>v_payment.amount THEN
    RAISE EXCEPTION 'POL-003A: allocations exceed payment/refund amount';
  END IF;
  IF NEW.invoice_event_id IS NOT NULL THEN
    SELECT COALESCE(SUM(a.amount*p.direction),0) INTO v_invoice_allocated
    FROM public.financial_payment_allocations_v1 a
    JOIN public.financial_payment_events_v1 p ON p.id=a.payment_event_id AND p.studio_id=a.studio_id
    WHERE a.invoice_event_id=NEW.invoice_event_id AND a.studio_id=NEW.studio_id;
    IF v_invoice_allocated>v_invoice.gross_document_amount THEN
      RAISE EXCEPTION 'POL-003A: allocations exceed invoice gross amount';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.validate_financial_allocation_v1() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER financial_payment_allocations_v1_validate
AFTER INSERT OR UPDATE ON public.financial_payment_allocations_v1
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW
EXECUTE FUNCTION private.validate_financial_allocation_v1();

CREATE INDEX financial_contracts_v1_studio_date_idx ON public.financial_contracts_v1(studio_id,proposal_date);
CREATE INDEX financial_contract_lines_v1_studio_contract_idx ON public.financial_contract_lines_v1(studio_id,contract_id);
CREATE INDEX financial_line_events_v1_studio_stage_date_idx ON public.financial_line_events_v1(studio_id,stage,event_date);
CREATE INDEX financial_line_events_v1_line_idx ON public.financial_line_events_v1(contract_line_id,studio_id);
CREATE INDEX financial_invoice_events_v1_studio_patient_date_idx ON public.financial_invoice_events_v1(studio_id,patient_id,event_date,id);
CREATE INDEX financial_invoice_events_v1_contract_idx ON public.financial_invoice_events_v1(contract_id,studio_id);
CREATE INDEX financial_payment_events_v1_studio_patient_date_idx ON public.financial_payment_events_v1(studio_id,patient_id,event_date,id);
CREATE INDEX financial_payment_events_v1_contract_idx ON public.financial_payment_events_v1(contract_id,studio_id);
CREATE INDEX financial_payment_allocations_v1_payment_idx ON public.financial_payment_allocations_v1(payment_event_id,studio_id);
CREATE INDEX financial_payment_allocations_v1_invoice_idx ON public.financial_payment_allocations_v1(invoice_event_id,studio_id);
CREATE INDEX financial_cost_events_v1_studio_stage_date_idx ON public.financial_cost_events_v1(studio_id,stage,event_date);
CREATE INDEX financial_hours_v1_studio_kind_date_idx ON public.financial_hours_v1(studio_id,hour_kind,event_date);

ALTER TABLE public.financial_contracts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_contract_lines_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_line_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoice_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_allocations_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_hours_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_contracts_v1_select ON public.financial_contracts_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_contract_lines_v1_select ON public.financial_contract_lines_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_line_events_v1_select ON public.financial_line_events_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_invoice_events_v1_select ON public.financial_invoice_events_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_payment_events_v1_select ON public.financial_payment_events_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_payment_allocations_v1_select ON public.financial_payment_allocations_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_cost_events_v1_select ON public.financial_cost_events_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_hours_v1_select ON public.financial_hours_v1 FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));

REVOKE ALL ON TABLE public.financial_contracts_v1,public.financial_contract_lines_v1,
  public.financial_line_events_v1,public.financial_invoice_events_v1,
  public.financial_payment_events_v1,public.financial_payment_allocations_v1,
  public.financial_cost_events_v1,public.financial_hours_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.financial_contracts_v1,public.financial_contract_lines_v1,
  public.financial_line_events_v1,public.financial_invoice_events_v1,
  public.financial_payment_events_v1,public.financial_payment_allocations_v1,
  public.financial_cost_events_v1,public.financial_hours_v1 TO authenticated;

CREATE OR REPLACE VIEW private.financial_line_values_v1 WITH (security_invoker=true) AS
WITH totals AS (
  SELECT c.id contract_id,c.studio_id,c.patient_id,c.proposal_date,c.discount_kind,c.discount_value,
         SUM(l.gross_amount) contract_gross_amount
  FROM public.financial_contracts_v1 c JOIN public.financial_contract_lines_v1 l
    ON l.contract_id=c.id AND l.studio_id=c.studio_id
  GROUP BY c.id,c.studio_id,c.patient_id,c.proposal_date,c.discount_kind,c.discount_value
), values AS (
  SELECT l.*,t.patient_id contract_patient_id,t.proposal_date,
    CASE t.discount_kind
      WHEN 'PERCENT' THEN l.gross_amount*t.discount_value/100
      WHEN 'FIXED' THEN CASE WHEN t.contract_gross_amount>0
        THEN LEAST(t.discount_value,t.contract_gross_amount)*l.gross_amount/t.contract_gross_amount ELSE 0 END
      ELSE 0 END allocated_discount
  FROM public.financial_contract_lines_v1 l JOIN totals t
    ON t.contract_id=l.contract_id AND t.studio_id=l.studio_id
)
SELECT id contract_line_id,studio_id,contract_id,COALESCE(patient_id,contract_patient_id) patient_id,
       service_ref,operator_ref,source_table,source_id,source_line_id,proposal_date,gross_amount,
       allocated_discount,gross_amount-allocated_discount net_amount
FROM values;

-- Explicit allocations win. Remaining reconciled positive cash is allocated FIFO
-- to the oldest remaining positive invoice for the same tenant and patient.
CREATE OR REPLACE VIEW private.financial_effective_allocations_v1 WITH (security_invoker=true) AS
WITH explicit AS (
  SELECT a.id allocation_id,a.studio_id,a.payment_event_id,a.invoice_event_id,
         a.amount*p.direction signed_amount,'EXPLICIT'::text allocation_method,
         p.event_date payment_date,i.event_date invoice_date,p.patient_id,
         a.source_table,a.source_id
  FROM public.financial_payment_allocations_v1 a
  JOIN public.financial_payment_events_v1 p ON p.id=a.payment_event_id AND p.studio_id=a.studio_id
  JOIN public.financial_invoice_events_v1 i ON i.id=a.invoice_event_id AND i.studio_id=a.studio_id
  WHERE a.invoice_event_id IS NOT NULL AND p.patient_id=i.patient_id AND i.event_kind='INVOICE'
    AND (p.event_kind<>'EXTERNAL_PAYMENT' OR p.reconciled)
), pay_residual AS (
  SELECT p.*,GREATEST(p.amount-COALESCE(x.allocated,0),0) residual
  FROM public.financial_payment_events_v1 p
  LEFT JOIN (SELECT payment_event_id,studio_id,SUM(amount) allocated
             FROM public.financial_payment_allocations_v1 GROUP BY payment_event_id,studio_id) x
    ON x.payment_event_id=p.id AND x.studio_id=p.studio_id
  WHERE p.direction=1 AND (p.event_kind<>'EXTERNAL_PAYMENT' OR p.reconciled)
), invoice_ranges AS (
  SELECT i.*,
    SUM(gross_document_amount) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id)-gross_document_amount invoice_start,
    SUM(gross_document_amount) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id) invoice_end
  FROM public.financial_invoice_events_v1 i WHERE i.event_kind='INVOICE'
), credit_totals AS (
  SELECT studio_id,patient_id,SUM(gross_document_amount) credit_total
  FROM public.financial_invoice_events_v1 WHERE event_kind='CREDIT_NOTE' GROUP BY studio_id,patient_id
), inv_residual AS (
  SELECT i.*,
    GREATEST(
      i.gross_document_amount
      - GREATEST(LEAST(i.invoice_end,COALESCE(c.credit_total,0))-i.invoice_start,0)
      - COALESCE(x.allocated,0),0
    ) residual
  FROM invoice_ranges i
  LEFT JOIN credit_totals c ON c.studio_id=i.studio_id AND c.patient_id=i.patient_id
  LEFT JOIN (
    SELECT a.invoice_event_id,a.studio_id,SUM(a.amount*p.direction) allocated
    FROM public.financial_payment_allocations_v1 a
    JOIN public.financial_payment_events_v1 p ON p.id=a.payment_event_id AND p.studio_id=a.studio_id
    GROUP BY a.invoice_event_id,a.studio_id
  ) x ON x.invoice_event_id=i.id AND x.studio_id=i.studio_id
), pay_ranges AS (
  SELECT p.*,
    SUM(residual) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id)-residual range_start,
    SUM(residual) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id) range_end
  FROM pay_residual p WHERE residual>0
), inv_ranges AS (
  SELECT i.*,
    SUM(residual) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id)-residual range_start,
    SUM(residual) OVER (PARTITION BY studio_id,patient_id ORDER BY event_date,id) range_end
  FROM inv_residual i WHERE residual>0
), fifo AS (
  SELECT NULL::bigint allocation_id,p.studio_id,p.id payment_event_id,i.id invoice_event_id,
         LEAST(p.range_end,i.range_end)-GREATEST(p.range_start,i.range_start) signed_amount,
         'FIFO'::text allocation_method,p.event_date payment_date,i.event_date invoice_date,p.patient_id,
         p.source_table,p.source_id
  FROM pay_ranges p JOIN inv_ranges i ON i.studio_id=p.studio_id AND i.patient_id=p.patient_id
  WHERE LEAST(p.range_end,i.range_end)>GREATEST(p.range_start,i.range_start)
)
SELECT * FROM explicit UNION ALL SELECT * FROM fifo;

REVOKE ALL ON TABLE private.financial_line_values_v1,private.financial_effective_allocations_v1 FROM PUBLIC,anon;
GRANT SELECT ON TABLE private.financial_line_values_v1,private.financial_effective_allocations_v1 TO authenticated;

CREATE OR REPLACE FUNCTION public.get_financial_drilldown_v1(
  p_data_inizio date,p_data_fine date,p_metric text
) RETURNS TABLE (
  metric text,source_kind text,source_table text,source_id text,source_line_id text,
  patient_id bigint,operator_ref text,event_date date,amount numeric,formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE v_studio_id uuid:=private.financial_current_studio_v1();
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio>p_data_fine THEN
    RAISE EXCEPTION 'POL-003A: invalid period';
  END IF;
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN RAISE EXCEPTION 'POL-003A: access denied'; END IF;

  IF p_metric IN ('PREVENTIVATO','PREVENTIVATO_LORDO','SCONTO') THEN
    RETURN QUERY SELECT p_metric,'CONTRACT_LINE',v.source_table,v.source_id,v.source_line_id,
      v.patient_id,v.operator_ref,v.proposal_date,
      CASE p_metric WHEN 'PREVENTIVATO_LORDO' THEN v.gross_amount WHEN 'SCONTO' THEN v.allocated_discount ELSE v.net_amount END,
      'POL-003A-v1'
    FROM private.financial_line_values_v1 v WHERE v.studio_id=v_studio_id
      AND v.proposal_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('ACCETTATO','PRODOTTO') THEN
    RETURN QUERY SELECT p_metric,'LINE_EVENT',e.source_table,e.source_id,e.source_line_id,v.patient_id,
      COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
    FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
      ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
    WHERE e.studio_id=v_studio_id AND e.stage=p_metric AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('FATTURATO_NETTO_IVA','FATTURATO_IVA','FATTURATO_LORDO') THEN
    RETURN QUERY SELECT p_metric,'INVOICE_EVENT',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
      CASE p_metric WHEN 'FATTURATO_NETTO_IVA' THEN e.taxable_amount WHEN 'FATTURATO_IVA' THEN e.vat_amount ELSE e.gross_document_amount END*e.direction,
      'POL-003A-v1'
    FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric='INCASSATO' THEN
    RETURN QUERY SELECT p_metric,'PAYMENT_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
      e.amount*e.direction,'POL-003A-v1'
    FROM public.financial_payment_events_v1 e WHERE e.studio_id=v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (e.event_kind<>'EXTERNAL_PAYMENT' OR e.reconciled);
  ELSIF p_metric='INCASSATO_ALLOCATO' THEN
    RETURN QUERY SELECT p_metric,'PAYMENT_ALLOCATION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
      a.signed_amount,'POL-003A-v1'
    FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id
      AND a.payment_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('PORTAFOGLIO_DA_ESEGUIRE','PRODOTTO_DA_FATTURARE','CREDITO_CLIENTI','SALDO_INCASSI_NON_ALLOCATO') THEN
    IF p_metric='PORTAFOGLIO_DA_ESEGUIRE' THEN
      RETURN QUERY SELECT p_metric,'ACCEPTED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='ACCETTATO' AND e.event_date<=p_data_fine;
      RETURN QUERY SELECT p_metric,'PRODUCED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,-v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='PRODOTTO' AND e.event_date<=p_data_fine;
    ELSIF p_metric='PRODOTTO_DA_FATTURARE' THEN
      RETURN QUERY SELECT p_metric,'PRODUCED_STOCK',e.source_table,e.source_id,e.source_line_id,v.patient_id,
        COALESCE(e.operator_ref,v.operator_ref),e.event_date,v.net_amount*e.fraction*e.direction,'POL-003A-v1'
      FROM public.financial_line_events_v1 e JOIN private.financial_line_values_v1 v
        ON v.contract_line_id=e.contract_line_id AND v.studio_id=e.studio_id
      WHERE e.studio_id=v_studio_id AND e.stage='PRODOTTO' AND e.event_date<=p_data_fine;
      RETURN QUERY SELECT p_metric,'INVOICED_STOCK',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
        -e.taxable_amount*e.direction,'POL-003A-v1'
      FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id AND e.event_date<=p_data_fine;
    ELSIF p_metric='CREDITO_CLIENTI' THEN
      RETURN QUERY SELECT p_metric,'INVOICE_RECEIVABLE',e.source_table,e.source_id,e.source_line_id,e.patient_id,e.operator_ref,e.event_date,
        e.gross_document_amount*e.direction,'POL-003A-v1'
      FROM public.financial_invoice_events_v1 e WHERE e.studio_id=v_studio_id AND e.event_date<=p_data_fine;
      RETURN QUERY SELECT p_metric,'ALLOCATED_COLLECTION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
        -a.signed_amount,'POL-003A-v1'
      FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id AND a.payment_date<=p_data_fine;
    ELSE
      RETURN QUERY SELECT p_metric,'PAYMENT_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
        e.amount*e.direction,'POL-003A-v1'
      FROM public.financial_payment_events_v1 e WHERE e.studio_id=v_studio_id AND e.event_date<=p_data_fine
        AND (e.event_kind<>'EXTERNAL_PAYMENT' OR e.reconciled);
      RETURN QUERY SELECT p_metric,'ALLOCATED_COLLECTION',a.source_table,a.source_id,NULL::text,a.patient_id,NULL::text,a.payment_date,
        -a.signed_amount,'POL-003A-v1'
      FROM private.financial_effective_allocations_v1 a WHERE a.studio_id=v_studio_id AND a.payment_date<=p_data_fine;
    END IF;
  ELSIF p_metric IN ('COSTI_PREVISTI','COSTI_IMPEGNATI','COSTI_VARIABILI','COSTI_FISSI_OPERATIVI','COSTI_STRUTTURA_OPERATIVI','COSTI_OPERATORE') THEN
    RETURN QUERY SELECT p_metric,'COST_EVENT',e.source_table,e.source_id,NULL::text,e.patient_id,e.operator_ref,e.event_date,
      e.amount*e.direction,'POL-003A-v1'
    FROM public.financial_cost_events_v1 e WHERE e.studio_id=v_studio_id AND e.event_date BETWEEN p_data_inizio AND p_data_fine AND (
      (p_metric='COSTI_PREVISTI' AND e.stage='PREVISTO') OR
      (p_metric='COSTI_IMPEGNATI' AND e.stage='IMPEGNATO') OR
      (p_metric='COSTI_VARIABILI' AND e.stage='SOSTENUTO' AND e.classification='VARIABILE_ATTRIBUIBILE') OR
      (p_metric='COSTI_FISSI_OPERATIVI' AND e.stage='SOSTENUTO' AND e.classification='FISSO_OPERATIVO') OR
      (p_metric='COSTI_STRUTTURA_OPERATIVI' AND e.stage='SOSTENUTO' AND e.cost_scope='STRUCTURE'
        AND e.classification IN ('VARIABILE_ATTRIBUIBILE','FISSO_OPERATIVO')) OR
      (p_metric='COSTI_OPERATORE' AND e.stage='SOSTENUTO' AND e.cost_scope='OPERATOR'
        AND e.classification IN ('VARIABILE_ATTRIBUIBILE','FISSO_OPERATIVO'))
    );
  ELSIF p_metric IN ('ORE_DISPONIBILI','ORE_EFFETTIVE') THEN
    RETURN QUERY SELECT p_metric,'HOURS',e.source_table,e.source_id,NULL::text,NULL::bigint,e.operator_ref,e.event_date,e.hours,'POL-003A-v1'
    FROM public.financial_hours_v1 e WHERE e.studio_id=v_studio_id AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND ((p_metric='ORE_DISPONIBILI' AND e.hour_kind='AVAILABLE' AND e.scope='STRUCTURE')
        OR (p_metric='ORE_EFFETTIVE' AND e.hour_kind='WORKED'));
  ELSIF p_metric IN ('MARGINE_CONTRIBUZIONE','EBITDA_OPERATIVO_GESTIONALE') THEN
    RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,d.amount,d.formula_version
      FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO') d;
    RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,-d.amount,d.formula_version
      FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_VARIABILI') d;
    IF p_metric='EBITDA_OPERATIVO_GESTIONALE' THEN
      RETURN QUERY SELECT p_metric,d.source_kind,d.source_table,d.source_id,d.source_line_id,d.patient_id,d.operator_ref,d.event_date,-d.amount,d.formula_version
        FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_FISSI_OPERATIVI') d;
    END IF;
  ELSE RAISE EXCEPTION 'POL-003A: unsupported metric %',p_metric;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financial_snapshot_v1(p_data_inizio date,p_data_fine date)
RETURNS TABLE (
  preventivato numeric,preventivato_lordo numeric,sconto numeric,accettato numeric,prodotto numeric,
  fatturato_netto_iva numeric,fatturato_iva numeric,fatturato_lordo numeric,
  incassato numeric,incassato_allocato numeric,portafoglio_da_eseguire numeric,
  prodotto_da_fatturare numeric,credito_clienti numeric,saldo_incassi_non_allocato numeric,
  costi_previsti numeric,costi_impegnati numeric,costi_fissi_operativi numeric,costi_variabili numeric,
  margine_contribuzione numeric,margine_contribuzione_pct numeric,ebitda_operativo_gestionale numeric,
  break_even numeric,break_even_raggiunto boolean,ore_produttive_disponibili numeric,
  ore_effettivamente_lavorate numeric,costo_orario_struttura numeric,produzione_ora numeric,incasso_ora numeric,
  data_quality_status text,formula_version text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_preventivato numeric;v_lordo numeric;v_sconto numeric;v_accettato numeric;v_prodotto numeric;
  v_fatt_net numeric;v_fatt_iva numeric;v_fatt_lordo numeric;v_incassato numeric;v_allocato numeric;
  v_portafoglio numeric;v_da_fatturare numeric;v_credito numeric;v_non_allocato numeric;
  v_previsti numeric;v_impegnati numeric;v_fissi numeric;v_variabili numeric;v_margine numeric;v_ebitda numeric;
  v_costi_struttura numeric;v_ore_disponibili numeric;v_ore_effettive numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_preventivato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PREVENTIVATO');
  SELECT COALESCE(SUM(amount),0) INTO v_lordo FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PREVENTIVATO_LORDO');
  SELECT COALESCE(SUM(amount),0) INTO v_sconto FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SCONTO');
  SELECT COALESCE(SUM(amount),0) INTO v_accettato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ACCETTATO');
  SELECT COALESCE(SUM(amount),0) INTO v_prodotto FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO');
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_net FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_NETTO_IVA');
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_iva FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_IVA');
  SELECT COALESCE(SUM(amount),0) INTO v_fatt_lordo FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'FATTURATO_LORDO');
  SELECT COALESCE(SUM(amount),0) INTO v_incassato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'INCASSATO');
  SELECT COALESCE(SUM(amount),0) INTO v_allocato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'INCASSATO_ALLOCATO');
  SELECT COALESCE(SUM(amount),0) INTO v_portafoglio FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PORTAFOGLIO_DA_ESEGUIRE');
  SELECT COALESCE(SUM(amount),0) INTO v_da_fatturare FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'PRODOTTO_DA_FATTURARE');
  SELECT COALESCE(SUM(amount),0) INTO v_credito FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'CREDITO_CLIENTI');
  SELECT COALESCE(SUM(amount),0) INTO v_non_allocato FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'SALDO_INCASSI_NON_ALLOCATO');
  SELECT COALESCE(SUM(amount),0) INTO v_previsti FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_PREVISTI');
  SELECT COALESCE(SUM(amount),0) INTO v_impegnati FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_IMPEGNATI');
  SELECT COALESCE(SUM(amount),0) INTO v_fissi FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_FISSI_OPERATIVI');
  SELECT COALESCE(SUM(amount),0) INTO v_variabili FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_VARIABILI');
  SELECT COALESCE(SUM(amount),0) INTO v_costi_struttura FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'COSTI_STRUTTURA_OPERATIVI');
  SELECT COALESCE(SUM(amount),0) INTO v_ore_disponibili FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ORE_DISPONIBILI');
  SELECT COALESCE(SUM(amount),0) INTO v_ore_effettive FROM public.get_financial_drilldown_v1(p_data_inizio,p_data_fine,'ORE_EFFETTIVE');
  v_margine:=v_prodotto-v_variabili;v_ebitda:=v_margine-v_fissi;
  RETURN QUERY SELECT v_preventivato,v_lordo,v_sconto,v_accettato,v_prodotto,
    v_fatt_net,v_fatt_iva,v_fatt_lordo,v_incassato,v_allocato,v_portafoglio,v_da_fatturare,v_credito,v_non_allocato,
    v_previsti,v_impegnati,v_fissi,v_variabili,v_margine,
    CASE WHEN v_prodotto=0 THEN NULL ELSE v_margine/v_prodotto*100 END,v_ebitda,
    CASE WHEN v_prodotto>0 AND v_margine>0 THEN v_fissi/(v_margine/v_prodotto) ELSE NULL END,
    CASE WHEN v_prodotto>0 AND v_margine>0 THEN v_prodotto>=v_fissi/(v_margine/v_prodotto) ELSE NULL END,
    v_ore_disponibili,v_ore_effettive,
    CASE WHEN v_ore_disponibili=0 THEN NULL ELSE v_costi_struttura/v_ore_disponibili END,
    CASE WHEN v_ore_effettive=0 THEN NULL ELSE v_prodotto/v_ore_effettive END,
    CASE WHEN v_ore_effettive=0 THEN NULL ELSE v_incassato/v_ore_effettive END,
    'PO_SEMANTICS_LOCKED_LEGACY_ADAPTER_PENDING','POL-003A-v1';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_financial_drilldown_v1(date,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_financial_snapshot_v1(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_financial_drilldown_v1(date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_snapshot_v1(date,date) TO authenticated;
COMMENT ON FUNCTION public.get_financial_snapshot_v1(date,date) IS
  'POL-003A-v1 PO-locked canonical snapshot. Stock metrics are cumulative through p_data_fine.';
COMMENT ON FUNCTION public.get_financial_drilldown_v1(date,date,text) IS
  'POL-003A-v1 tenant-safe source drilldown; quote_basis and credit_basis were removed.';

COMMIT;

-- Reversal: drop public RPCs, private views/helpers and the eight additive
-- financial_*_v1 tables after confirming that no adapter writes them.
