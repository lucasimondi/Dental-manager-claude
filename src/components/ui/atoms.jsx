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

// POL-UI-004 — shared surface primitive, used across nearly every page
// (Pazienti, Piani, Pagamenti, Richiami, Agenda, SchedaPaz, Controllo di
// Gestione, Impostazioni, Fisio...). Upgrading its default depth here is
// the single highest-leverage way to bring Home's premium surface language
// app-wide without rewriting each page. `onClick`-bearing cards get the
// `.pol-card--interactive` hover-lift (see PremiumVisualSystem.css); every
// value here is C.* (theme-reactive at render time) or a translucent
// shadow that already reads correctly on both Light and Dark Premium.
export const Crd = ({ children, style, onClick, className, ...rest }) => (
  <div
    onClick={onClick}
    className={[onClick ? 'pol-card--interactive' : '', className].filter(Boolean).join(' ') || undefined}
    {...rest}
    style={{
      background: C.sur, borderRadius: 16, padding: 14,
      boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 20px rgba(15,23,42,.07)',
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
