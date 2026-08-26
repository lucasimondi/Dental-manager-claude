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
   second agent.

   POL-CHAT-001 §FASE 9 — the unread badge is owned by the NOTIFICATION BELL
   only (`PoliedronBell`, mobile and desktop). This dock slot deliberately
   carries NO badge: the bell and the dock both point at the same single
   conversation, so a second badge here would be a duplicate of the same
   count on the same screen. The dock's approved geometry, position and size
   are unchanged. */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'paz', label: 'Pazienti', icon: 'pz' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
]);

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId, positionLocked }) {
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
                <PoliedronOrb open={open} onToggle={onToggle} panelId={panelId} interactive={!open} positionLocked={positionLocked} />,
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
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            tabIndex={open ? -1 : 0}
            onClick={() => setPage(item.id)}
          >
            <Ic n={item.icon} s={22} />
          </button>
        );
      })}
    </nav>
  );
}
