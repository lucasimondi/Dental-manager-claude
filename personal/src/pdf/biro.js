// FIRMA-BIRO (PO 2026-11-17): "la firma deve sembrare fatta a biro con il tratto giusto, le sfumature
// della pressione della biro ecc, colori delle bic nere e anche quelle blu".
// FIRMA-BIRO-2 (piano PO 2026-11-24, riferimento: artboard «PDF · Acquisizione firma» del mockup):
// - col dito la pressione si ricava dalla velocità (curva a coseno: lento = 1, ≥ 1,6 px/ms = 0,28);
//   con la penna resta quella reale (p^0,75);
// - niente "perline": ogni tratto è un poligono pieno a larghezza variabile (normali, contorni
//   levigati con quadratiche, cerchi agli estremi) disegnato su un livello opaco, composto a 0,95;
// - attacco (primi 5 punti dal 62%) e coda (ultimi 8 punti, fino al 20% se il gesto finale è veloce):
//   i tratti restano campioni {x, y, w, v} e si ridisegnano dal vettore;
// - effetto biro: inchiostro che salta al centro dei segmenti veloci e grana della carta (trama 96×96),
//   entrambi in 'destination-out', con generatore casuale a seme (test ripetibili);
// - stabilizzazione: ogni punto si sposta del 55% verso quello reale.
// Qui solo funzioni pure; il disegno su canvas è in Firma.jsx.

export const INCHIOSTRI = {
  nero: { nome: 'Biro nera', colore: '#1b1c22' },   // Bic Cristal nera: nero leggermente freddo
  blu: { nome: 'Biro blu', colore: '#1f3a93' },     // Bic Cristal blu
};
export const INCHIOSTRO_PREDEFINITO = 'blu';

// Punta in px CSS (sfera da 1 mm vista sul telefono) e costanti del modello.
export const PUNTA = 2.2;
export const STABILIZZA = 0.55;
export const V_VELOCE = 1.6;          // px/ms: da qui in su la pressione dal dito è al minimo
export const PRESSIONE_MINIMA = 0.28;
export const ATTACCO = { punti: 5, da: 0.62 };
export const CODA = { punti: 8, minimo: 0.2 };
export const OPACITA_LIVELLO = 0.95;
export const SALTO_MAX = 0.28;
export const GRANA = { lato: 96, opacita: 0.22 };

const limita = (x, a, b) => Math.max(a, Math.min(b, x));

// Pressione da velocità (dito/mouse): curva a coseno, 1 da fermi, PRESSIONE_MINIMA da V_VELOCE in su.
export function pressioneDaVelocita(v) {
  const k = limita((Number(v) || 0) / V_VELOCE, 0, 1);
  return 1 - (1 - PRESSIONE_MINIMA) * (1 - Math.cos(k * Math.PI)) / 2;
}

// Pressione utile: penna (Apple Pencil, S Pen) → reale p^0,75; dito/mouse → dalla velocità smorzata.
export function pressioneUtile(evento, velocita = 0) {
  const p = Number(evento?.pressure);
  if (evento?.pointerType === 'pen' && p > 0) return Math.pow(limita(p, 0.05, 1), 0.75);
  return pressioneDaVelocita(velocita);
}

// Larghezza voluta per una pressione 0..1: 38% della punta a vuoto, 120% premendo a fondo.
export const larghezzaDaPressione = (pressione, base = PUNTA) => base * (0.38 + 0.82 * limita(pressione, 0, 1));

// Velocità/larghezza smorzate (evita scatti fra un evento e l'altro).
export const smorza = (prima, adesso, quanto = 0.35) => (prima == null ? adesso : prima + (adesso - prima) * quanto);

