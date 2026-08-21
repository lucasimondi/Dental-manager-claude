import React from 'react';
import { Ic } from './ui';

/* POL-UI-003 — premium desktop/tablet-large navigation sidebar.
   Visual-only shell around the app's real navigation: it renders the same
   `nav` items and calls the same `setPage` App.jsx already uses for the
   bottom nav / MobileDock. No routing logic lives here — see App.jsx for
   the single source of truth (`navVisibile`, `page`, `setPage`). Mobile
   keeps its existing MobileDock; this component only ever mounts when
   `!isMobile`.
   POL-UI-004 Recovery — `logoSrc` is resolved in App.jsx (studio's custom
   logo, falling back to the original per-vertical Poliedra asset) and
   rendered directly, restoring the original logo lockup. */
export default function PremiumSidebar({ nav, page, setPage, logoSrc, studioName, userName, onLogout }) {
  return (
    <aside className="premium-sidebar">
      <div className="premium-sidebar__brand">
        <img src={logoSrc} alt={studioName || 'Poliedra'} className="premium-sidebar__logo" />
      </div>

      <nav className="premium-sidebar__nav" aria-label="Navigazione principale">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`premium-sidebar__item${page === n.id ? ' is-active' : ''}`}
            aria-current={page === n.id ? 'page' : undefined}
            onClick={() => setPage(n.id)}
          >
            <Ic n={n.ic} s={16} c={page === n.id ? '#fff' : 'currentColor'} />
            <span>{n.l}</span>
          </button>
        ))}
      </nav>

      <div className="premium-sidebar__footer">
        <div className="premium-sidebar__identity">
          {studioName && <div className="premium-sidebar__studio">{studioName}</div>}
          {userName && <div className="premium-sidebar__user">{userName}</div>}
        </div>
        <button type="button" className="premium-sidebar__footer-btn premium-sidebar__logout" onClick={onLogout}>
          <Ic n="x" s={14} c="currentColor" /><span>Esci</span>
        </button>
      </div>
    </aside>
  );
}
