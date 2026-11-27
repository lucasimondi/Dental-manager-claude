// STUDIO-TELEFONO (PO 2026-11-27: "Procedi con questo stile grafico per tutto il software studio", fase 1, solo
// telefono): icone a colori dello Studio nello stesso stile di Personal (PR #358, cartella di Esplora file).
// Disegni originali, viewBox 48×48, solo SVG statico scritto qui (mai testo dell'utente). Quelli già disegnati per
// Personal si riusano dallo stesso file, così le due app restano coordinate.
import { DISEGNI_COLORE } from '../../personal/src/lib/iconeColore.js';

const STUDIO = {
  pazienti: '<circle cx="33" cy="17" r="6.5" fill="#2B9FD9"/><path d="M22 40a11 11 0 0 1 22 0z" fill="#2B9FD9"/><circle cx="18" cy="17" r="7.5" fill="#0F6CBD"/><path d="M4 41a14 14 0 0 1 28 0z" fill="#0F6CBD"/>',
  incassi: '<circle cx="24" cy="24" r="19" fill="#107C41"/><circle cx="24" cy="24" r="14.5" fill="#21A366"/><path d="M29.5 17.5a8 8 0 1 0 0 13M15 22h11M15 26.5h11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  piani: '<path d="M12 6h18l8 8v27a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#C8C8C8" stroke-width="1.5"/><rect x="13" y="16" width="5" height="5" rx="1.2" fill="#2F6FE0"/><rect x="13" y="25" width="5" height="5" rx="1.2" fill="#2F6FE0"/><rect x="13" y="34" width="5" height="5" rx="1.2" fill="#A9C9EC"/><path d="M21 18.5h11M21 27.5h11M21 36.5h8" stroke="#7A8CA3" stroke-width="2.2" stroke-linecap="round"/>',
  preventivi: '<path d="M10 5h28v37l-4.7-3-4.6 3-4.7-3-4.7 3-4.6-3L10 42z" fill="#fff" stroke="#C8C8C8" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 13h18M15 19h12" stroke="#9A9A9A" stroke-width="2.2" stroke-linecap="round"/><circle cx="31" cy="29" r="8" fill="#7160E8"/><path d="M34 25.5a4.5 4.5 0 1 0 0 7M27 28h5M27 30.5h5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  richiami: '<path d="M24 5a12 12 0 0 0-12 12v10l-5 7h34l-5-7V17A12 12 0 0 0 24 5z" fill="#F7930E"/><path d="M24 5a12 12 0 0 1 12 12v3c-3-5-7-8-12-8s-9 3-12 8v-3A12 12 0 0 1 24 5z" fill="#FFB900"/><circle cx="24" cy="39" r="5" fill="#C42B1C"/>',
  spese: '<rect x="4" y="11" width="40" height="27" rx="5" fill="#C42B1C"/><rect x="4" y="17" width="40" height="6" fill="#7A1E14"/><rect x="10" y="29" width="13" height="4" rx="2" fill="#FFD7D2"/><circle cx="34" cy="31" r="3" fill="#FFB900"/>',
  controllo: '<rect x="5" y="6" width="38" height="36" rx="5" fill="#fff" stroke="#C8C8C8" stroke-width="1.5"/><rect x="11" y="26" width="6" height="10" rx="1.5" fill="#2F6FE0"/><rect x="21" y="16" width="6" height="20" rx="1.5" fill="#13A10E"/><rect x="31" y="21" width="6" height="15" rx="1.5" fill="#F7930E"/>',
  listino: '<path d="M12 5h24a3 3 0 0 1 3 3v33a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="#fff" stroke="#C8C8C8" stroke-width="1.5"/><circle cx="16" cy="15" r="2.4" fill="#0F6CBD"/><circle cx="16" cy="24" r="2.4" fill="#0F6CBD"/><circle cx="16" cy="33" r="2.4" fill="#0F6CBD"/><path d="M21 15h12M21 24h12M21 33h9" stroke="#7A8CA3" stroke-width="2.2" stroke-linecap="round"/>',
  messaggi: '<path d="M24 5c10.5 0 19 7.6 19 17s-8.5 17-19 17c-2.6 0-5-.4-7.3-1.2L7 42l2.6-8.4C6.7 30.6 5 26.5 5 22 5 12.6 13.5 5 24 5z" fill="#13A10E"/><path d="M18 15h3.5l1.5 4-2 1.5a8 8 0 0 0 4.5 4.5l1.5-2 4 1.5V28a2 2 0 0 1-2 2 13 13 0 0 1-13-13 2 2 0 0 1 2-2z" fill="#fff"/>',
  chat: '<path d="M24 6c10.5 0 19 7.2 19 16.5S34.5 39 24 39c-2.2 0-4.3-.3-6.3-.9L8 42l2.4-8.2C7 30.9 5 26.9 5 22.5 5 13.2 13.5 6 24 6z" fill="#0F6CBD"/><path d="M15 19h18M15 26h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  ricetta: '<path d="M12 6h18l8 8v27a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#C8C8C8" stroke-width="1.5"/><path d="M17 18h6a4 4 0 0 1 0 8h-6zM17 26v10M23 26l7 10" fill="none" stroke="#2F6FE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  nuovoAppuntamento: '<rect x="5" y="8" width="38" height="35" rx="5" fill="#fff" stroke="#C8C8C8" stroke-width="1.5"/><path d="M5 13a5 5 0 0 1 5-5h28a5 5 0 0 1 5 5v5H5z" fill="#0F6CBD"/><rect x="13" y="4" width="4" height="9" rx="2" fill="#0A4A85"/><rect x="31" y="4" width="4" height="9" rx="2" fill="#0A4A85"/><path d="M24 24v12M18 30h12" stroke="#0F6CBD" stroke-width="3.2" stroke-linecap="round"/>',
  nuovoPaziente: '<circle cx="19" cy="17" r="8" fill="#0F6CBD"/><path d="M4 42a15 15 0 0 1 30 0z" fill="#0F6CBD"/><path d="M38 14v14M31 21h14" stroke="#13A10E" stroke-width="4" stroke-linecap="round"/>',
  nuovoIncasso: '<circle cx="24" cy="24" r="19" fill="#107C41"/><circle cx="24" cy="24" r="14.5" fill="#21A366"/><path d="M29.5 17.5a8 8 0 1 0 0 13M15 22h11M15 26.5h11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
};

export const DISEGNI_STUDIO = { ...DISEGNI_COLORE, ...STUDIO };

// Voci di navigazione dello Studio (NAV in lib/utils.js) → disegno.
const PER_VOCE = {
  home: 'casa', paz: 'pazienti', piani: 'piani', preventivi: 'preventivi', paga: 'incassi', listino: 'listino', agenda: 'agenda',
  note: 'note', password: 'password', richiami: 'richiami', attivita: 'dafare', spese: 'spese', controllo: 'controllo',
  poliedron: 'assistente', archivio: 'esplora', wa: 'messaggi', chat: 'chat', agenteai: 'assistente', set: 'impostazioni',
  studio: 'studio', perte: 'personale', acquisisci: 'scan',
};
export const idIconaStudio = (id) => (STUDIO[id] || DISEGNI_COLORE[id] ? id : PER_VOCE[id] && DISEGNI_STUDIO[PER_VOCE[id]] ? PER_VOCE[id] : null);
