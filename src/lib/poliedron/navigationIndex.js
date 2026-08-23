/* POL-AI-001 §8 — canonical navigation index.
   Wraps the existing NAV array (src/lib/utils.js — the single source of
   truth every other nav surface, PremiumSidebar included, already reads
   from) with search aliases, so Poliedron can resolve "pag"/"incassi"/
   "soldi" to Pagamenti without any component hardcoding page logic. No
   second nav model: `page` below is exactly the NAV id, the same value
   App.jsx's setPage(page) already expects. */

import { NAV } from '../utils.js';

// Extra search terms per NAV id — real Italian synonyms a user might type,
// not a translation layer. Adding a section later only means one NAV entry
// (utils.js) + one optional line here, never new UI logic.
const ALIASES = Object.freeze({
  home: ['dashboard', 'inizio', 'home page'],
  paz: ['pazienti', 'clienti', 'anagrafica', 'cartelle'],
  piani: ['preventivi', 'piano di cura', 'piani di cura', 'preventivo'],
  paga: ['pagamenti', 'incassi', 'incasso', 'soldi'],
  listino: ['listino prezzi', 'prezzi', 'tariffario', 'tariffe'],
  agenda: ['calendario', 'appuntamenti', 'appuntamento'],
  richiami: ['richiamo', 'promemoria', 'recall', 'follow up'],
  spese: ['spesa', 'costi', 'uscite'],
  controllo: ['controllo di gestione', 'gestione', 'economico', 'kpi', 'management control', 'conto economico'],
  archivio: ['documenti', 'archivio documenti', 'files', 'file'],
  wa: ['whatsapp', 'messaggi', 'messaggio'],
  agenteai: ['assistente ai', 'ai setup', 'configurazione ai'],
  set: ['impostazioni', 'setup', 'configurazione', 'profilo', 'team', 'postazioni'],
});

export const NAVIGATION_INDEX = Object.freeze(
  NAV.map((item) => Object.freeze({
    id: item.id,
    label: item.l,
    icon: item.ic,
    page: item.id,
    aliases: ALIASES[item.id] || Object.freeze([]),
  }))
);

export const findNavigationById = (id) => NAVIGATION_INDEX.find((n) => n.id === id) || null;
