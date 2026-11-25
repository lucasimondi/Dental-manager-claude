// PERSONAL-MULTITASK (PO 2026-11-25: «rendere più funzionante il ridimensionamento delle finestre,
// lavorare multitasking con più finestre, tutto come Windows 11 … un sistema operativo Windows per
// cellulare, ad esempio con le scrivanie»). Logica pura:
// - Snap: trascinando una finestra sul bordo si aggancia (metà, quarti; in alto = ingrandita; sul
//   telefono metà sopra / metà sotto); schemi di affiancamento dal tasto Ingrandisci (Snap layouts).
// - Divisore tra due finestre agganciate una accanto all'altra: sposta il confine di entrambe.
// - Scrivanie virtuali (Visualizzazione attività): ogni finestra sta in una scrivania; si crea, si
//   rinomina, si chiude (le finestre passano alla scrivania vicina), si sposta una finestra.
import { telefono, limitaRiquadro } from './finestre.js';

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
export const BORDO_SNAP = 18;

// Riquadro di una zona d'aggancio nell'area di lavoro. frazione = dove sta il confine (0..1).
export function rettangoloZona(zona, area, frazione = 0.5) {
  const { w, h } = area, fx = Math.round(w * frazione), fy = Math.round(h * frazione);
  const Z = {
    sinistra: { x: 0, y: 0, w: fx, h }, destra: { x: fx, y: 0, w: w - fx, h },
    sopra: { x: 0, y: 0, w, h: fy }, sotto: { x: 0, y: fy, w, h: h - fy },
    'alto-sx': { x: 0, y: 0, w: fx, h: fy }, 'alto-dx': { x: fx, y: 0, w: w - fx, h: fy },
    'basso-sx': { x: 0, y: fy, w: fx, h: h - fy }, 'basso-dx': { x: fx, y: fy, w: w - fx, h: h - fy },
    'due-terzi-sx': { x: 0, y: 0, w: Math.round(w * 2 / 3), h }, 'terzo-dx': { x: Math.round(w * 2 / 3), y: 0, w: w - Math.round(w * 2 / 3), h },
    'terzo-1': { x: 0, y: 0, w: Math.round(w / 3), h }, 'terzo-2': { x: Math.round(w / 3), y: 0, w: Math.round(w / 3), h }, 'terzo-3': { x: Math.round(w * 2 / 3), y: 0, w: w - Math.round(w * 2 / 3), h },
  };
  return Z[zona] || null;
}

// Zona sotto il puntatore mentre si trascina il titolo (null = nessun aggancio).
export function zonaDaPunto(x, y, area) {
  const b = BORDO_SNAP;
  if (telefono(area) && area.h >= area.w) {
    if (y <= b) return 'massimo';
    if (y < area.h * 0.16) return 'sopra';
    if (y > area.h * 0.86) return 'sotto';
    return null;
  }
  const angolo = Math.min(90, area.h * 0.18);
  if (x <= b) return y < angolo ? 'alto-sx' : y > area.h - angolo ? 'basso-sx' : 'sinistra';
  if (x >= area.w - b) return y < angolo ? 'alto-dx' : y > area.h - angolo ? 'basso-dx' : 'destra';
  if (y <= b) return 'massimo';
  return null;
}

// Zone complementari (Snap assist: dopo un aggancio si propone cosa mettere negli spazi liberi).
const COMPLEMENTI = {
  sinistra: ['destra'], destra: ['sinistra'], sopra: ['sotto'], sotto: ['sopra'],
  'alto-sx': ['alto-dx', 'basso-sx', 'basso-dx'], 'alto-dx': ['alto-sx', 'basso-sx', 'basso-dx'],
  'basso-sx': ['alto-sx', 'alto-dx', 'basso-dx'], 'basso-dx': ['alto-sx', 'alto-dx', 'basso-sx'],
  'due-terzi-sx': ['terzo-dx'], 'terzo-dx': ['due-terzi-sx'],
  'terzo-1': ['terzo-2', 'terzo-3'], 'terzo-2': ['terzo-1', 'terzo-3'], 'terzo-3': ['terzo-1', 'terzo-2'],
};
// Zone ancora libere dopo aver agganciato `zona` (tolte quelle già occupate da finestre visibili).
export function zoneLibere(zona, lista, scrivania) {
  const occupate = new Set(lista.filter((f) => f.stato !== 'ridotta' && f.aggancio && (f.scrivania ?? 1) === scrivania).map((f) => f.aggancio));
  return (COMPLEMENTI[zona] || []).filter((z) => !occupate.has(z));
}

// Schemi di affiancamento (Snap layouts) secondo lo schermo: ognuno è un elenco di zone.
export function schemi(area) {
  if (telefono(area) && area.h >= area.w) return [['sopra', 'sotto'], ['massimo']];
  return [['sinistra', 'destra'], ['due-terzi-sx', 'terzo-dx'], ['terzo-1', 'terzo-2', 'terzo-3'], ['alto-sx', 'alto-dx', 'basso-sx', 'basso-dx']];
}

