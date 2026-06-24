import React from 'react';
import { C } from '../../lib/utils';

const IS = {
  width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10,
  fontSize: 16, color: C.txt, background: C.sur, boxSizing: 'border-box', WebkitAppearance: 'none',
};

export const Inp = (p) => <input {...p} style={{ ...IS, ...(p.style || {}) }} />;
export const Sel = ({ children, ...p }) => (
  <select {...p} style={{ ...IS, ...(p.style || {}) }}>{children}</select>
);
export const Txt = (p) => <textarea {...p} rows={p.rows || 3} style={{ ...IS, resize: 'vertical', ...(p.style || {}) }} />;
