import { loadCanonicalFinancialSnapshot } from './canonicalFinancialSelectors.js';

const financialWidget = (id, label, sourceField, options = {}) => Object.freeze({ id, label, sourceField, ...options });

export const HOME_FINANCIAL_WIDGETS = Object.freeze({
  fin_preventivato: financialWidget('fin_preventivato', 'Preventivato netto', 'preventivato'),
  fin_accettato: financialWidget('fin_accettato', 'Accettato', 'accettato'),
  fin_prodotto: financialWidget('fin_prodotto', 'Prodotto', 'prodotto'),
  fin_fatturato: financialWidget('fin_fatturato', 'Fatturato lordo', 'fatturato_lordo'),
  fin_incassato: financialWidget('fin_incassato', 'Incassato', 'incassato'),
  fin_credito_clienti: financialWidget('fin_credito_clienti', 'Credito clienti', 'credito_clienti'),
  fin_costi_fissi: financialWidget('fin_costi_fissi', 'Costi fissi operativi', 'costi_fissi_operativi'),
  fin_costi_variabili: financialWidget('fin_costi_variabili', 'Costi variabili', 'costi_variabili'),
  fin_margine_contribuzione: financialWidget('fin_margine_contribuzione', 'Margine di contribuzione', 'margine_contribuzione'),
  fin_ebitda: financialWidget('fin_ebitda', 'EBITDA gestionale', 'ebitda_operativo_gestionale'),
  fin_break_even: financialWidget('fin_break_even', 'Break-even', 'break_even'),
  fin_costo_orario: financialWidget('fin_costo_orario', 'Costo orario struttura', 'costo_orario_struttura'),
  fin_ore_disponibili: financialWidget('fin_ore_disponibili', 'Ore disponibili', 'ore_produttive_disponibili', { format: 'hours' }),
  fin_produzione_ora: financialWidget('fin_produzione_ora', 'Produzione/ora', 'produzione_ora', { requiresWorkedHours: true }),
  fin_incasso_ora: financialWidget('fin_incasso_ora', 'Incasso/ora', 'incasso_ora', { requiresWorkedHours: true }),
});

export const getHomeFinancialWidget = (id) => HOME_FINANCIAL_WIDGETS[id] || null;

export const selectHomeFinancialMetric = (snapshot, widgetId) => {
  const definition = getHomeFinancialWidget(widgetId);
  if (!definition) return null;
  if (definition.requiresWorkedHours && !(Number(snapshot?.ore_effettivamente_lavorate) > 0)) {
    return { ...definition, available: false, value: null, unavailableReason: 'Ore effettivamente lavorate non disponibili' };
  }
  const value = snapshot?.[definition.sourceField];
  return {
    ...definition,
    available: value !== null && value !== undefined,
    value: value !== null && value !== undefined ? value : null,
    unavailableReason: value !== null && value !== undefined ? null : 'Dato canonico non disponibile per il periodo',
  };
};

export async function loadHomeFinancialSnapshot(client, { authorized, period }) {
  if (!authorized) return { snapshot: null, error: null, skipped: true };
  const result = await loadCanonicalFinancialSnapshot(client, period?.dateFrom, period?.dateTo);
  return { ...result, skipped: false };
}
