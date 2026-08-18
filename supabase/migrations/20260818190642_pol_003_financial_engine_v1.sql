-- POL-003 — additive canonical financial engine v1.
-- No legacy source adapter or production rollout is included in this migration.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studio_users') IS NULL THEN
    RAISE EXCEPTION 'POL-003 preflight: public.studio_users is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_users'
      AND column_name IN ('user_id', 'studio_id', 'stato')
    GROUP BY table_schema, table_name HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'POL-003 preflight: studio_users contract is incomplete';
  END IF;
END
$preflight$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.financial_current_studio_v1()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'studio_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (auth.jwt() -> 'app_metadata' ->> 'studio_id')::uuid
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION private.financial_has_tenant_access_v1(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_studio_id IS NOT NULL
    AND p_studio_id = private.financial_current_studio_v1()
    AND EXISTS (
      SELECT 1
      FROM public.studio_users su
      WHERE su.user_id = auth.uid()
        AND su.studio_id = p_studio_id
        AND su.stato = 'attivo'
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
  discount_kind text NOT NULL DEFAULT 'NONE' CHECK (discount_kind IN ('NONE', 'PERCENT', 'FIXED')),
  discount_value numeric(18,6) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_contracts_v1_percent_check
    CHECK (discount_kind <> 'PERCENT' OR discount_value <= 100),
  CONSTRAINT financial_contracts_v1_none_check
    CHECK (discount_kind <> 'NONE' OR discount_value = 0),
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
  CONSTRAINT financial_contract_lines_v1_contract_fk
    FOREIGN KEY (contract_id, studio_id)
    REFERENCES public.financial_contracts_v1(id, studio_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_contract_lines_v1_source_key
    UNIQUE (studio_id, source_table, source_id, source_line_id),
  CONSTRAINT financial_contract_lines_v1_tenant_key UNIQUE (id, studio_id)
);

CREATE TABLE public.financial_line_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_line_id bigint NOT NULL,
  stage text NOT NULL CHECK (stage IN ('ACCETTATO', 'PRODOTTO')),
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  fraction numeric(12,9) NOT NULL CHECK (fraction > 0 AND fraction <= 1),
  event_kind text NOT NULL CHECK (event_kind IN ('ORIGINAL', 'REVERSAL', 'CANCELLATION')),
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  source_line_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_line_events_v1_kind_direction_check CHECK (
    (event_kind = 'ORIGINAL' AND direction = 1)
    OR (event_kind IN ('REVERSAL', 'CANCELLATION') AND direction = -1)
  ),
  CONSTRAINT financial_line_events_v1_line_fk
    FOREIGN KEY (contract_line_id, studio_id)
    REFERENCES public.financial_contract_lines_v1(id, studio_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_line_events_v1_source_key
    UNIQUE (studio_id, source_table, source_id)
);

CREATE TABLE public.financial_invoice_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_id bigint,
  contract_line_id bigint,
  patient_id bigint,
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  event_kind text NOT NULL CHECK (event_kind IN ('INVOICE', 'CREDIT_NOTE')),
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  source_line_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_invoice_events_v1_kind_direction_check CHECK (
    (event_kind = 'INVOICE' AND direction = 1)
    OR (event_kind = 'CREDIT_NOTE' AND direction = -1)
  ),
  CONSTRAINT financial_invoice_events_v1_contract_fk
    FOREIGN KEY (contract_id, studio_id)
    REFERENCES public.financial_contracts_v1(id, studio_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_invoice_events_v1_line_fk
    FOREIGN KEY (contract_line_id, studio_id)
    REFERENCES public.financial_contract_lines_v1(id, studio_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_invoice_events_v1_source_key
    UNIQUE (studio_id, source_table, source_id, source_line_id)
);

CREATE TABLE public.financial_payment_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  contract_id bigint,
  patient_id bigint,
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  event_kind text NOT NULL CHECK (event_kind IN ('PAYMENT', 'REFUND', 'EXTERNAL_PAYMENT')),
  reconciled boolean NOT NULL DEFAULT true,
  operator_ref text,
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_payment_events_v1_kind_direction_check CHECK (
    (event_kind IN ('PAYMENT', 'EXTERNAL_PAYMENT') AND direction = 1)
    OR (event_kind = 'REFUND' AND direction = -1)
  ),
  CONSTRAINT financial_payment_events_v1_contract_fk
    FOREIGN KEY (contract_id, studio_id)
    REFERENCES public.financial_contracts_v1(id, studio_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_payment_events_v1_source_key
    UNIQUE (studio_id, source_table, source_id)
);

CREATE TABLE public.financial_cost_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('PREVISTO', 'IMPEGNATO', 'SOSTENUTO')),
  classification text NOT NULL CHECK (classification IN ('FISSO', 'VARIABILE')),
  event_date date NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  patient_id bigint,
  service_ref text,
  operator_ref text,
  cost_version_ref text NOT NULL,
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_cost_events_v1_source_key
    UNIQUE (studio_id, source_table, source_id)
);

CREATE TABLE public.financial_hours_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL,
  event_date date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('STRUCTURE', 'OPERATOR')),
  operator_ref text,
  productive_hours numeric(14,6) NOT NULL CHECK (productive_hours >= 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_hours_v1_operator_check CHECK (
    (scope = 'STRUCTURE' AND operator_ref IS NULL)
    OR (scope = 'OPERATOR' AND operator_ref IS NOT NULL)
  ),
  CONSTRAINT financial_hours_v1_source_key
    UNIQUE (studio_id, source_table, source_id)
);

