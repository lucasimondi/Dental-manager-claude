// STUDIO-TELEFONO (PO 2026-11-27): «Start» dello Studio sul telefono, a tutto schermo con tutte le app.
// Lo aprono la barra in basso e «Tutte le app» della Home (evento), lo disegna App.jsx (StartStudio.jsx).
export const EVENTO_START = 'studio:apri-start';
export const apriStartStudio = () => window.dispatchEvent(new CustomEvent(EVENTO_START));

// Gruppi di Start: [titolo, voci]. Si vedono solo le voci che lo studio ha (stesso elenco del menu).
export const GRUPPI_START = [
  ['Lavoro', ['studio', 'agenda', 'paz', 'piani', 'preventivi', 'paga', 'richiami', 'attivita', 'listino']],
  ['Gestione', ['spese', 'controllo', 'archivio', 'home']],
  ['Comunicazione e assistente', ['wa', 'chat', 'poliedron', 'agenteai']],
  ['Personale', ['perte', 'note', 'password']],
  ['Sistema', ['set']],
];
// Voci che non sono nel menu (NAV) ma vanno in Start: la Home dello Studio e Personale.
export const VOCI_EXTRA = { studio: 'Home Studio', perte: 'Personale' };

// Le app di Start dalle voci visibili, a gruppi, con la ricerca per nome.
export function appDiStart(nav = [], cerca = '') {
  const nomi = { ...VOCI_EXTRA, ...Object.fromEntries(nav.map((n) => [n.id, n.id === 'home' ? 'Cruscotto' : n.l])) };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(cerca).trim();
  return GRUPPI_START.map(([titolo, ids]) => [titolo, ids.filter((id) => nomi[id] && (!q || norm(nomi[id]).includes(q))).map((id) => ({ id, nome: nomi[id] }))])
    .filter(([, voci]) => voci.length);
}
