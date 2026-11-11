// SCAN-PDF-MANAGER (PO 2026-11-11: «Raddrizza automatico») — trova i quattro angoli del foglio
// in una foto e lo raddrizza (correzione prospettica). Funzioni pure su array di pixel: nessuna
// rete, nessun modello, testabili in Node. Gli angoli sono normalizzati da 0 a 1 sull'immagine
// già ruotata: { tl, tr, br, bl } ognuno { x, y }.
const LATO_ANALISI = 256;
export const ANGOLI_INTERI = { tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } };
const ORDINE = ['tl', 'tr', 'br', 'bl'];
const tra = (v, a, b) => Math.max(a, Math.min(b, v));

// Luminosità (0-255) di un'immagine RGBA, ridotta a ~256 px di lato per l'analisi.
export function grigioRidotto(px, larghezza, altezza, lato = LATO_ANALISI) {
  const s = Math.min(1, lato / Math.max(larghezza, altezza));
  const w = Math.max(1, Math.round(larghezza * s)); const h = Math.max(1, Math.round(altezza * s));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(altezza - 1, Math.floor((y + 0.5) / s));
    for (let x = 0; x < w; x += 1) {
      const i = (sy * larghezza + Math.min(larghezza - 1, Math.floor((x + 0.5) / s))) * 4;
      out[y * w + x] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    }
  }
  return { grigio: out, w, h };
}

function sfoca(g, w, h) {
  const out = new Uint8Array(g.length);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let s = 0; let n = 0;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const xx = x + dx; const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += g[yy * w + xx]; n += 1; }
    }
    out[y * w + x] = s / n;
  }
  return out;
}

export function sogliaOtsu(g) {
  const isto = new Float64Array(256);
  for (const v of g) isto[v] += 1;
  let totale = 0; for (let i = 0; i < 256; i += 1) totale += i * isto[i];
  let sommaB = 0; let pesoB = 0; let migliore = 0; let soglia = 127;
  for (let t = 0; t < 256; t += 1) {
    pesoB += isto[t]; if (!pesoB) continue;
    const pesoF = g.length - pesoB; if (!pesoF) break;
    sommaB += t * isto[t];
    const mB = sommaB / pesoB; const mF = (totale - sommaB) / pesoF;
    const tra2 = pesoB * pesoF * (mB - mF) ** 2;
    if (tra2 > migliore) { migliore = tra2; soglia = t; }
  }
  return soglia;
}

// Componente chiara più grande (il foglio su un piano più scuro).
function componenteMaggiore(mask, w, h) {
  const etichetta = new Int32Array(w * h).fill(-1);
  const coda = new Int32Array(w * h);
  let migliore = null;
  for (let s = 0; s < mask.length; s += 1) {
    if (!mask[s] || etichetta[s] !== -1) continue;
    let testa = 0; let fine = 0; coda[fine++] = s; etichetta[s] = s;
    const punti = [];
    while (testa < fine) {
      const p = coda[testa++]; punti.push(p);
      const x = p % w; const y = (p - x) / w;
      const vicini = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of vicini) if (q >= 0 && mask[q] && etichetta[q] === -1) { etichetta[q] = s; coda[fine++] = q; }
    }
    if (!migliore || punti.length > migliore.length) migliore = punti;
  }
  return migliore || [];
}

const area = (q) => {
  let a = 0;
  for (let i = 0; i < 4; i += 1) { const p = q[ORDINE[i]]; const r = q[ORDINE[(i + 1) % 4]]; a += p.x * r.y - r.x * p.y; }
  return a / 2;
};
export function convesso(q) {
  let segno = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = q[ORDINE[i]]; const b = q[ORDINE[(i + 1) % 4]]; const c = q[ORDINE[(i + 2) % 4]];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) return false;
    if (segno && Math.sign(z) !== segno) return false;
    segno = Math.sign(z);
  }
  return true;
}

