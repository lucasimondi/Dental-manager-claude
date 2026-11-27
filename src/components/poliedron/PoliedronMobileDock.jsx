import React from 'react';
import ReactDOM from 'react-dom';
import Ic from '../ui/Ic.jsx';
import PoliedronOrb from './PoliedronOrb.jsx';
import './dockAgenda.css'; // AGENDA-TASTI

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
/* APP-UNICA (PO 2026-11-08): un solo dock, uguale a Personal: Agenda · Note · Poliedron ·
   Documenti · Altro. «Altro» raccoglie Lavoro (studio) e Vita (personale); niente più tasto
   che porta a un'altra app. */
/* HOME-AGENDA-CENTRIC (PO 2026-11-07): la ricerca in cima all'agenda sostituisce Pazienti e
   Chat; l'agenda è la Home. Dock: Agenda · Note · Poliedron · Documenti · Personal, la stessa
   struttura del dock di Personal (che al posto di Personal ha Studio). Home, Pazienti e Chat
   restano raggiungibili dalla ricerca. Senza l'archivio documenti nel piano, quel posto torna
   a Pazienti invece di portare a una pagina non disponibile. */
/* DOCK-PER-TE (PO 2026-11-08): «Altro» era troppo generico. Agenda · Documenti · Poliedron ·
   Studio · Per te: consultare (Agenda, Documenti), chiedere (Poliedron al centro), lavoro dello
   studio (Studio) e vita personale (Per te: spese, documenti personali, foto, note, diario…). */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: 'archivio', label: 'Documenti', icon: 'folder' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'studio', label: 'Studio', icon: 'brief' },
  { id: 'perte', label: 'Personale', icon: 'user' }, // PERSONALE-HOME (PO 2026-11-16)
]);
/* AGENDA-TASTI (PO 2026-11-27: "si parte da agenda che è comune, su agenda deve esserci semplicemente la possibilità
   di andare a personale o studio" → mockup N1 → "va bene agenda con i tasti personal e studio, quindi facciamo solo
   tasti agenda"): sull'Agenda comune la barra ha solo Personale · Poliedron · Studio, solo icone (PO: "Togli le scritte deve essere più pulito solo con icone").
   Nelle altre pagine la barra resta quella di prima. */
export const AGENDA_DOCK_ITEMS = Object.freeze([
  { id: 'perte', label: 'Personale', icon: 'user' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'studio', label: 'Studio', icon: 'brief' },
]);
export const mobileDockItems = ({ archivio = true, page = null } = {}) => (page === 'agenda' ? AGENDA_DOCK_ITEMS : MOBILE_DOCK_ITEMS.map((item) => (
  item.id === 'archivio' && !archivio ? { id: 'paz', label: 'Pazienti', icon: 'pz' } : item
)));
// Disegni a colori dei due tasti dell'Agenda (stessi di Personal, PR #358): costanti del codice, mai testo dell'utente.
const DISEGNO_AGENDA = {
  perte: '<circle cx="24" cy="24" r="20" fill="#DCEBFA"/><circle cx="24" cy="19" r="7.5" fill="#0F6CBD"/><path d="M10.5 38a14 14 0 0 1 27 0A19.9 19.9 0 0 1 24 44c-5.2 0-9.9-2.2-13.5-6z" fill="#0F6CBD"/>',
  studio: '<path d="M15 5c-6 0-9 4.7-9 11 0 8 3.8 11 5.2 19S13.4 46 17 46s3.6-11 7-11 3.4 11 7 11 4.4-3 5.8-11S42 24 42 16c0-6.3-3-11-9-11-4.4 0-6 2.5-9 2.5S19.4 5 15 5z" fill="#fff" stroke="#038387" stroke-width="2.4"/>',
};

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId, positionLocked, archivio = true }) {
  return (
    <nav
      className={`poliedron-mobile-dock${page === 'agenda' ? ' poliedron-mobile-dock--agenda' : ''}${open ? ' is-receded' : ''}`}
      aria-label="Navigazione principale"
      aria-hidden={open ? 'true' : undefined}
    >
      {mobileDockItems({ archivio, page }).map((item) => {
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

        if (page === 'agenda') {
          return (
            <button key={item.id} type="button" className="poliedron-mobile-dock__item poliedron-mobile-dock__spazio" aria-label={item.label} tabIndex={open ? -1 : 0} onClick={() => setPage(item.id)}>
              <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DISEGNO_AGENDA[item.id] }} />
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
            onClick={() => {
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
