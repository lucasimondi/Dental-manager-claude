import React from 'react';
import { C } from '../../lib/utils';
import { DockIc, Ic } from '../ui';

/* POLIEDRON-TASTI (PO 2026-11-11: "in poliedron quando apre creerei dei tasti senza tutta la
   spiegazione che stiamo anche in tre per linea"): tasti compatti, icona + nome breve, tre per riga. */
export const NOME_BREVE = Object.freeze({
  'appointment.create': 'Appuntamento',
  'patient.create': 'Paziente',
  'prescription.create': 'Ricetta',
  'payment.create': 'Pagamento',
  'expense.create': 'Spesa',
  'document.create': 'Documento',
  'quote.create': 'Preventivo',
});

export default function PoliedronSuggestionBoard({ groups, onSelect }) {
  const sections = groups.find((group) => group.group === 'APRI UNA SEZIONE')?.items || [];
  const actions = groups.find((group) => group.group === 'AZIONI E WORKFLOW')?.items || [];

  return (
    <div className="poliedron-suggestions">
      <div className="poliedron-suggestions__intro">
        <div className="poliedron-suggestions__mark"><Ic n="spark" s={17} c="#fff" /></div>
        <div>
          <div className="poliedron-suggestions__eyebrow">Poliedra AI</div>
          <div className="poliedron-suggestions__title">Cosa vuoi fare?</div>
          <div className="poliedron-suggestions__copy">Crea al volo oppure scrivi una domanda o il nome di un paziente.</div>
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
          <div id="poliedron-actions-title" className="poliedron-group-label">Crea</div>
          <div className="poliedron-action-grid">
            {actions.map((item) => (
              <button key={item.id} className="poliedron-action-card" onClick={() => onSelect(item)} aria-label={item.label} title={item.label}>
                <span className="poliedron-action-card__icon"><Ic n={item.data?.quickAction?.ic || (item.data?.kind === 'workflow' ? 'pill' : 'zap')} s={18} c={C.pri} /></span>
                <span className="poliedron-action-card__label">{NOME_BREVE[item.id] || item.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
