import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

export default function SearchSel({ options, value, onChange, placeholder = 'Cerca o seleziona…', emptyLabel = 'Nessun risultato' }) {
  // options: array di { value, label, sub? }
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.sub || '').toLowerCase().includes(q.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const select = (val) => { onChange(val); setOpen(false); setQ(''); };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 36px 11px 12px', border: `1.5px solid ${open ? C.pri : C.brd}`,
          borderRadius: 10, fontSize: 14, color: selected ? C.txt : C.txl, background: C.sur,
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: C.txl, fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000,
          background: C.sur, border: `1.5px solid ${C.pri}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 3, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.brd}`, position: 'relative' }}>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cerca…"
              style={{
                width: '100%', padding: '7px 30px 7px 10px', border: `1.5px solid ${C.brd}`,
                borderRadius: 8, fontSize: 13, color: C.txt, background: C.bg,
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            {q && (
              <button onClick={() => setQ('')} style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.txl, fontSize: 14, padding: 0 }}>✕</button>
            )}
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '14px 12px', color: C.txl, fontSize: 13, textAlign: 'center' }}>{emptyLabel}</div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => select(o.value)}
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  background: String(o.value) === String(value) ? C.priL : 'transparent',
                  borderBottom: `1px solid ${C.brd}`,
                }}
                onMouseEnter={e => { if (String(o.value) !== String(value)) e.currentTarget.style.background = C.bg; }}
                onMouseLeave={e => { if (String(o.value) !== String(value)) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 13, fontWeight: String(o.value) === String(value) ? 700 : 500, color: String(o.value) === String(value) ? C.pri : C.txt }}>
                  {o.label}
                </div>
                {o.sub && <div style={{ fontSize: 11, color: C.txl, marginTop: 1 }}>{o.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
