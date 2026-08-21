import React from 'react';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

// POL-UI-005 — shared KPI/stat tile: icon chip (gradient, distinct per
// metric) + value + label, formalizing the pattern Pagamenti/Richiami
// already used ad hoc (plain colored icon chip) and replacing the
// icon-less/repeated-icon KPI cards flagged on Pazienti and Piani. Pass a
// distinct `icon` per stat — the whole point is that six KPIs no longer
// share one icon differentiated only by color.
export default function StatCard({ icon, value, label, color = C.pri, active = false, onClick, style }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="pol-stat-card"
      style={{
        background: active ? color + '14' : C.sur,
        borderColor: active ? color + '55' : C.brd,
        boxShadow: active ? `0 6px 16px -5px ${color}55` : '0 1px 2px rgba(15,23,42,.04), 0 6px 14px rgba(15,23,42,.06)',
        ...style,
      }}
    >
      {icon && (
        <div className="pol-stat-card__icon" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
          <Ic n={icon} s={17} c="#fff" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="pol-stat-card__value" style={{ color: active ? color : C.txt }}>{value}</div>
        <div className="pol-stat-card__label" style={{ color: active ? color : C.txm }}>{label}</div>
      </div>
    </Tag>
  );
}
