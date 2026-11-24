// PDF-TESTO (PO 2026-11-24: «il testo quando lo crei poi lo sposti difficilmente e non si può scegliere
// tra alcuni caratteri colori grandezza»). Il testo non usa più l'editor di PDF.js: è un elemento come la
// firma (si trascina con un dito, ↘ cambia la grandezza, un tocco lo modifica) e nel PDF finisce come
// TESTO VERO (pdf-lib drawText con i 14 caratteri standard): resta cercabile e copiabile.
// Funzioni pure: misure, posizione delle righe, colore, caratteri ammessi.

export const CARATTERI = {
  moderno: { nome: 'Moderno', css: 'Helvetica, Arial, "Liberation Sans", sans-serif', pdf: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'], base: 0.947 },
  classico: { nome: 'Classico', css: '"Times New Roman", Times, "Liberation Serif", serif', pdf: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'], base: 0.938 },
  macchina: { nome: 'Macchina da scrivere', css: '"Courier New", Courier, "Liberation Mono", monospace', pdf: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'], base: 0.866 },
};
export const COLORI_TESTO = { nero: '#111418', blu: '#1f3a93', rosso: '#b3261e', verde: '#1e6b3a', grigio: '#5f6368' };
export const GRANDEZZE = { min: 6, max: 72 };
export const INTERLINEA = 1.2;
// base = linea di base della prima riga dall'alto, in frazioni della grandezza, con interlinea 1,2
// (mezza interlinea + ascendente del carattere a schermo): così PDF e schermo coincidono.
export const STILE_PREDEFINITO = { carattere: 'moderno', colore: 'nero', grandezza: 14, grassetto: false, corsivo: false };

const limita = (x, a, b) => Math.max(a, Math.min(b, x));

export function normalizzaStile(s = {}) {
  return {
    carattere: CARATTERI[s.carattere] ? s.carattere : STILE_PREDEFINITO.carattere,
    colore: COLORI_TESTO[s.colore] ? s.colore : STILE_PREDEFINITO.colore,
    grandezza: limita(Math.round((Number(s.grandezza) || STILE_PREDEFINITO.grandezza) * 2) / 2, GRANDEZZE.min, GRANDEZZE.max),
    grassetto: Boolean(s.grassetto), corsivo: Boolean(s.corsivo),
  };
}

// Nome del carattere standard di pdf-lib (chiave di StandardFonts).
export const caratterePdf = (stile) => CARATTERI[stile.carattere].pdf[(stile.grassetto ? 1 : 0) + (stile.corsivo ? 2 : 0)];
// Font CSS per lo schermo e per misurare (stessa famiglia metrica: Arial = Helvetica, ecc.).
export const fontCss = (stile, px) => `${stile.corsivo ? 'italic ' : ''}${stile.grassetto ? '700' : '400'} ${px}px ${CARATTERI[stile.carattere].css}`;

export const righe = (testo) => String(testo ?? '').replace(/\r\n?/g, '\n').split('\n').map((r) => r.replace(/\s+$/, ''));

// Riquadro dell'elemento in frazioni della pagina. misura(riga, stile) = larghezza in pt a grandezza 1.
// pagina = { w, h } in pt (come la vede lo schermo, rotazione compresa).
export function riquadroTesto(testo, stile, pagina, misura) {
  const r = righe(testo);
  const largo = Math.max(...r.map((x) => misura(x || ' ', stile))) * stile.grandezza;
  const alto = r.length * stile.grandezza * INTERLINEA;
  return { width: Math.min(1, (largo + stile.grandezza * 0.2) / pagina.w), height: Math.min(1, alto / pagina.h) };
}

// Solo dentro la pagina (il testo non ha le misure minime della firma).
export function limitaPosizione(r) {
  return { ...r, x: limita(r.x, 0, Math.max(0, 1 - r.width)), y: limita(r.y, 0, Math.max(0, 1 - r.height)) };
}

// Grandezza dopo il trascinamento di ↘: proporzionale alla nuova larghezza.
export function grandezzaDaLarghezza(stile, larghezza, nuova) {
  return normalizzaStile({ ...stile, grandezza: stile.grandezza * (nuova / Math.max(1e-6, larghezza)) }).grandezza;
}

export function coloreRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// Punti di partenza delle righe nel PDF. position = { x, y, width, height, rotation } come da
// posizioneFirma (origine in basso a sinistra del riquadro, ruotato). La grandezza vera si ricava
// dall'altezza del riquadro, così il PDF coincide con lo schermo anche dopo lo zoom.
export function posizioniRighe(position, n, base = 0.947) {
  const size = position.height / (n * INTERLINEA);
  const t = (position.rotation || 0) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return Array.from({ length: n }, (_, i) => {
    const su = position.height - size * (base + i * INTERLINEA);     // linea di base della riga i
    return { x: position.x - su * s + size * 0.1 * c, y: position.y + su * c + size * 0.1 * s, size };
  });
}

// I caratteri standard (WinAnsi) non hanno emoji e simboli rari: al loro posto «?».
export function testoScrivibile(testo, codifica) {
  let fuori = '';
  for (const ch of testo) { try { codifica(ch); fuori += ch; } catch { fuori += '?'; } }
  return fuori;
}
