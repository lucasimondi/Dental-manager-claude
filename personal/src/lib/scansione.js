// POL-VITA-006 — scansione di documenti dal telefono: foto delle pagine, miglioramento per la
// lettura (bianco e nero o colori più netti), rotazione, poi un solo PDF A4 da archiviare.
// Le funzioni sui pixel sono pure (lavorano su un array RGBA) e quindi testabili.
import { trovaAngoli, angoliValidi, angoliInteri, misureRaddrizzate, raddrizza } from './prospettiva.js';

const LATO_MAX = 2000;
// SCAN-PDF-MANAGER (PO 2026-11-11: «Comprimi PDF»): «Leggero» riduce lato e qualità JPEG,
// per allegati piccoli da mandare con Mail o WhatsApp.
export const PESI = { normale: { lato: LATO_MAX, qualita: 0.85 }, leggero: { lato: 1400, qualita: 0.6 } };

// Ritaglio normalizzato: dentro l'immagine e mai più piccolo del 5% per lato.
export const RITAGLIO_INTERO = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.05;
const tra = (v, a, b) => Math.max(a, Math.min(b, v));
export function limitaRitaglio({ x, y, w, h }) {
  const lw = tra(w, MIN, 1); const lh = tra(h, MIN, 1);
  return { x: tra(x, 0, 1 - lw), y: tra(y, 0, 1 - lh), w: lw, h: lh };
}
// Sposta un angolo ('nw', 'ne', 'sw', 'se') o tutto il riquadro ('centro') di dx, dy (frazioni).
export function muoviRitaglio(r, maniglia, dx, dy) {
  if (maniglia === 'centro') return limitaRitaglio({ ...r, x: r.x + dx, y: r.y + dy });
  let x1 = r.x; let y1 = r.y; let x2 = r.x + r.w; let y2 = r.y + r.h;
  if (maniglia.includes('w')) x1 = tra(x1 + dx, 0, x2 - MIN); else x2 = tra(x2 + dx, x1 + MIN, 1);
  if (maniglia.includes('n')) y1 = tra(y1 + dy, 0, y2 - MIN); else y2 = tra(y2 + dy, y1 + MIN, 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function rettangoloPixel(r, larghezza, altezza) {
  const { x, y, w, h } = limitaRitaglio(r);
  const px = Math.round(x * larghezza); const py = Math.round(y * altezza);
  return { x: px, y: py, w: Math.max(1, Math.min(larghezza - px, Math.round(w * larghezza))), h: Math.max(1, Math.min(altezza - py, Math.round(h * altezza))) };
}

const luce = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Livelli: il 2% più scuro diventa nero, il 2% più chiaro bianco (carta grigia → bianca).
export function livelli(px, quota = 0.02) {
  const isto = new Uint32Array(256);
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) isto[Math.round(luce(px[i], px[i + 1], px[i + 2]))] += 1;
  let basso = 0; let alto = 255; let somma = 0;
  for (; basso < 255; basso += 1) { somma += isto[basso]; if (somma > n * quota) break; }
  somma = 0;
  for (; alto > 0; alto -= 1) { somma += isto[alto]; if (somma > n * quota) break; }
  if (alto - basso < 30) { basso = 0; alto = 255; }
  return { basso, alto };
}

// SCAN-VIVO (PO 2026-11-24: scan «forte come quello di Google»): via le ombre e la luce non uniforme.
// Lo sfondo (la carta) si stima a celle con un valore alto per canale (85° percentile di un campione),
// si leviga e si ingrandisce in modo continuo; ogni pixel viene diviso per lo sfondo, così la carta
// diventa bianca in tutta la pagina e l'ombra della mano o del telefono sparisce, il testo resta.
export function sfondoCarta(px, larghezza, altezza, celle = 40) {
  const lato = Math.max(4, Math.ceil(Math.max(larghezza, altezza) / celle));
  const cw = Math.ceil(larghezza / lato), ch = Math.ceil(altezza / lato);
  const bg = new Float32Array(cw * ch * 3);
  const passo = Math.max(1, Math.floor(lato / 8));
  const valori = [[], [], []];
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    valori[0].length = valori[1].length = valori[2].length = 0;
    for (let y = cy * lato; y < Math.min(altezza, (cy + 1) * lato); y += passo) for (let x = cx * lato; x < Math.min(larghezza, (cx + 1) * lato); x += passo) {
      const i = (y * larghezza + x) * 4; valori[0].push(px[i]); valori[1].push(px[i + 1]); valori[2].push(px[i + 2]);
    }
    for (let c = 0; c < 3; c++) { const v = valori[c].sort((a, b) => a - b); bg[(cy * cw + cx) * 3 + c] = v[Math.min(v.length - 1, Math.floor(v.length * 0.85))] || 255; }
  }
  // levigatura: due passate 3×3
  for (let k = 0; k < 2; k++) {
    const copia = bg.slice();
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) for (let c = 0; c < 3; c++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < cw && y < ch) { s += copia[(y * cw + x) * 3 + c]; n++; } }
      bg[(cy * cw + cx) * 3 + c] = s / n;
    }
  }
  return { bg, cw, ch, lato };
}

