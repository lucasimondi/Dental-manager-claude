import React from 'react';
import { C } from '../../lib/utils';
import { DockIc, Ic } from '../ui';

const actionType = (action) => {
  if (action?.kind === 'workflow') return 'Workflow';
  if (action?.riskLevel === 1) return 'Crea';
  return 'Azione';
};

export default function PoliedronSuggestionBoard({ groups, onSelect }) {
  const sections = groups.find((group) => group.group === 'APRI UNA SEZIONE')?.items || [];
  const actions = groups.find((group) => group.group === 'AZIONI E WORKFLOW')?.items || [];

  return (
    <div className="poliedron-suggestions">
      <div className="poliedron-suggestions__intro">
        <div className="poliedron-suggestions__mark"><Ic n="spark" s={17} c="#fff" /></div>
        <div>
          <div className="poliedron-suggestions__eyebrow">Poliedra AI</div>
          <div className="poliedron-suggestions__title">Dove vuoi lavorare?</div>
          <div className="poliedron-suggestions__copy">Apri una sezione, avvia un workflow reale oppure scrivi una domanda.</div>
        </div>
      </div>

      {sections.length > 0 && (
        <section aria-labelledby="poliedron-sections-title">
          <div id="poliedron-sections-title" className="poliedron-group-label">Naviga</div>
          <div className="poliedron-section-grid">
            {sections.map((item) => (
              <button key={item.id} className="poliedron-section-chip" onClick={() => onSelect(item)}>
                <span className="poliedron-section-chip__icon"><DockIc n={item.icon} style="outline" s={15} c={C.pri} /></span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section aria-labelledby="poliedron-actions-title">
          <div id="poliedron-actions-title" className="poliedron-group-label">Crea e workflow</div>
          <div className="poliedron-action-grid">
            {actions.map((item) => (
              <button key={item.id} className="poliedron-action-card" onClick={() => onSelect(item)}>
                <span className="poliedron-action-card__icon"><Ic n={item.data?.quickAction?.ic || (item.data?.kind === 'workflow' ? 'pill' : 'zap')} s={16} c={C.pri} /></span>
                <span className="poliedron-action-card__body">
                  <span className="poliedron-action-card__type">{actionType(item.data)}</span>
                  <span className="poliedron-action-card__label">{item.label}</span>
                  {item.description && <span className="poliedron-action-card__description">{item.description}</span>}
                </span>
                <span className="poliedron-action-card__arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
