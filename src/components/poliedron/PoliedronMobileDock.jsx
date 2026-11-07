import React from 'react';
import ReactDOM from 'react-dom';
import Ic from '../ui/Ic.jsx';
import { agendaDestination } from '../../../shared/agenda/navigation.js';
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
/* HOME-AGENDA-CENTRIC (PO 2026-11-07): la ricerca in cima all'agenda sostituisce Pazienti e
   Chat; l'agenda è la Home. Dock: Agenda · Note · Poliedron · Documenti · Personal, la stessa
   struttura del dock di Personal (che al posto di Personal ha Studio). Home, Pazienti e Chat
   restano raggiungibili dalla ricerca. Senza l'archivio documenti nel piano, quel posto torna
   a Pazienti invece di portare a una pagina non disponibile. */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: 'note', label: 'Note', icon: 'edit' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'archivio', label: 'Documenti', icon: 'folder' },
  { id: '__personal__', label: 'Personal', icon: 'home' },
]);
export const mobileDockItems = ({ archivio = true } = {}) => MOBILE_DOCK_ITEMS.map((item) => (
  item.id === 'archivio' && !archivio ? { id: 'paz', label: 'Pazienti', icon: 'pz' } : item
));

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId, positionLocked, archivio = true }) {
  return (
    <nav
      className={`poliedron-mobile-dock${open ? ' is-receded' : ''}`}
      aria-label="Navigazione principale"
      aria-hidden={open ? 'true' : undefined}
    >
      {mobileDockItems({ archivio }).map((item) => {
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
            onClick={() => {
              if (item.id === '__personal__') { globalThis.location.assign(agendaDestination('personal', new Date().toLocaleDateString('sv-SE'), 'giorno')); return; }
              setPage(item.id);
            }}
          >
            <Ic n={item.icon} s={22} />
          </button>
        );
      })}
    </nav>
  );
}
