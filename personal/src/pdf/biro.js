// FIRMA-BIRO (PO 2026-11-17): "la firma deve sembrare fatta a biro con il tratto giusto, le sfumature
// della pressione della biro ecc, colori delle bic nere e anche quelle blu".
// Modello della penna a sfera: la punta lascia più inchiostro dove si va piano o si preme (tratto più
// largo e più scuro) e meno dove si corre (tratto più sottile e più chiaro, con piccoli vuoti); a ogni
// appoggio una minima goccia. Il tratto è fatto di "tocchi" ravvicinati con opacità variabile, così
// le sovrapposizioni scuriscono come l'inchiostro vero. Funzioni pure qui, disegno su canvas in Firma.jsx.

export const INCHIOSTRI = {
  nero: { nome: 'Biro nera', colore: '#1b1c22' },   // Bic Cristal nera: nero leggermente freddo
  blu: { nome: 'Biro blu', colore: '#1f3a93' },     // Bic Cristal blu
};
export const INCHIOSTRO_PREDEFINITO = 'blu';

const limita = (x, a, b) => Math.max(a, Math.min(b, x));

// Pressione utile: penna (Apple Pencil, S Pen) → valore reale; dito/mouse → 0.5 fisso (né forte né leggero).
export function pressioneUtile(evento) {
  const p = Number(evento?.pressure);
  if (evento?.pointerType === 'pen' && p > 0) return limita(p, 0.05, 1);
  return 0.5;
}

// Larghezza della punta in px CSS: base 1.7 px (sfera da 1 mm vista sul telefono).
// velocità in px/ms: piano (≈0) → 1.3×, veloce (≥2.5) → 0.55×; pressione 0→1 → 0.7×…1.35×.
export function larghezzaTratto(velocita, pressione = 0.5, base = 1.7) {
  const v = limita(Number(velocita) || 0, 0, 3);
  const daVelocita = limita(1.3 - v * 0.3, 0.55, 1.3);
  const daPressione = 0.7 + limita(pressione, 0, 1) * 0.65;
  return base * daVelocita * daPressione;
}

// Opacità del tocco: più inchiostro quando si va piano; mai sotto 0.35 (la biro non sparisce).
export function opacitaTratto(velocita, pressione = 0.5) {
  const v = limita(Number(velocita) || 0, 0, 3);
  return limita(0.95 - v * 0.17 + (pressione - 0.5) * 0.2, 0.35, 0.97);
}

// Velocità smorzata (evita scatti fra un evento e l'altro).
export const smorza = (prima, adesso, quanto = 0.35) => (prima == null ? adesso : prima + (adesso - prima) * quanto);

// Generatore pseudo-casuale con seme: grana dell'inchiostro ripetibile (e verificabile nei test).
export function casuale(seme = 1) {
  let t = seme >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// Tocchi lungo un tratto da (x0,y0,w0) a (x1,y1,w1): uno ogni ~0.3 della larghezza, con la grana.
// Ogni punto è coperto da ~3 tocchi: l'opacità del singolo tocco è quella che, sovrapposta, dà
// l'intensità voluta, così le differenze della grana restano visibili invece di saturare.
// rnd: funzione 0..1. Restituisce [{x, y, r, a}] (a = opacità del singolo tocco).
export function tocchi({ x0, y0, w0, x1, y1, w1, a0, a1 }, rnd = Math.random) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const passo = Math.max(0.25, Math.min(w0, w1) * 0.3);
  const n = Math.max(1, Math.ceil(d / passo));
  const fuori = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const w = w0 + (w1 - w0) * t;
    const grana = 0.7 + rnd() * 0.3;               // l'inchiostro non si deposita uguale
    const salta = rnd() < (1 - Math.min(a0, a1)) * 0.25; // a velocità alta qualche microvuoto
    const voluta = Math.min(0.98, (a0 + (a1 - a0) * t) * grana);
    const quota = Math.min(1, passo / Math.max(0.01, w));
    fuori.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, r: w / 2, a: salta ? 0 : 1 - Math.pow(1 - voluta, quota) });
  }
  return fuori;
}

// Grana della sfera: puntini minuscoli che tolgono un po' d'inchiostro (applicati a fine tratto, solo
// dove c'è inchiostro). rect = riquadro del tratto in px CSS. Densità ~0.12 per px², al massimo 5000.
export function granelli({ x0, y0, x1, y1 }, rnd = Math.random) {
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
  const n = Math.min(5000, Math.round(w * h * 0.12));
  return Array.from({ length: n }, () => ({ x: x0 + rnd() * w, y: y0 + rnd() * h, r: 0.18 + rnd() * 0.3, a: 0.12 + rnd() * 0.3 }));
}

// Ricolora un PNG della firma (nero ↔ blu) mantenendo sfumature e grana (l'alfa resta com'è).
export async function ricolora(png, colore) {
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Firma non leggibile.')); i.src = png; });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colore;
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
