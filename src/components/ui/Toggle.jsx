import React from 'react';
import { C } from '../../lib/utils';

// POL-UI-005 — shared iOS-style toggle switch, replacing the 3+ separately
// hand-rolled versions in Impostazioni (multi-agenda, documenti list) and
// GestioneUtenti (capability pills). `color` lets each caller keep its own
// on-state tint (defaults to C.pri) via a per-instance CSS var.
export default function Toggle({ on, onChange, color = C.pri, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!on)}
      className={`pol-toggle${on ? ' is-on' : ''}`}
      style={{ '--pol-toggle-on': color }}
    >
      <span className="pol-toggle__knob" />
    </button>
  );
}
