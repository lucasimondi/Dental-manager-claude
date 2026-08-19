import React from 'react';
import { C, fmt } from '../lib/utils';
import { createCanonicalManagementModel } from '../lib/canonicalFinancialSelectors';

// Prepared for the gated POL-003 cutover. It is intentionally not mounted in
// ControlloGestione while legacy reconciliation is incomplete.
export default function CanonicalManagementView({ snapshot, mode, onDrillDown }) {
  const model = createCanonicalManagementModel(snapshot, mode);
  const displayValue = (item) => item.format === 'boolean'
    ? (item.value ? 'Raggiunto' : 'Non raggiunto')
    : fmt(item.value);
  return (
    <div data-management-mode={model.mode}>
      <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>
        Qualità dati: {model.dataQualityStatus} · Formula: {model.formulaVersion || 'non disponibile'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {model.metrics.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.available || !onDrillDown}
            onClick={() => item.available && onDrillDown?.(item.sourceField)}
            style={{ textAlign: 'left', padding: 12, borderRadius: 10, border: `1px solid ${C.brd}`, background: C.sur, color: C.txt }}
          >
            <div style={{ fontSize: 11, color: C.txl }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
              {item.available ? displayValue(item) : 'Non disponibile'}
            </div>
            {!item.available && <div style={{ fontSize: 10, color: C.txl, marginTop: 4 }}>Dato canonico incompleto</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
