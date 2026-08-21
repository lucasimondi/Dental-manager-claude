import React from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

// POL-UI-004 — shared empty-state primitive: icon-in-circle + title (+
// optional subtitle/action), replacing bare "Nessun ..." text left over from
// the pre-premium UI. Colors stay C.* like every other shared primitive.
export default function EmptyState({ icon = 'clip', title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Ic n={icon} s={22} c={C.txl} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.txm }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.txl, marginTop: 4 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
