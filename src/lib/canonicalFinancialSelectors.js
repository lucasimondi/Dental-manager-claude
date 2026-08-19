export const MANAGEMENT_CONTROL_MODES = Object.freeze({
  BASE: 'base',
  ADVANCED: 'advanced',
});

export const CANONICAL_FINANCIAL_RPC = 'get_financial_snapshot_v1';

const metric = (id, label, sourceField, group, options = {}) => Object.freeze({
  id, label, sourceField, group, ...options,
});

// This catalog is presentation metadata only. sourceField values are returned
// verbatim by POL-003; no financial formula is implemented in the client.
export const CANONICAL_METRIC_CATALOG = Object.freeze({
  prodotto: metric('prodotto', 'Prodotto', 'prodotto', 'performance'),
  incassato: metric('incassato', 'Incassato', 'incassato', 'performance'),
  costi_operativi: metric('costi_operativi', 'Costi operativi', null, 'performance', { unavailableReason: 'CANONICAL_METRIC_NOT_AVAILABLE' }),
  margine_operativo: metric('margine_operativo', 'Margine operativo gestionale', 'ebitda_operativo_gestionale', 'performance'),
  ebitda_operativo_gestionale: metric('ebitda_operativo_gestionale', 'EBITDA operativo gestionale', 'ebitda_operativo_gestionale', 'margins'),
  break_even: metric('break_even', 'Break-even', 'break_even', 'performance'),
  break_even_raggiunto: metric('break_even_raggiunto', 'Stato break-even', 'break_even_raggiunto', 'performance', { format: 'boolean' }),
  distanza_break_even: metric('distanza_break_even', 'Distanza dal break-even', null, 'performance', { unavailableReason: 'CANONICAL_METRIC_NOT_AVAILABLE' }),
  costo_orario_struttura: metric('costo_orario_struttura', 'Costo orario struttura', 'costo_orario_struttura', 'efficiency'),
  produzione_ora: metric('produzione_ora', 'Produzione/ora', 'produzione_ora', 'efficiency'),
  incasso_ora: metric('incasso_ora', 'Incasso/ora', 'incasso_ora', 'efficiency'),
  trend_mese: metric('trend_mese', 'Trend mensile', null, 'trend', { unavailableReason: 'CANONICAL_SERIES_NOT_AVAILABLE' }),
  avanzamento_obiettivo: metric('avanzamento_obiettivo', 'Avanzamento obiettivo mensile', null, 'trend', { unavailableReason: 'CANONICAL_BUDGET_NOT_AVAILABLE' }),
  preventivato_lordo: metric('preventivato_lordo', 'Preventivato lordo', 'preventivato_lordo', 'lifecycle'),
  sconto: metric('sconto', 'Sconto', 'sconto', 'lifecycle'),
  preventivato: metric('preventivato', 'Preventivato netto', 'preventivato', 'lifecycle'),
  accettato: metric('accettato', 'Accettato', 'accettato', 'lifecycle'),
  portafoglio_da_eseguire: metric('portafoglio_da_eseguire', 'Portafoglio da eseguire', 'portafoglio_da_eseguire', 'stocks'),
  prodotto_da_fatturare: metric('prodotto_da_fatturare', 'Prodotto da fatturare', 'prodotto_da_fatturare', 'stocks'),
  fatturato_netto_iva: metric('fatturato_netto_iva', 'Fatturato netto IVA', 'fatturato_netto_iva', 'billing'),
  fatturato_iva: metric('fatturato_iva', 'IVA', 'fatturato_iva', 'billing'),
  fatturato_lordo: metric('fatturato_lordo', 'Fatturato lordo', 'fatturato_lordo', 'billing'),
  incassato_allocato: metric('incassato_allocato', 'Incassato allocato', 'incassato_allocato', 'cash'),
  saldo_incassi_non_allocato: metric('saldo_incassi_non_allocato', 'Incassi e anticipi non allocati', 'saldo_incassi_non_allocato', 'cash'),
  credito_clienti: metric('credito_clienti', 'Credito clienti', 'credito_clienti', 'cash'),
  costi_fissi_operativi: metric('costi_fissi_operativi', 'Costi fissi operativi', 'costi_fissi_operativi', 'costs'),
  costi_variabili: metric('costi_variabili', 'Costi variabili attribuibili', 'costi_variabili', 'costs'),
  margine_contribuzione: metric('margine_contribuzione', 'Margine di contribuzione', 'margine_contribuzione', 'margins'),
  margine_contribuzione_pct: metric('margine_contribuzione_pct', 'Margine di contribuzione %', 'margine_contribuzione_pct', 'margins'),
  ore_produttive_disponibili: metric('ore_produttive_disponibili', 'Ore produttive disponibili', 'ore_produttive_disponibili', 'hours'),
  ore_effettivamente_lavorate: metric('ore_effettivamente_lavorate', 'Ore effettivamente lavorate', 'ore_effettivamente_lavorate', 'hours'),
  saturazione: metric('saturazione', 'Saturazione/utilizzo', null, 'hours', { unavailableReason: 'AUTHORITATIVE_SCHEDULING_NOT_AVAILABLE' }),
  budget_vs_actual: metric('budget_vs_actual', 'Budget vs actual', null, 'forecast', { unavailableReason: 'CANONICAL_BUDGET_NOT_AVAILABLE' }),
  forecast: metric('forecast', 'Forecast', null, 'forecast', { unavailableReason: 'CANONICAL_FORECAST_NOT_AVAILABLE' }),
  redditivita_attribuita: metric('redditivita_attribuita', 'Redditività attribuita', null, 'profitability', { unavailableReason: 'AUTHORITATIVE_ATTRIBUTION_NOT_AVAILABLE' }),
});