CREATE INDEX financial_contracts_v1_studio_date_idx
  ON public.financial_contracts_v1 (studio_id, proposal_date);
CREATE INDEX financial_contract_lines_v1_studio_contract_idx
  ON public.financial_contract_lines_v1 (studio_id, contract_id);
CREATE INDEX financial_line_events_v1_studio_stage_date_idx
  ON public.financial_line_events_v1 (studio_id, stage, event_date);
CREATE INDEX financial_line_events_v1_line_idx
  ON public.financial_line_events_v1 (contract_line_id, studio_id);
CREATE INDEX financial_invoice_events_v1_studio_date_idx
  ON public.financial_invoice_events_v1 (studio_id, event_date);
CREATE INDEX financial_invoice_events_v1_contract_idx
  ON public.financial_invoice_events_v1 (contract_id, studio_id);
CREATE INDEX financial_payment_events_v1_studio_date_idx
  ON public.financial_payment_events_v1 (studio_id, event_date);
CREATE INDEX financial_payment_events_v1_contract_idx
  ON public.financial_payment_events_v1 (contract_id, studio_id);
CREATE INDEX financial_cost_events_v1_studio_stage_date_idx
  ON public.financial_cost_events_v1 (studio_id, stage, event_date);
CREATE INDEX financial_hours_v1_studio_scope_date_idx
  ON public.financial_hours_v1 (studio_id, scope, event_date);

ALTER TABLE public.financial_contracts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_contract_lines_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_line_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoice_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_events_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_hours_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_contracts_v1_select ON public.financial_contracts_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_contract_lines_v1_select ON public.financial_contract_lines_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_line_events_v1_select ON public.financial_line_events_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_invoice_events_v1_select ON public.financial_invoice_events_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_payment_events_v1_select ON public.financial_payment_events_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_cost_events_v1_select ON public.financial_cost_events_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));
CREATE POLICY financial_hours_v1_select ON public.financial_hours_v1
  FOR SELECT TO authenticated
  USING ((SELECT private.financial_has_tenant_access_v1(studio_id)));

