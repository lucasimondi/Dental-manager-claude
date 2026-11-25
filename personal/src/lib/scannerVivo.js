// SCAN-VIVO (PO 2026-11-24: «non è lo Scan, ma scatta foto, bisogna avere lo Scan forte come quello di
// Google»). Fotocamera dal vivo dentro l'app: a ogni fotogramma si cercano i bordi del foglio
// (trovaAngoli), il contorno si disegna sull'inquadratura e, quando il foglio resta fermo, si scatta da
// soli. Qui solo la logica pura (smussatura, stabilità, avanzamento dello scatto), testabile in Node.
const ORDINE = ['tl', 'tr', 'br', 'bl'];

export const SCATTO = { fermoMs: 900, tolleranza: 0.018, persoMs: 700, smussa: 0.6, attesaDopo: 1600 };

// Distanza massima fra angoli corrispondenti (frazioni dell'inquadratura).
export function distanzaAngoli(a, b) {
  if (!a || !b) return Infinity;
  return Math.max(...ORDINE.map((k) => Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y)));
}

// Contorno morbido sullo schermo: ogni fotogramma si avvicina del 60% al nuovo (SCAN-BORDI: bordi
// più precisi, quindi meno ritardo) (niente tremolio).
// Se il salto è grande (foglio diverso) si riparte dal nuovo.
export function smussaAngoli(prima, nuovi, k = SCATTO.smussa) {
  if (!nuovi) return null;
  if (!prima || distanzaAngoli(prima, nuovi) > 0.12) return nuovi;
  return Object.fromEntries(ORDINE.map((c) => [c, { x: prima[c].x + (nuovi[c].x - prima[c].x) * k, y: prima[c].y + (nuovi[c].y - prima[c].y) * k }]));
}

// Area del quadrilatero (frazione dell'inquadratura): un foglio troppo piccolo non si scatta da solo.
export function areaAngoli(q) {
  const p = ORDINE.map((k) => q[k]);
  let s = 0; for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}

// Stato dello scatto automatico. st = { riferimento, da, ultimoVisto, ultimoScatto } (immutabile).
// Restituisce { st, fase: 'cerca' | 'avvicina' | 'fermo' | 'scatta', avanzamento 0..1 }.
export function passoScatto(st, angoli, ora, { auto = true } = {}) {
  const s = { riferimento: null, da: 0, ultimoVisto: -Infinity, ultimoScatto: -Infinity, ...st };
  if (!angoli) {
    if (ora - s.ultimoVisto > SCATTO.persoMs) return { st: { ...s, riferimento: null }, fase: 'cerca', avanzamento: 0 };
    return { st: s, fase: s.riferimento ? 'fermo' : 'cerca', avanzamento: 0 };
  }
  if (areaAngoli(angoli) < 0.12) return { st: { ...s, riferimento: null, ultimoVisto: ora }, fase: 'avvicina', avanzamento: 0 };
  let { riferimento, da } = s;
  if (!riferimento || distanzaAngoli(riferimento, angoli) > SCATTO.tolleranza) { riferimento = angoli; da = ora; }
  const avanzamento = Math.min(1, (ora - da) / SCATTO.fermoMs);
  const nuovo = { ...s, riferimento, da, ultimoVisto: ora };
  if (auto && avanzamento >= 1 && ora - s.ultimoScatto > SCATTO.attesaDopo) return { st: { ...nuovo, riferimento: null, ultimoScatto: ora }, fase: 'scatta', avanzamento: 1 };
  return { st: nuovo, fase: 'fermo', avanzamento: ora - s.ultimoScatto > SCATTO.attesaDopo ? avanzamento : 0 };
}

export const MESSAGGI_FASE = {
  cerca: 'Inquadra tutto il foglio',
  avvicina: 'Avvicinati al foglio',
  fermo: 'Tieni fermo il telefono…',
  scatta: 'Scattata!',
  manuale: 'Premi il pulsante per scattare',
};
