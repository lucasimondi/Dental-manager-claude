import React from 'react';
import { getLogoSlug, LOGO_SLUG_LABEL } from '../../lib/utils';

/* POL-UX-002 section 4 — brand lockup for dark chrome (sidebar / mobile
   header). Root cause of the previous look: the shipped white "outline"
   logo assets (logo-poliedra-*-outline.png) render the wordmark as a
   near-invisible hairline stroke against the dark navy gradient — only the
   icon mark reads. Rendering the wordmark in code instead guarantees
   legibility on any background and lets it evolve per vertical (POLIEDRA +
   a small descriptor) from one label map (LOGO_SLUG_LABEL in utils.js)
   without duplicating markup per profession. Uses only the existing
   turquoise/azure design tokens, no new palette. */
export default function PoliedraBrand({ vertical, size = 'md' }) {
  const label = LOGO_SLUG_LABEL[getLogoSlug(vertical)] || LOGO_SLUG_LABEL.salus;
  return (
    <div className={`pol-brand pol-brand--${size}`}>
      <svg className="pol-brand__mark" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="12,1 22,7 22,17 12,23 2,17 2,7" fill="url(#pol-brand-grad)" />
        <polygon points="12,1 22,7 12,12" fill="#fff" opacity=".22" />
        <polygon points="2,7 12,1 12,12" fill="#fff" opacity=".10" />
        <defs>
          <linearGradient id="pol-brand-grad" x1="2" y1="1" x2="22" y2="23">
            <stop offset="0" stopColor="var(--pol-turquoise-500)" />
            <stop offset="1" stopColor="var(--pol-azure-600)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="pol-brand__text">
        <span className="pol-brand__name">POLIEDRA</span>
        <span className="pol-brand__vertical">{label}</span>
      </span>
    </div>
  );
}