export function togliOmbre(px, larghezza, altezza) {
  if (!larghezza || !altezza) return px;
  const { bg, cw, ch, lato } = sfondoCarta(px, larghezza, altezza);
  for (let y = 0; y < altezza; y++) {
    const fy = Math.min(ch - 1, Math.max(0, (y + 0.5) / lato - 0.5)), y0 = Math.floor(fy), y1 = Math.min(ch - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < larghezza; x++) {
      const fx = Math.min(cw - 1, Math.max(0, (x + 0.5) / lato - 0.5)), x0 = Math.floor(fx), x1 = Math.min(cw - 1, x0 + 1), tx = fx - x0;
      const i = (y * larghezza + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = bg[(y0 * cw + x0) * 3 + c] * (1 - tx) + bg[(y0 * cw + x1) * 3 + c] * tx;
        const b = bg[(y1 * cw + x0) * 3 + c] * (1 - tx) + bg[(y1 * cw + x1) * 3 + c] * tx;
        const sfondo = Math.max(24, a * (1 - ty) + b * ty);
        px[i + c] = Math.min(255, (px[i + c] * 255) / sfondo);
      }
    }
  }
  return px;
}

export function migliora(px, modo, larghezza = 0, altezza = 0) {
  if (modo === 'originale') return px;
  togliOmbre(px, larghezza, altezza);
  const { basso, alto } = livelli(px);
  const k = 255 / (alto - basso);
  const tira = (v) => Math.max(0, Math.min(255, (v - basso) * k));
  for (let i = 0; i < px.length; i += 4) {
    if (modo === 'documento') {
      // grigio, livelli e curva che schiarisce lo sfondo e scurisce il testo
      let v = tira(luce(px[i], px[i + 1], px[i + 2])) / 255;
      v = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v);
      px[i] = px[i + 1] = px[i + 2] = Math.round(v * 255);
    } else {
      px[i] = tira(px[i]); px[i + 1] = tira(px[i + 1]); px[i + 2] = tira(px[i + 2]);
    }
  }
  return px;
}