// Aggancia una finestra a una zona ('massimo' = ingrandita). Ricorda il riquadro di prima per quando
// la si stacca trascinandola (come Windows: torna della sua misura sotto il dito).
export function aggancia(lista, chiave, zona, area) {
  return lista.map((f) => {
    if (f.chiave !== chiave) return f;
    const prima = f.aggancio || f.stato === 'ingrandita' ? f.libera || null : { x: f.x, y: f.y, w: f.w, h: f.h };
    if (zona === 'massimo') return { ...f, stato: 'ingrandita', aggancio: null, frazione: undefined, libera: prima || f.libera };
    const r = rettangoloZona(zona, area, f.frazione || 0.5);
    return r ? { ...f, ...r, stato: 'normale', aggancio: zona, libera: prima || f.libera } : f;
  });
}
// Stacca una finestra agganciata (o ingrandita) quando si comincia a trascinarla: riprende la misura
// di prima, centrata sotto il punto (px) dove la si tiene.
export function stacca(lista, chiave, punto, area) {
  return lista.map((f) => {
    if (f.chiave !== chiave || (!f.aggancio && f.stato !== 'ingrandita')) return f;
    const lib = f.libera || { w: Math.round(area.w * 0.6), h: Math.round(area.h * 0.7) };
    const r = limitaRiquadro({ x: punto.x - lib.w / 2, y: Math.max(0, punto.y - 18), w: lib.w, h: lib.h }, area);
    return { ...f, ...r, stato: 'normale', aggancio: null, frazione: undefined };
  });
}

// Divisore tra due finestre agganciate fianco a fianco (sinistra|destra) o una sopra l'altra.
export const COPPIE = [['sinistra', 'destra', 'x'], ['sopra', 'sotto', 'y']];
export function coppiaAgganciata(lista, scrivania) {
  const vis = lista.filter((f) => f.stato === 'normale' && f.aggancio && (f.scrivania ?? 1) === scrivania);
  for (const [a, b, asse] of COPPIE) {
    const fa = vis.find((f) => f.aggancio === a), fb = vis.find((f) => f.aggancio === b);
    if (fa && fb) return { a: fa, b: fb, asse, frazione: fa.frazione || 0.5 };
  }
  return null;
}
export function spostaDivisore(lista, coppia, frazione, area) {
  const fr = limita(frazione, 0.2, 0.8);
  const ra = rettangoloZona(coppia.a.aggancio, area, fr), rb = rettangoloZona(coppia.b.aggancio, area, fr);
  return lista.map((f) => (f.chiave === coppia.a.chiave ? { ...f, ...ra, frazione: fr } : f.chiave === coppia.b.chiave ? { ...f, ...rb, frazione: fr } : f));
}
// Dopo una rotazione le finestre agganciate seguono la loro zona.
export const riadattaAgganciate = (lista, area) => lista.map((f) => (f.aggancio ? { ...f, ...(rettangoloZona(f.aggancio, area, f.frazione || 0.5) || {}) } : f));

/* ---------- scrivanie virtuali ---------- */
export const SFONDI = ['bloom', 'aurora', 'tramonto', 'laguna', 'grafite'];
export const SCRIVANIE_INIZIALI = { elenco: [{ id: 1, nome: 'Desktop 1', sfondo: 'bloom' }], attiva: 1 };
export function nuovaScrivania(s) {
  const id = Math.max(0, ...s.elenco.map((d) => d.id)) + 1;
  return { elenco: [...s.elenco, { id, nome: `Desktop ${id}`, sfondo: SFONDI[(id - 1) % SFONDI.length] }], attiva: id };
}
export const rinominaScrivania = (s, id, nome) => ({ ...s, elenco: s.elenco.map((d) => (d.id === id ? { ...d, nome: String(nome).trim().slice(0, 30) || d.nome } : d)) });
export const vaiAScrivania = (s, id) => (s.elenco.some((d) => d.id === id) ? { ...s, attiva: id } : s);
// Chiudere una scrivania: le sue finestre passano alla scrivania a sinistra (o alla prima).
export function chiudiScrivania(s, lista, id) {
  if (s.elenco.length < 2) return { scrivanie: s, finestre: lista };
  const i = s.elenco.findIndex((d) => d.id === id); if (i < 0) return { scrivanie: s, finestre: lista };
  const verso = s.elenco[i > 0 ? i - 1 : 1].id;
  const elenco = s.elenco.filter((d) => d.id !== id);
  return { scrivanie: { elenco, attiva: s.attiva === id ? verso : s.attiva }, finestre: lista.map((f) => ((f.scrivania ?? 1) === id ? { ...f, scrivania: verso, aggancio: null } : f)) };
}
export const spostaInScrivania = (lista, chiave, id) => lista.map((f) => (f.chiave === chiave ? { ...f, scrivania: id, aggancio: null, stato: f.stato === 'ridotta' ? f.prima || 'normale' : f.stato } : f));
export const nellaScrivania = (lista, id) => lista.filter((f) => (f.scrivania ?? 1) === id);
