import React from 'react';
import ReactDOM from 'react-dom';
import Ic from '../ui/Ic.jsx';
import PoliedronOrb from './PoliedronOrb.jsx';

export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'paz', label: 'Pazienti', icon: 'pz' },
  { id: 'set', label: 'Setup', icon: 'set' },
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
