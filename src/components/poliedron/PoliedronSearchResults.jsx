import React from 'react';
import { C } from '../../lib/utils';
import { DockIc, Ic } from '../ui';

/* POL-AI-001 §7, §25 — grouped, keyboard-navigable result list. Pure
   presentation: PoliedronPanel owns the flat "which index is highlighted"
   state and passes it down so Up/Down/Enter work across group boundaries. */
export default function PoliedronSearchResults({ groups, highlightedIndex, onSelect, onHover }) {
  let flatIndex = -1;
  return (
    <div role="listbox" aria-label="Risultati">
      {groups.map(({ group, items }) => (
        <div key={group} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.txl, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 4px 6px' }}>{group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item) => {
              flatIndex += 1;
              const idx = flatIndex;
              const active = idx === highlightedIndex;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => onHover?.(idx)}
                  onClick={() => onSelect(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: active ? C.priL : 'transparent', color: C.txt,
                  }}
                >
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: active ? `${C.pri}22` : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.kind === 'patient' && <Ic n="pz" s={14} c={active ? C.pri : C.txm} />}
                    {item.kind === 'section' && <DockIc n={item.icon} style="outline" s={14} c={active ? C.pri : C.txm} />}
                    {item.kind === 'action' && <Ic n="zap" s={14} c={active ? C.pri : C.txm} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: active ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  {item.kind === 'patient' && item.data?.telefono && (
                    <span style={{ fontSize: 11, color: C.txl, flexShrink: 0 }}>{item.data.telefono}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export const countFlatItems = (groups) => groups.reduce((n, g) => n + g.items.length, 0);
export const flatItemAt = (groups, index) => {
  let i = 0;
  for (const g of groups) {
    for (const item of g.items) {
      if (i === index) return item;
      i += 1;
    }
  }
  return null;
};
