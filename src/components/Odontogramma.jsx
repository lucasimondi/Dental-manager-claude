import React from 'react';
import { C } from '../lib/utils';
import { Ic } from './ui';

export const ODO_ROWS = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];
const denteW = (n) => { const u = n % 10; return (u === 8 || u === 7 || u === 6) ? 20 : 16; };
const denteH = (n) => { const u = n % 10; return (u === 8 || u === 7 || u === 6) ? 26 : 22; };

export default function Odontogramma({
  selected = [],
  onChange = () => {},
  onDenteChange = () => {},
  statusByTooth = {},
  onToothActivate,
  title = 'Seleziona denti',
}) {
  const toggle = (d) => {
    const s = new Set(selected);
    s.has(d) ? s.delete(d) : s.add(d);
    const arr = [...s];
    onChange(arr);
    onDenteChange(arr.length > 0 ? arr.sort((a, b) => a - b).join(', ') : '');
  };
  const clearAll = () => { onChange([]); onDenteChange(''); };

  const renderRow = (row, rowIdx) => {
    const sup = rowIdx === 0;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: sup ? 'flex-end' : 'flex-start', gap: 1 }}>
        {row.map((d, i) => {
          const sel = selected.includes(d);
          const status = statusByTooth[String(d)] || null;
          const statusColor = status?.remaining > 0 ? C.war : status?.completed > 0 ? C.suc : null;
          const w = denteW(d), h = denteH(d);
          const br = sup ? `${i < 8 ? 3 : 3}px ${i < 8 ? 3 : 3}px 1px 1px` : `1px 1px ${i < 8 ? 3 : 3}px ${i < 8 ? 3 : 3}px`;
          return (
            <React.Fragment key={d}>
              {i === 8 && <div style={{ width: 2, background: C.pri + '30', alignSelf: 'stretch', borderRadius: 1, margin: '0 1px' }} />}
              <button
                onClick={() => {
                  toggle(d);
                  onToothActivate?.(d);
                }}
                title={`Dente ${d}`}
                aria-label={`Dente ${d}${status ? `, ${status.total} prestazioni, ${status.remaining} da fare` : ', nessuna prestazione'}`}
                aria-pressed={sel}
                style={{
                  width: `clamp(${w}px, 5.2vw, ${w + 8}px)`, height: `clamp(${h}px, 7vw, ${h + 9}px)`, borderRadius: br,
                  background: sel ? C.pri : statusColor ? `${statusColor}22` : C.sur,
                  border: `1.5px solid ${sel ? C.pri : statusColor || C.brd}`, cursor: 'pointer', padding: 0, flexShrink: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: sup ? 'flex-end' : 'flex-start', paddingTop: sup ? 0 : 2, paddingBottom: sup ? 2 : 0,
                  transition: 'background 0.1s,border 0.1s', boxShadow: sel ? `0 0 0 2px ${C.pri}40` : 'none',
                }}
              >
                <span style={{ fontSize: 6.5, fontWeight: 700, color: sel ? '#fff' : C.txl, lineHeight: 1, userSelect: 'none' }}>{d}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 8px 8px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="tooth" s={11} c={C.pri} />{title}</div>
        {selected.length > 0 && <button onClick={clearAll} style={{ background: C.danL, border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 10, color: C.dan, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><Ic n="x" s={9} c={C.dan} />deseleziona</button>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginBottom: 3 }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.txl, fontWeight: 700 }}>Q1 (dx)</div>
        <div style={{ width: 4 }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.txl, fontWeight: 700 }}>Q2 (sx)</div>
      </div>
      {renderRow(ODO_ROWS[0], 0)}
      <div style={{ height: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
        <div style={{ flex: 1, height: 2, background: `linear-gradient(to left,${C.brd} 40%,${C.pri}50 100%)`, borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: C.pri, borderRadius: 1, margin: '0 1px' }} />
        <div style={{ flex: 1, height: 2, background: `linear-gradient(to right,${C.brd} 40%,${C.pri}50 100%)`, borderRadius: 1 }} />
      </div>
      {renderRow(ODO_ROWS[1], 1)}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 3 }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.txl, fontWeight: 700 }}>Q4 (dx)</div>
        <div style={{ width: 4 }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.txl, fontWeight: 700 }}>Q3 (sx)</div>
      </div>
      {selected.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 5, fontSize: 11, color: C.pri, fontWeight: 700 }}>
          Selezionati: {selected.slice().sort((a, b) => a - b).join(', ')}
        </div>
      )}
      <div style={{ fontSize: 9, color: C.txl, textAlign: 'center', marginTop: 4 }}>Tocca uno o più denti · selezione multipla</div>
    </div>
  );
}
