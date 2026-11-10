// POL-VITA-006 — scansione di documenti dal telefono: foto delle pagine, miglioramento per la
// lettura (bianco e nero o colori più netti), rotazione, poi un solo PDF A4 da archiviare.
// Le funzioni sui pixel sono pure (lavorano su un array RGBA) e quindi testabili.
const LATO_MAX = 2000;

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

export function migliora(px, modo) {
  if (modo === 'originale') return px;
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
export async function elaboraPagina(file, { modo = 'documento', rotazione = 0, ritaglio = null } = {}) {
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
  c.setTransform(1, 0, 0, 1, 0, 0);
  let tela = canvas;
  const taglio = ritaglio && rettangoloPixel(ritaglio, canvas.width, canvas.height);
  if (taglio && (taglio.w < canvas.width || taglio.h < canvas.height)) {
    tela = document.createElement('canvas');
    tela.width = taglio.w; tela.height = taglio.h;
    tela.getContext('2d', { willReadFrequently: true }).drawImage(canvas, taglio.x, taglio.y, taglio.w, taglio.h, 0, 0, taglio.w, taglio.h);
  }
  if (modo !== 'originale') {
    const ct = tela.getContext('2d', { willReadFrequently: true });
    const dati = ct.getImageData(0, 0, tela.width, tela.height);
    migliora(dati.data, modo);
    ct.putImageData(dati, 0, 0);
  }
  return { url: tela.toDataURL('image/jpeg', 0.85), larghezza: tela.width, altezza: tela.height };
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
