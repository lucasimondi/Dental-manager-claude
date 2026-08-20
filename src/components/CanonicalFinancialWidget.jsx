import React from 'react';
import { C, fmt } from '../lib/utils';
import { selectHomeFinancialMetric } from '../lib/homeFinancialWidgets.js';
import './CanonicalFinancialWidget.css';

export default function CanonicalFinancialWidget({ widgetId, snapshot, loading, period, error }) {
  const metric = selectHomeFinancialMetric(snapshot, widgetId);
  if (!metric) return null;
  const display = metric.format === 'hours' ? `${Number(metric.value || 0).toLocaleString('it-IT')} h` : fmt(metric.value);
  return (
    <div className="canonical-financial-widget" data-canonical-widget={widgetId}>
      <div className="canonical-financial-widget__label">{metric.label}</div>
      <div className="canonical-financial-widget__period">{period.label}</div>
      {loading ? <div className="canonical-financial-widget__state">Caricamento…</div>
        : metric.available && !error ? <div className="canonical-financial-widget__value">{display}</div>
          : <div className="canonical-financial-widget__state">Non disponibile</div>}
      {(!metric.available || error) && !loading && <div className="canonical-financial-widget__reason">{error ? 'Snapshot canonico non disponibile' : metric.unavailableReason}</div>}
      <div className="canonical-financial-widget__meta" title={`Fonte: get_financial_snapshot_v1 · ${snapshot?.formula_version || 'versione non disponibile'}`}>
        Fonte canonica · {snapshot?.formula_version || 'n/d'}
      </div>
    </div>
  );
}
