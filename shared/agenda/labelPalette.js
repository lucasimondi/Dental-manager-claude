// PO 2026-11-04 (restyling agenda Studio e Personal): 15 colori etichetta con luminosità
// e saturazione bilanciate. I colori salvati non cambiano: vengono solo MOSTRATI col
// colore della palette più vicino (reversibile, nessuna scrittura a database).
export const LABEL_PALETTE = Object.freeze([
  { id: 'corallo', nome: 'Corallo', hex: '#D1453B' },
  { id: 'rubino', nome: 'Rubino', hex: '#A8323E' },
  { id: 'rosa', nome: 'Rosa', hex: '#C23D78' },
  { id: 'prugna', nome: 'Prugna', hex: '#9B3D96' },
  { id: 'lavanda', nome: 'Lavanda', hex: '#8460CC' },
  { id: 'indaco', nome: 'Indaco', hex: '#4E52C4' },
  { id: 'oceano', nome: 'Oceano', hex: '#2D6BC4' },
  { id: 'petrolio', nome: 'Petrolio', hex: '#1F5F7A' },
  { id: 'laguna', nome: 'Laguna', hex: '#13808F' },
  { id: 'salvia', nome: 'Salvia', hex: '#34845A' },
  { id: 'bosco', nome: 'Bosco', hex: '#22714A' },
  { id: 'oliva', nome: 'Oliva', hex: '#5E7F1F' },
  { id: 'senape', nome: 'Senape', hex: '#E0A526' },
  { id: 'albicocca', nome: 'Albicocca', hex: '#E3772A' },
  { id: 'ardesia', nome: 'Ardesia', hex: '#5D6979' },
]);
export const LABEL_HEXES = Object.freeze(LABEL_PALETTE.map(p => p.hex));
const BY_ID = Object.fromEntries(LABEL_PALETTE.map(p => [p.id, p.hex]));

// Colori storici noti (Studio COLORI_DISPONIBILI, tipi impegno, etichette Personal):
// assegnazione esplicita così due scelte diverse restano diverse.
const LEGACY = {
  '#1a6b8a': 'petrolio', '#2ec4b6': 'laguna', '#2d9e61': 'salvia', '#7c3aed': 'lavanda',
  '#e63946': 'corallo', '#f4a261': 'albicocca', '#ec4899': 'rosa', '#dc2626': 'rubino',
  '#0ea5e9': 'oceano', '#84cc16': 'oliva', '#f59e0b': 'senape', '#6366f1': 'indaco',
  '#14b8a6': 'laguna', '#a855f7': 'prugna', '#64748b': 'ardesia', '#6b7280': 'ardesia',
  '#8b5cf6': 'lavanda', '#db2777': 'rosa', '#059669': 'bosco', '#0284c7': 'oceano',
  '#b45309': 'albicocca', '#b54708': 'albicocca', '#185fa5': 'oceano', '#0c447c': 'oceano',
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgb = h => {
  const s = h.length === 4 ? h.slice(1).split('').map(c => c + c).join('') : h.slice(1);
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
};
const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function oklch(h) {
  const [r, g, b] = rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
const PAL_LCH = LABEL_PALETTE.map(p => [p.hex, oklch(p.hex)]);
const cache = new Map();

/** Colore da mostrare per un colore etichetta salvato (mai scritto a database). */
export function labelColor(co, fallback = '#5D6979') {
  if (typeof co !== 'string' || !HEX.test(co.trim())) return fallback;
  const key = co.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let out = LEGACY[key] ? BY_ID[LEGACY[key]] : LABEL_HEXES.find(h => h.toLowerCase() === key);
  if (!out) {
    const [L, C, H] = oklch(key);
    let best = Infinity;
    for (const [hex, [L2, C2, H2]] of PAL_LCH) {
      const grey = C < 0.045, grey2 = C2 < 0.045;
      const d = grey || grey2
        ? (grey && grey2 ? Math.abs(L - L2) : 9)
        : Math.min(Math.abs(H - H2), 360 - Math.abs(H - H2)) / 30 + Math.abs(L - L2) * 4;
      if (d < best) { best = d; out = hex; }
    }
  }
  cache.set(key, out);
  return out;
}

const lum = h => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Testo leggibile sul colore pieno: bianco se il contrasto è almeno 4.5:1, altrimenti scuro. */
export function labelOn(hex) {
  return (1.05 / (lum(hex) + 0.05)) >= 4.5 ? '#FFFFFF' : '#1B1B1F';
}
