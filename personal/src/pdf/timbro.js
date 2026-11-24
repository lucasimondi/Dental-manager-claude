// PDF-TIMBRO (PO 2026-11-24: «l'opzione timbro che si può configurare ed esce come un vero timbro con
// l'inchiostro, quindi le caratteristiche dell'inchiostro del timbro»).
// Il timbro di gomma lascia un'impronta irregolare: inchiostro più carico da un lato (la mano non preme
// in piano), chiazze scariche (il tampone non bagna uniforme), puntini senza inchiostro (grana della
// carta), bordo un po' sbavato, una leggera inclinazione. Qui le funzioni pure (configurazione, rumore
// con seme, copertura); il disegno su canvas è in Timbro.jsx.
import { casuale } from './biro.js';

export const INCHIOSTRI_TIMBRO = {
  rosso: { nome: 'Rosso', colore: '#c3242d' },
  blu: { nome: 'Blu', colore: '#24408f' },
  viola: { nome: 'Viola', colore: '#5a3a90' },
  nero: { nome: 'Nero', colore: '#222327' },
  verde: { nome: 'Verde', colore: '#1f6b3b' },
};
export const FORME_TIMBRO = { rettangolo: 'Rettangolare', tondo: 'Tondo', ovale: 'Ovale' };
export const CARICHI = { leggero: { nome: 'Poco inchiostro', base: 0.62 }, normale: { nome: 'Normale', base: 0.8 }, carico: { nome: 'Molto inchiostro', base: 0.95 } };
export const MAX_RIGHE = 4;
export const TIMBRO_PREDEFINITO = { righe: ['COPIA CONFORME', "ALL'ORIGINALE", '', ''], forma: 'rettangolo', inchiostro: 'blu', bordoDoppio: true, data: true, carico: 'normale' };

const limita = (x, a, b) => Math.max(a, Math.min(b, x));

export function normalizzaTimbro(t = {}) {
  const righe = Array.from({ length: MAX_RIGHE }, (_, i) => String(t.righe?.[i] ?? '').slice(0, 40));
  return {
    righe,
    forma: FORME_TIMBRO[t.forma] ? t.forma : TIMBRO_PREDEFINITO.forma,
    inchiostro: INCHIOSTRI_TIMBRO[t.inchiostro] ? t.inchiostro : TIMBRO_PREDEFINITO.inchiostro,
    bordoDoppio: t.bordoDoppio == null ? TIMBRO_PREDEFINITO.bordoDoppio : Boolean(t.bordoDoppio),
    data: t.data == null ? TIMBRO_PREDEFINITO.data : Boolean(t.data),
    carico: CARICHI[t.carico] ? t.carico : TIMBRO_PREDEFINITO.carico,
  };
}
export const righeUsate = (t) => t.righe.map((r) => r.trim()).filter(Boolean);
export const timbroVuoto = (t) => !righeUsate(t).length && !t.data;

// Misure del timbro in unità (1 = altezza di una riga di testo normale): larghezza e altezza.
// rettangolo/ovale: righe centrate; tondo: prima riga sull'arco in alto, seconda sull'arco in basso,
// il resto (e la data) al centro.
export function misureTimbro(t, larghezzaTesto) {
  const r = righeUsate(t), centro = t.forma === 'tondo' ? r.slice(2) : r;
  const n = centro.length + (t.data ? 1 : 0);
  if (t.forma === 'tondo') {
    const interno = Math.max(2.2, ...centro.map((x) => larghezzaTesto(x)), t.data ? larghezzaTesto('00/00/0000') : 0);
    const d = Math.max(7, interno + 3.2, n * 1.25 + 4.4);
    return { w: d, h: d };
  }
  const largo = Math.max(4, ...r.map((x, i) => larghezzaTesto(x) * (i === 0 ? 1.12 : 1)), t.data ? larghezzaTesto('00/00/0000') : 0);
  const ovale = t.forma === 'ovale';
  return { w: largo * (ovale ? 1.32 : 1) + (ovale ? 2.4 : 1.6), h: Math.max(1, n) * 1.3 * (ovale ? 1.25 : 1) + (ovale ? 1.6 : 1.1) };
}

// Rumore a valori con seme, interpolato morbido: f(x, y) in 0..1 con "chiazze" di lato ~1/scala.
export function rumore(seme, scala = 6) {
  const rnd = casuale(seme), n = 64, g = Float32Array.from({ length: n * n }, () => rnd());
  const v = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
  const liscio = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const X = x * scala, Y = y * scala, i = Math.floor(X), j = Math.floor(Y), fx = liscio(X - i), fy = liscio(Y - j);
    const a = v(i, j) + (v(i + 1, j) - v(i, j)) * fx, b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

// Impronta: per ogni punto (x, y normalizzati 0..1 sul timbro) quanto inchiostro resta (0..1).
// Pressione non in piano (gradiente in una direzione a caso), chiazze grandi e piccole, puntini vuoti.
export function impronta(seme, carico = 'normale') {
  const rnd = casuale(seme), grandi = rumore(seme + 11, 3), piccole = rumore(seme + 23, 14), grana = rumore(seme + 37, 90);
  const angolo = rnd() * Math.PI * 2, c = Math.cos(angolo), s = Math.sin(angolo), base = CARICHI[carico]?.base ?? 0.8;
  const forza = 0.18 + rnd() * 0.22;
  return (x, y) => {
    const lato = ((x - 0.5) * c + (y - 0.5) * s) + 0.5;                 // 0..1 lungo la direzione
    let k = base * (1 - forza * limita(lato, 0, 1)) + (grandi(x, y) - 0.5) * 0.45 + (piccole(x, y) - 0.5) * 0.25;
    if (grana(x, y) > 0.8) k *= 0.15;                                      // puntini senza inchiostro
    return limita(k, 0, 1);
  };
}

// Inclinazione naturale: tra −4° e +4°, mai esattamente dritto.
export function inclinazione(seme) { const r = casuale(seme * 3 + 5)(); return (r < 0.5 ? -1 : 1) * (0.8 + r * 3.2) * Math.PI / 180; }

export function dataOggi(d = new Date()) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
