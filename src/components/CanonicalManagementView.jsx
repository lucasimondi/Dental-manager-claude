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
        {model.metrics.map((item) => {
          // POL-UI-022: "Costo orario struttura" resta cliccabile anche
          // quando la snapshot canonica non lo calcola ancora (parametri
          // ore/spese/personale non completati) — è l'unico modo per
          // raggiungere la schermata dove quei parametri si compilano
          // (Controllo → Costi), altrimenti il tasto disabilitato blocca
          // chi deve proprio configurarlo per la prima volta.
          const canExplainUnavailable = item.id === 'prodotto' || item.id === 'costo_orario_struttura';
          const canDrillDown = Boolean(onDrillDown) && (item.available || canExplainUnavailable);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!canDrillDown}
              onClick={() => canDrillDown && onDrillDown?.(item.sourceField)}
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
          );
        })}
      </div>
    </div>
  );
}
