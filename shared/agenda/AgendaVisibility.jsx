import React from 'react';
import { agendaVisibility } from './visibility.js';

export default function AgendaVisibility({ value, onChange }) {
  const flags = agendaVisibility(value);
  return <fieldset style={{ border: 0, margin: '12px 0', padding: 0 }}>
    <legend style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Mostra nelle agende</legend>
    {[['visibile_personal', 'Personal', 'visibile_studio'], ['visibile_studio', 'Studio', 'visibile_personal']].map(([key, label, other]) =>
      <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: 13 }}>
        <input type="checkbox" checked={flags[key]} disabled={flags[key] && !flags[other]} onChange={e => onChange({ ...flags, [key]: e.target.checked })} />
        {label}
      </label>
    )}
    <small>Di default compare in entrambe. Mantieni almeno un'agenda selezionata.</small>
  </fieldset>;
}