// Generatore pseudo-casuale con seme: grana ripetibile (e verificabile nei test).
export function casuale(seme = 1) {
  let t = seme >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// Nuovo tratto dal primo campione p = {x, y, t, pressione?} (pressione solo con la penna, altrimenti null).
export function nuovoTratto(p, base = PUNTA) {
  const w = base * 0.9;
  return { punti: [{ x: p.x, y: p.y, w, v: 0 }], grezzo: p, v: 0, w, base, finito: false, vFine: 0 };
}

// Aggiunge un campione al tratto (muta e restituisce il tratto). Stabilizzazione al 55%, velocità
// smorzata, pressione (penna reale o dalla velocità), larghezza smorzata. Scarta i micro-spostamenti.
export function aggiungiPunto(s, p) {
  const ultimo = s.punti[s.punti.length - 1];
  const x = ultimo.x + (p.x - ultimo.x) * STABILIZZA;
  const y = ultimo.y + (p.y - ultimo.y) * STABILIZZA;
  if (Math.hypot(x - ultimo.x, y - ultimo.y) < 0.4) return s;
  const d = Math.hypot(p.x - s.grezzo.x, p.y - s.grezzo.y);
  const dt = Math.max(4, (p.t ?? 0) - (s.grezzo.t ?? 0));
  s.v = s.v * 0.65 + (d / dt) * 0.35;
  s.grezzo = p;
  const pressione = p.pressione != null ? Math.pow(limita(p.pressione, 0.05, 1), 0.75) : pressioneDaVelocita(s.v);
  s.w = s.w * 0.62 + larghezzaDaPressione(pressione, s.base) * 0.38;
  s.punti.push({ x, y, w: s.w, v: s.v });
  return s;
}

// Chiude il tratto: la coda si assottiglia secondo la velocità dell'ultimo gesto.
export function chiudiTratto(s) { s.finito = true; s.vFine = s.v; return s; }

// Larghezze finali con attacco (primi 5 punti dal 62%) e coda (ultimi 8, fino al 20% se veloce).
export function larghezze(s) {
  const n = s.punti.length;
  const ws = s.punti.map((p) => p.w);
  const nA = Math.min(ATTACCO.punti, n);
  for (let i = 0; i < nA; i++) ws[i] *= ATTACCO.da + (1 - ATTACCO.da) * Math.sin(((i + 1) / (nA + 1)) * Math.PI / 2);
  if (s.finito && n > 3) {
    const nC = Math.min(CODA.punti, n - 1);
    const veloce = limita(s.vFine / 1.2, 0, 1);
    const fondo = 0.75 - (0.75 - CODA.minimo) * veloce;
    for (let j = 0; j < nC; j++) ws[n - 1 - j] *= fondo + (1 - fondo) * Math.sin((j / nC) * Math.PI / 2);
  }
  return ws;
}

// Contorno del poligono: bordi sinistro/destro lungo le normali, a metà larghezza dal centro.
export function contorno(punti, ws) {
  const n = punti.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = punti[Math.max(0, i - 1)], b = punti[Math.min(n - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    const h = ws[i] / 2;
    L.push({ x: punti[i].x + nx * h, y: punti[i].y + ny * h });
    R.push({ x: punti[i].x - nx * h, y: punti[i].y - ny * h });
  }
  return { L, R };
}

// Inchiostro che salta: sui segmenti veloci una linea sottile al centro, tolta fino a SALTO_MAX.
export function salti(punti) {
  const fuori = [];
  for (let i = 1; i < punti.length; i++) {
    const k = limita(punti[i].v / 1.8, 0, 1);
    if (k < 0.35) continue;
    fuori.push({ x0: punti[i - 1].x, y0: punti[i - 1].y, x1: punti[i].x, y1: punti[i].y, larghezza: punti[i].w * 0.32, a: SALTO_MAX * k });
  }
  return fuori;
}

// Trama della carta lato×lato: alfa per pixel (7% punti marcati, 28% leggeri, il resto vuoto).
export function trama(rnd = casuale(17), lato = GRANA.lato) {
  const alfa = new Uint8ClampedArray(lato * lato);
  for (let i = 0; i < alfa.length; i++) {
    const r = rnd();
    alfa[i] = r < 0.07 ? 200 + rnd() * 55 : (r < 0.35 ? 40 * rnd() : 0);
  }
  return alfa;
}

// Riquadro dell'inchiostro (px CSS) di tutti i tratti, mezza larghezza compresa; null se vuoto.
export function riquadro(tratti) {
  let b = null;
  for (const s of tratti) for (const p of s.punti) {
    const m = p.w;
    b = b ? { x0: Math.min(b.x0, p.x - m), y0: Math.min(b.y0, p.y - m), x1: Math.max(b.x1, p.x + m), y1: Math.max(b.y1, p.y + m) }
      : { x0: p.x - m, y0: p.y - m, x1: p.x + m, y1: p.y + m };
  }
  return b;
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
