import React from 'react';
import { fmt } from '../lib/utils';
import { selectHomeFinancialMetric } from '../lib/homeFinancialWidgets.js';
import './CanonicalFinancialWidget.css';

const GLYPHS = {
  preventivato: '€',
  prodotto: '↗',
  incassato: '€',
  margine_contribuzione: '◆',
  ebitda_gestionale: '◇',
  break_even: '◎',
  costi_fissi_operativi: '−',
  costi_variabili: '−',
  credito_residuo: '◌',
  costo_orario_struttura: 'h',
  ore_disponibili: 'h',
  produzione_ora: '↗',
  incasso_ora: '€',
};

export default function CanonicalFinancialWidget({ widgetId, snapshot, loading, period, error }) {
  const metric = selectHomeFinancialMetric(snapshot, widgetId);
  if (!metric) return null;
  const display = metric.format === 'hours' ? `${Number(metric.value || 0).toLocaleString('it-IT')} h` : fmt(metric.value);
  return (
    <div className="canonical-financial-widget" data-canonical-widget={widgetId}>
      <div className="canonical-financial-widget__top">
        <div>
          <div className="canonical-financial-widget__label">{metric.label}</div>
          <div className="canonical-financial-widget__period">{period.label}</div>
        </div>
        <div className="canonical-financial-widget__glyph" aria-hidden="true">{GLYPHS[widgetId] || '◆'}</div>
      </div>
      {loading ? <div className="canonical-financial-widget__state">Caricamento…</div>
        : metric.available && !error ? <div className="canonical-financial-widget__value">{display}</div>
          : <div className="canonical-financial-widget__state">Non disponibile</div>}
      {(!metric.available || error) && !loading && <div className="canonical-financial-widget__reason">{error ? 'Snapshot canonico non disponibile' : metric.unavailableReason}</div>}
      <div className="canonical-financial-widget__meta" title={`Fonte: get_financial_snapshot_v1 · ${snapshot?.formula_version || 'versione non disponibile'}`}>
        Fonte canonica · {snapshot?.formula_version || 'n/d'}
      </div>
      <div className="canonical-financial-widget__accent" aria-hidden="true" />
    </div>
  );
}
