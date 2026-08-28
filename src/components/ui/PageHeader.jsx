import React from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

// POL-UI-005 — shared page-level header, upgraded from the plain
// icon+title+subtitle row (POL-UI-004) to a real premium page header:
// the icon now sits in a small gradient chip with depth (matching the
// sidebar/dock's "premium" treatment) and the whole block gets a subtle
// bottom border to separate it from page content, plus an optional
// `crumb` eyebrow line for lightweight context ("Setup / Team" etc.) —
// never a hero, still compact on both desktop and mobile (the
// `.pol-page-header` class only carries responsive sizing/spacing; every
// color is still C.* inline, the same theme-reactive source every page
// already uses, so this never introduces a second color system).
export default function PageHeader({ icon, title, subtitle, crumb, actions, onBack, backLabel = 'Indietro', primaryAction, secondaryActions }) {
  const overflowActions = React.Children.toArray(secondaryActions);
  return (
    <div className="pol-page-header" style={{ borderBottom: `1px solid ${C.brd}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {onBack && (
          <button type="button" className="pol-page-header__back" onClick={onBack} aria-label={backLabel}>
            <Ic n="back" s={18} />
          </button>
        )}
        {icon && (
          <div className="pol-page-header__icon" style={{ background: `linear-gradient(135deg, ${C.pri}, ${C.priD})`, boxShadow: `0 4px 12px -3px ${C.pri}55, inset 0 1px 0 rgba(255,255,255,.25)` }}>
            <Ic n={icon} s={18} c="#fff" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {crumb && <div className="pol-page-header__crumb" style={{ color: C.txl }}>{crumb}</div>}
          <div className="pol-page-header__title" style={{ color: C.txt }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.txm, marginTop: 3 }}>{subtitle}</div>}
        </div>
      </div>
      {(actions || primaryAction || overflowActions.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {primaryAction || actions}
          {overflowActions.length > 0 && (
            <details className="pol-page-header__overflow">
              <summary className="pol-page-header__overflow-trigger" aria-label="Altre azioni"><span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>⋯</span></summary>
              <div className="pol-page-header__overflow-menu">{overflowActions}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
