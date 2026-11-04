import React from 'react';
import { LABEL_PALETTE, labelColor, labelOn } from './labelPalette.js';

// Selettore colore etichetta: i 15 colori della palette, poi "Personalizzato" (selettore libero).
export default function LabelSwatches({ value, onChange, size = 28, custom = true, className }) {
  const current = labelColor(value, '');
  return <div className={className} role="radiogroup" aria-label="Colore" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
    {LABEL_PALETTE.map(p => {
      const on = current === p.hex;
      return <button key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.nome} title={p.nome} onClick={() => onChange(p.hex)}
        style={{ width: size, height: size, borderRadius: '50%', background: p.hex, border: 0, padding: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', boxShadow: on ? `0 0 0 2px var(--agenda-ring, #fff), 0 0 0 4px ${p.hex}` : 'none' }}>
        {on && <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke={labelOn(p.hex)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>;
    })}
    {custom && <label title="Personalizzato" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
      <input type="color" aria-label="Colore personalizzato" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#5d6979'} onChange={e => onChange(e.target.value)}
        style={{ width: size, height: size, border: 0, padding: 0, borderRadius: '50%', background: 'none', cursor: 'pointer' }} />
      Personalizzato
    </label>}
  </div>;
}
