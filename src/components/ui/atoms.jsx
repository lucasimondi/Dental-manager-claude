import React from 'react';
import { C } from '../../lib/utils';

export const Bdg = ({ ch, co = C.pri }) => (
  <span style={{
    background: co + '20', color: co, fontSize: 11, fontWeight: 700, padding: '2px 8px',
    borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  }}>
    {ch}
  </span>
);

export const Crd = ({ children, style, onClick, ...rest }) => (
  <div
    onClick={onClick}
    {...rest}
    style={{
      background: C.sur, borderRadius: 16, padding: 14, boxShadow: '0 3px 10px rgba(15,23,42,.06)',
      border: `1px solid ${C.brd}`, cursor: onClick ? 'pointer' : 'default', ...(style || {}),
    }}
  >
    {children}
  </div>
);

export const Fld = ({ label, children }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700, color: C.txm, marginBottom: 4,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {label}
    </label>
    {children}
  </div>
);
