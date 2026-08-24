import React from 'react';
import ReactDOM from 'react-dom';
import Ic from '../ui/Ic.jsx';
import PoliedronOrb from './PoliedronOrb.jsx';

/* POL-UI-015 §9-10: `set` (Impostazioni) no longer has a dock slot — it
   moved to the central Poliedron panel's default suggestions (see
   searchEngine.js's suggestedIdle, "APRI UNA SEZIONE"). Its slot is now
   `chat`: NOT a second page/route and NOT a second Poliedron — it opens
   the exact same conversation the central button already opens (same
   `open`/`onToggle`/`panelId`), per the task's own architectural
   principle. `chat` is handled like `__poliedron__` below rather than
   through the generic `setPage(item.id)` path every other item uses,
   since there is no `'chat'` page for App.jsx to navigate to. */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'paz', label: 'Pazienti', icon: 'pz' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
]);

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId }) {
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

        if (item.id === 'chat') {
          return (
            <button
              key={item.id}
              type="button"
              className={`poliedron-mobile-dock__item${open ? ' is-active' : ''}`}
              aria-label={`${item.label} Poliedron`}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={panelId}
              tabIndex={open ? -1 : 0}
              onClick={onToggle}
            >
              <Ic n={item.icon} s={22} />
            </button>
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