REVOKE ALL ON TABLE
  public.financial_contracts_v1,
  public.financial_contract_lines_v1,
  public.financial_line_events_v1,
  public.financial_invoice_events_v1,
  public.financial_payment_events_v1,
  public.financial_cost_events_v1,
  public.financial_hours_v1
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.financial_contracts_v1,
  public.financial_contract_lines_v1,
  public.financial_line_events_v1,
  public.financial_invoice_events_v1,
  public.financial_payment_events_v1,
  public.financial_cost_events_v1,
  public.financial_hours_v1
TO authenticated;

CREATE OR REPLACE VIEW private.financial_line_values_v1
WITH (security_invoker = true)
AS
WITH totals AS (
  SELECT
    c.id AS contract_id,
    c.studio_id,
    c.patient_id,
    c.proposal_date,
    c.discount_kind,
    c.discount_value,
    SUM(l.gross_amount) AS contract_gross_amount
  FROM public.financial_contracts_v1 c
  JOIN public.financial_contract_lines_v1 l
    ON l.contract_id = c.id AND l.studio_id = c.studio_id
  GROUP BY c.id, c.studio_id, c.patient_id, c.proposal_date,
           c.discount_kind, c.discount_value
)
SELECT
  l.id AS contract_line_id,
  l.studio_id,
  l.contract_id,
  COALESCE(l.patient_id, t.patient_id) AS patient_id,
  l.service_ref,
  l.operator_ref,
  l.source_table,
  l.source_id,
  l.source_line_id,
  t.proposal_date,
  l.gross_amount,
  CASE t.discount_kind
    WHEN 'PERCENT' THEN l.gross_amount * t.discount_value / 100
    WHEN 'FIXED' THEN
      CASE WHEN t.contract_gross_amount > 0
        THEN LEAST(t.discount_value, t.contract_gross_amount)
             * l.gross_amount / t.contract_gross_amount
        ELSE 0 END
    ELSE 0
  END AS allocated_discount,
  l.gross_amount - CASE t.discount_kind
    WHEN 'PERCENT' THEN l.gross_amount * t.discount_value / 100
    WHEN 'FIXED' THEN
      CASE WHEN t.contract_gross_amount > 0
        THEN LEAST(t.discount_value, t.contract_gross_amount)
             * l.gross_amount / t.contract_gross_amount
        ELSE 0 END
    ELSE 0
  END AS net_amount
FROM public.financial_contract_lines_v1 l
JOIN totals t ON t.contract_id = l.contract_id AND t.studio_id = l.studio_id;

REVOKE ALL ON TABLE private.financial_line_values_v1 FROM PUBLIC, anon;
GRANT SELECT ON TABLE private.financial_line_values_v1 TO authenticated;