// Foto → canvas ridotto, ruotato e migliorato → JPEG.
// MIA-SALUTE: `ritaglio` ({x, y, w, h} da 0 a 1, sull'immagine già ruotata) taglia i bordi.
// SCAN-PDF-MANAGER: `angoli` ('auto' oppure { tl, tr, br, bl } da 0 a 1) raddrizza il foglio;
// con 'auto' gli angoli si cercano nella foto e vengono restituiti (null se non trovati).
export async function elaboraPagina(file, { modo = 'documento', rotazione = 0, ritaglio = null, angoli = null, peso = 'normale' } = {}) {
  const { lato, qualita } = PESI[peso] || PESI.normale;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scala);
  const h = Math.round(bitmap.height * scala);
  const giro = ((rotazione % 360) + 360) % 360;
  const canvas = document.createElement('canvas');
  canvas.width = giro % 180 ? h : w;
  canvas.height = giro % 180 ? w : h;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.translate(canvas.width / 2, canvas.height / 2);
  c.rotate((giro * Math.PI) / 180);
  c.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  c.setTransform(1, 0, 0, 1, 0, 0);
  let tela = canvas;
  let angoliUsati = null;
  if (angoli) {
    const dati = c.getImageData(0, 0, canvas.width, canvas.height);
    const q = angoli === 'auto' ? trovaAngoli(dati.data, canvas.width, canvas.height) : angoli;
    if (q && angoliValidi(q) && !angoliInteri(q)) {
      const { w: ow, h: oh } = misureRaddrizzate(q, canvas.width, canvas.height, lato);
      tela = document.createElement('canvas');
      tela.width = ow; tela.height = oh;
      tela.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(raddrizza(dati.data, canvas.width, canvas.height, q, ow, oh), ow, oh), 0, 0);
      angoliUsati = q;
    }
  }
  const taglio = !angoliUsati && ritaglio && rettangoloPixel(ritaglio, canvas.width, canvas.height);
  if (taglio && (taglio.w < canvas.width || taglio.h < canvas.height)) {
    tela = document.createElement('canvas');
    tela.width = taglio.w; tela.height = taglio.h;
    tela.getContext('2d', { willReadFrequently: true }).drawImage(canvas, taglio.x, taglio.y, taglio.w, taglio.h, 0, 0, taglio.w, taglio.h);
  }
  if (modo !== 'originale') {
    const ct = tela.getContext('2d', { willReadFrequently: true });
    const dati = ct.getImageData(0, 0, tela.width, tela.height);
    migliora(dati.data, modo, tela.width, tela.height);
    ct.putImageData(dati, 0, 0);
  }
  if (Math.max(tela.width, tela.height) > lato) {
    const k = lato / Math.max(tela.width, tela.height);
    const piccola = document.createElement('canvas');
    piccola.width = Math.round(tela.width * k); piccola.height = Math.round(tela.height * k);
    piccola.getContext('2d').drawImage(tela, 0, 0, piccola.width, piccola.height);
    tela = piccola;
  }
  return { url: tela.toDataURL('image/jpeg', qualita), larghezza: tela.width, altezza: tela.height, angoli: angoliUsati };
}

// Pagine → PDF A4 (verticale o orizzontale secondo la foto), immagine centrata con margine.
export async function creaPdf(pagine, nome = 'Scansione') {
  const { jsPDF: JsPdf } = await import('jspdf');
  let pdf = null;
  for (const p of pagine) {
    const orizzontale = p.larghezza > p.altezza;
    const formato = orizzontale ? [297, 210] : [210, 297];
    if (!pdf) pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: orizzontale ? 'landscape' : 'portrait', compress: true });
    else pdf.addPage('a4', orizzontale ? 'landscape' : 'portrait');
    const margine = 6;
    const [W, H] = formato;
    const scala = Math.min((W - 2 * margine) / p.larghezza, (H - 2 * margine) / p.altezza);
    const w = p.larghezza * scala;
    const h = p.altezza * scala;
    pdf.addImage(p.url, 'JPEG', (W - w) / 2, (H - h) / 2, w, h, undefined, 'FAST');
  }
  pdf.setProperties({ title: nome });
  const blob = pdf.output('blob');
  return new File([blob], `${nome.replace(/[^\w\- ]+/g, '').trim() || 'Scansione'}.pdf`, { type: 'application/pdf' });
}

// SCAN-PDF-MANAGER — angoli del foglio trovati nella foto (già ruotata), senza raddrizzarla:
// servono per proporli nell'editor degli angoli. null se il foglio non si distingue.
export async function rilevaAngoli(file, { rotazione = 0 } = {}) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scala = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scala)); const h = Math.max(1, Math.round(bitmap.height * scala));
  const giro = ((rotazione % 360) + 360) % 360;
  const canvas = document.createElement('canvas');
  canvas.width = giro % 180 ? h : w; canvas.height = giro % 180 ? w : h;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.translate(canvas.width / 2, canvas.height / 2); c.rotate((giro * Math.PI) / 180);
  c.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  return trovaAngoli(c.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}
