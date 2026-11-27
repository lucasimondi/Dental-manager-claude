import React from 'react';
import ReactDOM from 'react-dom';
import PoliedronOrb from './PoliedronOrb.jsx';
import IconaColoreStudio from '../IconaColoreStudio.jsx';
import './studioBarra.css';
import { apriStartStudio } from '../../lib/startStudio.js';

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
/* STUDIO-TELEFONO (PO 2026-11-27: "Procedi con questo stile grafico per tutto il software studio", fase 1, solo
   telefono): la barra prende lo stile di Personal, icone a colori, Start (apre «Tutte le app» a tutto schermo,
   evento `studio:apri-start` gestito in App.jsx).
   NAVIGAZIONE N4 (PO 2026-11-27: "si parte da agenda che è comune, su agenda deve esserci semplicemente la
   possibilità di andare a personale o studio, da personale e studio [...] muoversi da personale a studio" → mockup
   → "N4"): sull'Agenda (comune) la barra ha solo Personale · Poliedron · Studio; nello Studio la barra è
   Agenda · Start · Pazienti · Poliedron · Documenti · Incassi · Studio; il passaggio Studio ⇄ Personale è
   l'interruttore in cima alle due Home. Poliedron resta al centro. */
export const MOBILE_DOCK_ITEMS = Object.freeze([
  { id: 'agenda', label: 'Agenda', icon: 'cal' },
  { id: '__start__', label: 'Start', icon: null },
  { id: 'paz', label: 'Pazienti', icon: 'pz' },
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'archivio', label: 'Documenti', icon: 'folder' },
  { id: 'paga', label: 'Incassi', icon: 'pay' },
  { id: 'studio', label: 'Studio', icon: 'brief' },
]);
// Sull'Agenda comune: solo i due spazi, Poliedron in mezzo.
export const AGENDA_DOCK_ITEMS = Object.freeze([
  { id: 'perte', label: 'Personale', icon: 'user' }, // PERSONALE-HOME (PO 2026-11-16)
  { id: '__poliedron__', label: 'Poliedron', icon: null },
  { id: 'studio', label: 'Studio', icon: 'brief' },
]);
// Senza l'archivio documenti nel piano, quel posto va a Richiami (Pazienti e Incassi sono già nella barra).
export const mobileDockItems = ({ archivio = true, page = null } = {}) => (page === 'agenda' ? AGENDA_DOCK_ITEMS : MOBILE_DOCK_ITEMS.map((item) => (
  item.id === 'archivio' && !archivio ? { id: 'richiami', label: 'Richiami', icon: 'clk' } : item
)));

export default function PoliedronMobileDock({ page, setPage, open, onToggle, panelId, positionLocked, archivio = true }) {
  return (
    <nav
      className={`poliedron-mobile-dock studio-barra${page === 'agenda' ? ' studio-barra--agenda' : ''}${open ? ' is-receded' : ''}`}
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

        if (item.id === '__start__') {
          return (
            <button key={item.id} type="button" className="poliedron-mobile-dock__item studio-barra__start" aria-label={item.label} tabIndex={open ? -1 : 0} onClick={apriStartStudio}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12v9M12 12l8-4.5M12 12L4 7.5" /></svg>
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
            <IconaColoreStudio id={item.id} size={28} />
            {page === 'agenda' && <span className="studio-barra__nome">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