const BASE_METRIC_IDS = Object.freeze([
  'prodotto', 'incassato', 'costi_operativi', 'margine_operativo', 'break_even', 'break_even_raggiunto',
  'distanza_break_even', 'costo_orario_struttura', 'produzione_ora', 'incasso_ora',
  'trend_mese', 'avanzamento_obiettivo',
]);

const ADVANCED_METRIC_IDS = Object.freeze([
  'preventivato_lordo', 'sconto', 'preventivato', 'accettato', 'portafoglio_da_eseguire',
  'prodotto', 'prodotto_da_fatturare', 'fatturato_netto_iva', 'fatturato_iva',
  'fatturato_lordo', 'incassato', 'incassato_allocato', 'saldo_incassi_non_allocato',
  'credito_clienti', 'costi_fissi_operativi', 'costi_variabili', 'margine_contribuzione',
  'margine_contribuzione_pct', 'ebitda_operativo_gestionale', 'break_even', 'break_even_raggiunto',
  'ore_produttive_disponibili', 'ore_effettivamente_lavorate', 'saturazione',
  'costo_orario_struttura', 'produzione_ora', 'incasso_ora', 'budget_vs_actual',
  'forecast', 'trend_mese', 'redditivita_attribuita',
]);

export function normalizeManagementControlMode(value) {
  return value === MANAGEMENT_CONTROL_MODES.ADVANCED
    ? MANAGEMENT_CONTROL_MODES.ADVANCED
    : MANAGEMENT_CONTROL_MODES.BASE;
}

export function selectCanonicalMetrics(snapshot, requestedMode) {
  const mode = normalizeManagementControlMode(requestedMode);
  const ids = mode === MANAGEMENT_CONTROL_MODES.ADVANCED ? ADVANCED_METRIC_IDS : BASE_METRIC_IDS;
  const canonicalSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};

  return ids.map((id) => {
    const definition = CANONICAL_METRIC_CATALOG[id];
    const hasValue = definition.sourceField !== null
      && Object.prototype.hasOwnProperty.call(canonicalSnapshot, definition.sourceField)
      && canonicalSnapshot[definition.sourceField] !== null;
    return Object.freeze({
      ...definition,
      value: hasValue ? canonicalSnapshot[definition.sourceField] : null,
      available: hasValue,
      unavailableReason: hasValue ? null : (definition.unavailableReason || 'CANONICAL_DATA_INCOMPLETE'),
    });
  });
}

export function createCanonicalManagementModel(snapshot, requestedMode) {
  const mode = normalizeManagementControlMode(requestedMode);
  return Object.freeze({
    mode,
    formulaVersion: snapshot?.formula_version || null,
    dataQualityStatus: snapshot?.data_quality_status || 'CANONICAL_DATA_UNAVAILABLE',
    metrics: selectCanonicalMetrics(snapshot, mode),
  });
}

export async function loadCanonicalFinancialSnapshot(supabaseClient, dateFrom, dateTo) {
  if (!supabaseClient || !dateFrom || !dateTo) {
    return { snapshot: null, error: new Error('Canonical financial period is required') };
  }
  const { data, error } = await supabaseClient.rpc(CANONICAL_FINANCIAL_RPC, {
    p_data_inizio: dateFrom,
    p_data_fine: dateTo,
  });
  if (error) return { snapshot: null, error };
  return { snapshot: Array.isArray(data) ? (data[0] || null) : (data || null), error: null };
}
