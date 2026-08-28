import React from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

// POL-UI-004 — shared empty-state primitive: icon-in-circle + title (+
// optional subtitle/action), replacing bare "Nessun ..." text left over from
// the pre-premium UI. Colors stay C.* like every other shared primitive.
export default function EmptyState({ icon = 'clip', title, subtitle, action }) {
  return (
    <div className="pol-ui-state pol-ui-state--empty">
      <div className="pol-ui-state__icon" style={{ background: C.bg }}>
        <Ic n={icon} s={22} c={C.txl} />
      </div>
      <div className="pol-ui-state__title" style={{ color: C.txm }}>{title}</div>
      {subtitle && <div className="pol-ui-state__message" style={{ color: C.txl }}>{subtitle}</div>}
      {action && <div className="pol-ui-state__action">{action}</div>}
    </div>
  );
}
