import React from 'react';
import { C } from '../../lib/utils';

const IS = {
  width: '100%', maxWidth: '100%', minWidth: 0, padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10,
  fontSize: 16, color: C.txt, background: C.sur, boxSizing: 'border-box', WebkitAppearance: 'none',
};

// POL-UI-004: a real :focus ring (border + soft glow) needs a CSS
// pseudo-class, which inline styles can't express — but the ring color must
// still track the live theme/brand accent (C.pri, mutated in place, can be a
// custom studio color). Passing it down as inline CSS custom properties lets
// `.pol-input:focus` in PremiumVisualSystem.css read it via var() while
// staying fully reactive to theme/brand changes at render time.
const focusVars = () => ({ '--pol-focus': C.pri, '--pol-focus-ring': `${C.pri}26` });
const cls = (extra) => ['pol-input', extra].filter(Boolean).join(' ');

export const Inp = ({ className, style, ...p }) => (
  <input {...p} className={cls(className)} style={{ ...IS, ...focusVars(), ...(style || {}) }} />
);
export const Sel = ({ children, className, style, ...p }) => (
  <select {...p} className={cls(className)} style={{ ...IS, ...focusVars(), ...(style || {}) }}>{children}</select>
);
export const Txt = ({ className, style, ...p }) => (
  <textarea {...p} rows={p.rows || 3} className={cls(className)} style={{ ...IS, resize: 'vertical', ...focusVars(), ...(style || {}) }} />
);