// Angoli del foglio, oppure null se la foto non mostra un foglio riconoscibile
// (sfondo chiaro quanto la carta, foglio troppo piccolo o già a tutto schermo).
export function trovaAngoli(px, larghezza, altezza) {
  const { grigio, w, h } = grigioRidotto(px, larghezza, altezza);
  const g = sfoca(grigio, w, h);
  const soglia = sogliaOtsu(g);
  const mask = new Uint8Array(g.length);
  let chiari = 0;
  for (let i = 0; i < g.length; i += 1) if (g[i] > soglia) { mask[i] = 1; chiari += 1; }
  if (chiari < g.length * 0.15 || chiari > g.length * 0.97) return null;
  const punti = componenteMaggiore(mask, w, h);
  if (punti.length < g.length * 0.15) return null;
  let tl; let tr; let br; let bl;
  let minS = Infinity; let maxS = -Infinity; let minD = Infinity; let maxD = -Infinity;
  for (const p of punti) {
    const x = p % w; const y = (p - x) / w;
    const s = x + y; const d = x - y;
    if (s < minS) { minS = s; tl = [x, y]; }
    if (s > maxS) { maxS = s; br = [x, y]; }
    if (d > maxD) { maxD = d; tr = [x, y]; }
    if (d < minD) { minD = d; bl = [x, y]; }
  }
  const n = ([x, y], dx, dy) => ({ x: tra((x + dx) / w, 0, 1), y: tra((y + dy) / h, 0, 1) });
  const q = { tl: n(tl, 0, 0), tr: n(tr, 1, 0), br: n(br, 1, 1), bl: n(bl, 0, 1) };
  const a = area(q);
  if (!convesso(q) || a < 0.15) return null;
  // Già a tutto schermo: niente da raddrizzare.
  if (ORDINE.every((k) => Math.hypot(q[k].x - ANGOLI_INTERI[k].x, q[k].y - ANGOLI_INTERI[k].y) < 0.02)) return null;
  return q;
}

// Matrice 3×3 (array di 9) che porta i punti `da` sui punti `a` (4 coppie).
export function omografia(da, a) {
  const A = []; const b = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = da[i]; const { x: u, y: v } = a[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c += 1) {
    let p = c; for (let r = c + 1; r < 8; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('Angoli non validi.');
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k += 1) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...b.map((v, i) => v / A[i][i]), 1];
}
export function applica(H, { x, y }) {
  const z = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / z, y: (H[3] * x + H[4] * y + H[5]) / z };
}

// Dimensioni del foglio raddrizzato: lati più lunghi del quadrilatero, entro `max` px.
export function misureRaddrizzate(q, larghezza, altezza, max = 2000) {
  const d = (a, b) => Math.hypot((q[a].x - q[b].x) * larghezza, (q[a].y - q[b].y) * altezza);
  let w = Math.max(d('tl', 'tr'), d('bl', 'br')); let h = Math.max(d('tl', 'bl'), d('tr', 'br'));
  const s = Math.min(1, max / Math.max(w, h));
  w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
  return { w, h };
}

// Raddrizza: per ogni pixel di uscita si legge il punto corrispondente nella foto (bilineare).
export function raddrizza(px, larghezza, altezza, q, outW, outH) {
  const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  const src = ORDINE.map((k) => ({ x: q[k].x * larghezza, y: q[k].y * altezza }));
  const H = omografia(dst, src);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const cx = x + 0.5; const cy = y + 0.5;
      const z = H[6] * cx + H[7] * cy + H[8];
      const sx = tra((H[0] * cx + H[1] * cy + H[2]) / z - 0.5, 0, larghezza - 1);
      const sy = tra((H[3] * cx + H[4] * cy + H[5]) / z - 0.5, 0, altezza - 1);
      const x0 = Math.floor(sx); const y0 = Math.floor(sy);
      const x1 = Math.min(larghezza - 1, x0 + 1); const y1 = Math.min(altezza - 1, y0 + 1);
      const fx = sx - x0; const fy = sy - y0;
      const i00 = (y0 * larghezza + x0) * 4; const i10 = (y0 * larghezza + x1) * 4;
      const i01 = (y1 * larghezza + x0) * 4; const i11 = (y1 * larghezza + x1) * 4;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const top = px[i00 + c] + (px[i10 + c] - px[i00 + c]) * fx;
        const bot = px[i01 + c] + (px[i11 + c] - px[i01 + c]) * fx;
        out[o + c] = top + (bot - top) * fy;
      }
    }
  }
  return out;
}

export function muoviAngolo(q, chiave, x, y) {
  return { ...q, [chiave]: { x: tra(x, 0, 1), y: tra(y, 0, 1) } };
}
export const angoliValidi = (q) => !!q && ORDINE.every((k) => Number.isFinite(q[k]?.x) && Number.isFinite(q[k]?.y)) && convesso(q) && area(q) > 0.01;
export const angoliInteri = (q) => !q || ORDINE.every((k) => Math.hypot(q[k].x - ANGOLI_INTERI[k].x, q[k].y - ANGOLI_INTERI[k].y) < 0.002);