CREATE OR REPLACE FUNCTION public.get_financial_drilldown_v1(
  p_data_inizio date,
  p_data_fine date,
  p_metric text,
  p_quote_basis text,
  p_credit_basis text
)
RETURNS TABLE (
  metric text,
  source_kind text,
  source_table text,
  source_id text,
  source_line_id text,
  patient_id bigint,
  operator_ref text,
  event_date date,
  amount numeric,
  formula_version text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_studio_id uuid := private.financial_current_studio_v1();
BEGIN
  IF p_data_inizio IS NULL OR p_data_fine IS NULL OR p_data_inizio > p_data_fine THEN
    RAISE EXCEPTION 'POL-003: invalid period';
  END IF;
  IF p_quote_basis NOT IN ('GROSS', 'NET') THEN
    RAISE EXCEPTION 'POL-003: quote basis must be GROSS or NET';
  END IF;
  IF p_credit_basis NOT IN ('ACCETTATO', 'PRODOTTO', 'FATTURATO') THEN
    RAISE EXCEPTION 'POL-003: credit basis must be ACCETTATO, PRODOTTO or FATTURATO';
  END IF;
  IF NOT private.financial_has_tenant_access_v1(v_studio_id) THEN
    RAISE EXCEPTION 'POL-003: access denied';
  END IF;

  IF p_metric = 'PREVENTIVATO' THEN
    RETURN QUERY
    SELECT p_metric, 'CONTRACT_LINE', v.source_table, v.source_id, v.source_line_id,
           v.patient_id, v.operator_ref, v.proposal_date,
           CASE p_quote_basis WHEN 'GROSS' THEN v.gross_amount ELSE v.net_amount END,
           'POL-003-v1'
    FROM private.financial_line_values_v1 v
    WHERE v.studio_id = v_studio_id
      AND v.proposal_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric IN ('ACCETTATO', 'PRODOTTO') THEN
    RETURN QUERY
    SELECT p_metric, 'LINE_EVENT', e.source_table, e.source_id, e.source_line_id,
           v.patient_id, COALESCE(e.operator_ref, v.operator_ref), e.event_date,
           v.net_amount * e.fraction * e.direction, 'POL-003-v1'
    FROM public.financial_line_events_v1 e
    JOIN private.financial_line_values_v1 v
      ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
    WHERE e.studio_id = v_studio_id
      AND e.stage = p_metric
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric = 'FATTURATO' THEN
    RETURN QUERY
    SELECT p_metric, 'INVOICE_EVENT', e.source_table, e.source_id, e.source_line_id,
           e.patient_id, e.operator_ref, e.event_date,
           e.amount * e.direction, 'POL-003-v1'
    FROM public.financial_invoice_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine;
  ELSIF p_metric = 'INCASSATO' THEN
    RETURN QUERY
    SELECT p_metric, 'PAYMENT_EVENT', e.source_table, e.source_id, NULL::text,
           e.patient_id, e.operator_ref, e.event_date,
           e.amount * e.direction, 'POL-003-v1'
    FROM public.financial_payment_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (e.event_kind <> 'EXTERNAL_PAYMENT' OR e.reconciled);
  ELSIF p_metric IN ('COSTI_PREVISTI', 'COSTI_IMPEGNATI', 'COSTI_FISSI', 'COSTI_VARIABILI', 'COSTI_OPERATORE') THEN
    RETURN QUERY
    SELECT p_metric, 'COST_EVENT', e.source_table, e.source_id, NULL::text,
           e.patient_id, e.operator_ref, e.event_date,
           e.amount * e.direction, 'POL-003-v1'
    FROM public.financial_cost_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND (
        (p_metric = 'COSTI_PREVISTI' AND e.stage = 'PREVISTO')
        OR (p_metric = 'COSTI_IMPEGNATI' AND e.stage = 'IMPEGNATO')
        OR (p_metric = 'COSTI_FISSI' AND e.stage = 'SOSTENUTO' AND e.classification = 'FISSO')
        OR (p_metric = 'COSTI_VARIABILI' AND e.stage = 'SOSTENUTO' AND e.classification = 'VARIABILE')
        OR (p_metric = 'COSTI_OPERATORE' AND e.stage = 'SOSTENUTO' AND e.operator_ref IS NOT NULL)
      );
  ELSIF p_metric IN ('ORE_STRUTTURA', 'ORE_OPERATORE') THEN
    RETURN QUERY
    SELECT p_metric, 'HOURS', e.source_table, e.source_id, NULL::text,
           NULL::bigint, e.operator_ref, e.event_date,
           e.productive_hours, 'POL-003-v1'
    FROM public.financial_hours_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date BETWEEN p_data_inizio AND p_data_fine
      AND ((p_metric = 'ORE_STRUTTURA' AND e.scope = 'STRUCTURE')
        OR (p_metric = 'ORE_OPERATORE' AND e.scope = 'OPERATOR'));
  ELSIF p_metric = 'CREDITO_RESIDUO' THEN
    IF p_credit_basis IN ('ACCETTATO', 'PRODOTTO') THEN
      RETURN QUERY
      SELECT p_metric, 'CREDIT_BASIS_EVENT', e.source_table, e.source_id, e.source_line_id,
             v.patient_id, COALESCE(e.operator_ref, v.operator_ref), e.event_date,
             v.net_amount * e.fraction * e.direction, 'POL-003-v1'
      FROM public.financial_line_events_v1 e
      JOIN private.financial_line_values_v1 v
        ON v.contract_line_id = e.contract_line_id AND v.studio_id = e.studio_id
      WHERE e.studio_id = v_studio_id
        AND e.stage = p_credit_basis
        AND e.event_date <= p_data_fine;
    ELSE
      RETURN QUERY
      SELECT p_metric, 'CREDIT_BASIS_INVOICE', e.source_table, e.source_id, e.source_line_id,
             e.patient_id, e.operator_ref, e.event_date,
             e.amount * e.direction, 'POL-003-v1'
      FROM public.financial_invoice_events_v1 e
      WHERE e.studio_id = v_studio_id AND e.event_date <= p_data_fine;
    END IF;
    RETURN QUERY
    SELECT p_metric, 'CREDIT_COLLECTION', e.source_table, e.source_id, NULL::text,
           e.patient_id, e.operator_ref, e.event_date,
           -(e.amount * e.direction), 'POL-003-v1'
    FROM public.financial_payment_events_v1 e
    WHERE e.studio_id = v_studio_id
      AND e.event_date <= p_data_fine
      AND (e.event_kind <> 'EXTERNAL_PAYMENT' OR e.reconciled);
  ELSIF p_metric IN ('MARGINE_CONTRIBUZIONE', 'EBITDA_OPERATIVO_GESTIONALE') THEN
    RETURN QUERY
    SELECT p_metric, d.source_kind, d.source_table, d.source_id, d.source_line_id,
           d.patient_id, d.operator_ref, d.event_date, d.amount, d.formula_version
    FROM public.get_financial_drilldown_v1(
      p_data_inizio, p_data_fine, 'PRODOTTO', p_quote_basis, p_credit_basis
    ) d;
    RETURN QUERY
    SELECT p_metric, d.source_kind, d.source_table, d.source_id, d.source_line_id,
           d.patient_id, d.operator_ref, d.event_date, -d.amount, d.formula_version
    FROM public.get_financial_drilldown_v1(
      p_data_inizio, p_data_fine, 'COSTI_VARIABILI', p_quote_basis, p_credit_basis
    ) d;
    IF p_metric = 'EBITDA_OPERATIVO_GESTIONALE' THEN
      RETURN QUERY
      SELECT p_metric, d.source_kind, d.source_table, d.source_id, d.source_line_id,
             d.patient_id, d.operator_ref, d.event_date, -d.amount, d.formula_version
      FROM public.get_financial_drilldown_v1(
        p_data_inizio, p_data_fine, 'COSTI_FISSI', p_quote_basis, p_credit_basis
      ) d;
    END IF;
  ELSE
    RAISE EXCEPTION 'POL-003: unsupported metric %', p_metric;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financial_snapshot_v1(
  p_data_inizio date,
  p_data_fine date,
  p_quote_basis text,
  p_credit_basis text
)
RETURNS TABLE (
  preventivato numeric,
  preventivato_lordo numeric,
  preventivato_netto numeric,
  accettato numeric,
  prodotto numeric,
  fatturato numeric,
  incassato numeric,
  credito_residuo numeric,
  costi_previsti numeric,
  costi_impegnati numeric,
  costi_fissi numeric,
  costi_variabili numeric,
  margine_contribuzione numeric,
  margine_contribuzione_pct numeric,
  ebitda_operativo_gestionale numeric,
  break_even numeric,
  ore_produttive_struttura numeric,
  ore_produttive_operatori numeric,
  costo_orario_struttura numeric,
  costo_orario_operatore numeric,
  produzione_ora numeric,
  incasso_ora numeric,
  quote_basis text,
  credit_basis text,
  data_quality_status text,
  formula_version text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_preventivato numeric;
  v_preventivato_lordo numeric;
  v_preventivato_netto numeric;
  v_accettato numeric;
  v_prodotto numeric;
  v_fatturato numeric;
  v_incassato numeric;
  v_credito numeric;
  v_costi_previsti numeric;
  v_costi_impegnati numeric;
  v_costi_fissi numeric;
  v_costi_variabili numeric;
  v_margine numeric;
  v_ebitda numeric;
  v_ore_struttura numeric;
  v_ore_operatori numeric;
  v_costi_operatori numeric;
BEGIN
  SELECT COALESCE(SUM(d.amount), 0) INTO v_preventivato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PREVENTIVATO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_preventivato_lordo
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PREVENTIVATO', 'GROSS', p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_preventivato_netto
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PREVENTIVATO', 'NET', p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_accettato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ACCETTATO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_prodotto
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'PRODOTTO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_fatturato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'FATTURATO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_incassato
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'INCASSATO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_credito
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'CREDITO_RESIDUO', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_costi_previsti
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_PREVISTI', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_costi_impegnati
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_IMPEGNATI', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_costi_fissi
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_FISSI', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_costi_variabili
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_VARIABILI', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_margine
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'MARGINE_CONTRIBUZIONE', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_ebitda
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'EBITDA_OPERATIVO_GESTIONALE', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_ore_struttura
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ORE_STRUTTURA', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_ore_operatori
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'ORE_OPERATORE', p_quote_basis, p_credit_basis) d;
  SELECT COALESCE(SUM(d.amount), 0) INTO v_costi_operatori
  FROM public.get_financial_drilldown_v1(p_data_inizio, p_data_fine, 'COSTI_OPERATORE', p_quote_basis, p_credit_basis) d;

  RETURN QUERY SELECT
    v_preventivato,
    v_preventivato_lordo,
    v_preventivato_netto,
    v_accettato,
    v_prodotto,
    v_fatturato,
    v_incassato,
    v_credito,
    v_costi_previsti,
    v_costi_impegnati,
    v_costi_fissi,
    v_costi_variabili,
    v_margine,
    CASE WHEN v_prodotto = 0 THEN NULL ELSE (v_margine / v_prodotto) * 100 END,
    v_ebitda,
    CASE WHEN v_prodotto > 0 AND v_margine > 0
      THEN v_costi_fissi / (v_margine / v_prodotto)
      ELSE NULL END,
    v_ore_struttura,
    v_ore_operatori,
    CASE WHEN v_ore_struttura = 0 THEN NULL
      ELSE (v_costi_fissi + v_costi_variabili) / v_ore_struttura END,
    CASE WHEN v_ore_operatori = 0 THEN NULL
      ELSE v_costi_operatori / v_ore_operatori END,
    CASE WHEN v_ore_struttura = 0 THEN NULL ELSE v_prodotto / v_ore_struttura END,
    CASE WHEN v_ore_struttura = 0 THEN NULL ELSE v_incassato / v_ore_struttura END,
    p_quote_basis,
    p_credit_basis,
    'EXPLICIT_BASES_REQUIRED',
    'POL-003-v1';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_financial_drilldown_v1(date,date,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_financial_snapshot_v1(date,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_drilldown_v1(date,date,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_snapshot_v1(date,date,text,text) TO authenticated;

COMMENT ON FUNCTION public.get_financial_snapshot_v1(date,date,text,text) IS
  'POL-003-v1 canonical snapshot. Quote and credit bases are mandatory until Product Owner semantics are approved.';
COMMENT ON FUNCTION public.get_financial_drilldown_v1(date,date,text,text,text) IS
  'POL-003-v1 source-record drilldown that reconciles to canonical snapshot totals.';

COMMIT;

-- Reversal: drop the two public RPCs, private view/helpers and seven additive
-- financial_*_v1 tables after confirming no adapter has begun writing them.
