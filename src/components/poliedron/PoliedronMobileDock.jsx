import React from 'react';
import ReactDOM from 'react-dom';
import Ic from '../ui/Ic.jsx';
import PoliedronOrb from './PoliedronOrb.jsx';

/* POL-UI-015 §9-10: `set` (Impostazioni) no longer has a dock slot — it
   moved to the central Poliedron panel's default suggestions (see
   searchEngine.js's suggestedIdle, "APRI UNA SEZIONE"). Its slot is now
   `chat`.

   POL-CHAT-001 merge (PR #53 into the merged PR #51): PR #51 could only
   ship `chat` as a PLACEHOLDER — it called `onToggle`, i.e. it reopened
   the quick Poliedron panel, because no Chat route existed yet. The real
   persistent Chat now does exist, so this slot navigates to it through the
   same generic `setPage(item.id)` path every other dock item uses, and the
   placeholder branch is gone. This is still ONE Poliedron: the Chat page is
   a portal host that the single Poliedron instance renders into (see
   App.jsx's `poliedronChatHost` and Poliedron.jsx's `chatHost`), not a
   second agent. The unread badge reflects the same conversation. */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'paz', label: 'Pazienti', icon: 'pz' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
]);

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId, unreadCount = 0 }) {
  return (
    <nav
      className={`poliedron-mobile-dock${open ? ' is-receded' : ''}`}
      aria-label="Navigazione principale"
      aria-hidden={open ? 'true' : undefined}
    >
      {MOBILE_DOCK_ITEMS.map((item) => {
        if (item.id === '__poliedron__') {
          return (
            <div key={item.id} className="poliedron-mobile-dock__hero-slot" data-slot="poliedron">
              {ReactDOM.createPortal(
                <PoliedronOrb open={open} onToggle={onToggle} panelId={panelId} interactive={!open} />,
                document.body
              )}
            </div>
          );
        }

        const active = page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`poliedron-mobile-dock__item${active ? ' is-active' : ''}`}
            aria-label={item.id === 'chat' && unreadCount > 0
              ? `${item.label}, ${unreadCount} non ${unreadCount === 1 ? 'letto' : 'letti'}`
              : item.label}
            aria-current={active ? 'page' : undefined}
            tabIndex={open ? -1 : 0}
            onClick={() => setPage(item.id)}
          >
            <Ic n={item.icon} s={22} />
            {item.id === 'chat' && unreadCount > 0 && (
              <span className="poliedron-mobile-dock__badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
