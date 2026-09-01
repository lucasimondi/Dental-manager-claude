import React from 'react';
import { fmt } from '../lib/utils';
import { createCanonicalManagementModel } from '../lib/canonicalFinancialSelectors';
import './CanonicalFinancialWidget.css';

/* POL-UX-001 section M — Pannello Economico redesign. Presentation only:
   reuses the exact .canonical-financial-widget gradient system already
   shipped for Home's canonical KPI cards (CanonicalFinancialWidget.jsx),
   so Controllo di Gestione's overview and Home read as one design system
   instead of two. createCanonicalManagementModel/its output are untouched
   — no financial formula, grouping, or availability logic lives here. */
const GROUP_ACCENT = {
  performance: 'finance', margins: 'finance', efficiency: 'ops',
  trend: 'agenda', lifecycle: 'ops', stocks: 'ops',
  billing: 'finance', cash: 'finance', costs: 'alert',
};

export default function CanonicalManagementView({ snapshot, mode, onDrillDown }) {
  const model = createCanonicalManagementModel(snapshot, mode);
  const displayValue = (item) => item.format === 'boolean'
    ? (item.value ? 'Raggiunto' : 'Non raggiunto')
    : fmt(item.value);
  return (
    <div data-management-mode={model.mode} className="cmv">
      <div className="cmv__meta">
        Qualità dati: {model.dataQualityStatus} · Formula: {model.formulaVersion || 'non disponibile'}
      </div>
      <div className="cmv__details">
        {model.metrics.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.available || !onDrillDown}
            onClick={() => item.available && onDrillDown?.(item.sourceField)}
            className="cmv-detail"
            data-tone={GROUP_ACCENT[item.group]}
          >
            <span className="cmv-detail__identity"><strong>{item.label}</strong><small>{item.group} · fonte {item.sourceField || 'non disponibile'}</small></span>
            {item.available ? (
              <span className="cmv-detail__value">{displayValue(item)}</span>
            ) : (
              <span className="cmv-detail__unavailable">Dato non disponibile</span>
            )}
            <span className="cmv-detail__arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
