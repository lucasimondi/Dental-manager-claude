import React from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

// POL-UI-004 — shared page-level header: icon + title (+ optional
// subtitle/right-aligned actions), matching Home's hero typography
// (bold, tight letter-spacing) instead of each page hand-rolling its own
// `<div style={{fontSize:20,fontWeight:800}}>`. Colors stay C.* (the
// existing theme-reactive mechanism every page already uses) rather than
// introducing a second, CSS-variable-based text-color system.
export default function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', color: C.txt }}>
          {icon && <Ic n={icon} s={18} c={C.pri} />}
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: C.txm, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
