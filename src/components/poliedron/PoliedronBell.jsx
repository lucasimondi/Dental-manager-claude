import React from 'react';

/* POL-UI-015 §7/§8 — UI-only placeholder for the future Poliedron
   notification/reminder surface. This task explicitly does NOT build a
   notification engine: `unreadCount` is a plain prop with no live
   producer anywhere yet (every caller today passes 0, the default).
   Clicking the bell opens the exact SAME Poliedron conversation every
   other entry point (Orb/Edge Dock) already opens — `onToggle`/`open`/
   `panelId` are the same values Poliedron.jsx already threads to those,
   never a second agent, a second open/close state, or a second route.
   The red badge is purely presentational until a real notification
   source exists (a future task) — see the architecture doc's
   POLYEDRON_BELL_HANDOFF section for the exact contract a future
   reminder/notification engine should fill in. */
export default function PoliedronBell({ variant = 'mobile', open, onToggle, unreadCount = 0, panelId }) {
  const hasUnread = unreadCount > 0;
  return (
    <button
      type="button"
      className={`poliedron-bell poliedron-bell--${variant}${open ? ' is-open' : ''}`}
      aria-label={hasUnread ? `Notifiche Poliedron: ${unreadCount} non lette` : 'Notifiche Poliedron'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0-6 6v3.09c0 .5-.16.99-.46 1.4L4 15.5a1 1 0 0 0 .8 1.6h14.4a1 1 0 0 0 .8-1.6l-1.54-2.01a2.4 2.4 0 0 1-.46-1.4V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {hasUnread && <span className="poliedron-bell__badge" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
  );
}
