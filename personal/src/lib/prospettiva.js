// SCAN-PDF-MANAGER (PO 2026-11-11: «Raddrizza automatico») — trova i quattro angoli del foglio
// in una foto e lo raddrizza (correzione prospettica). Funzioni pure su array di pixel: nessuna
// rete, nessun modello, testabili in Node. Gli angoli sono normalizzati da 0 a 1 sull'immagine
// già ruotata: { tl, tr, br, bl } ognuno { x, y }.
export const ANGOLI_INTERI = { tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } };
const ORDINE = ['tl', 'tr', 'br', 'bl'];
const tra = (v, a, b) => Math.max(a, Math.min(b, v));

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

// SCAN-BORDI (PO 2026-11-25: «lo scanner non prende bene i documenti»). Il vecchio metodo (una sola
// soglia di luminosità + angoli estremi) sbagliava con ombre sul foglio, luce non uniforme, scrivania
// chiara, riflessi e fogli ruotati. Ora: (1) più candidati — soglia di luminosità, soglia di «bianco»
// (chiaro e poco colorato), riempimento dal centro fermato dai bordi; (2) per ognuno l'involucro convesso
// ridotto a 4 lati; (3) ogni lato agganciato al bordo vero nella foto più grande (retta sui punti di
// massimo contrasto); (4) vince il candidato i cui lati combaciano di più con bordi veri. Se nessuno
// convince: null (niente contorno inventato).
const LATO_RILEVA = 256;
const LATO_RIFINITURA = 560;

// Riduzione a media di blocchi (niente scalettature): luminosità L e colore C (max−min dei canali).
function riduci(px, larghezza, altezza, lato) {
  const s = Math.min(1, lato / Math.max(larghezza, altezza));
  const w = Math.max(1, Math.round(larghezza * s)); const h = Math.max(1, Math.round(altezza * s));
  const L = new Float32Array(w * h); const C = new Float32Array(w * h); const n = new Float32Array(w * h);
  const mx = new Int32Array(larghezza);
  for (let x = 0; x < larghezza; x += 1) mx[x] = Math.min(w - 1, Math.floor((x * w) / larghezza));
  for (let y = 0; y < altezza; y += 1) {
    const riga = Math.min(h - 1, Math.floor((y * h) / altezza)) * w;
    for (let x = 0; x < larghezza; x += 1) {
      const i = (y * larghezza + x) * 4; const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
      const o = riga + mx[x];
      L[o] += (r * 299 + g * 587 + b * 114) / 1000;
      C[o] += Math.max(r, g, b) - Math.min(r, g, b);
      n[o] += 1;
    }
  }
  for (let i = 0; i < L.length; i += 1) { L[i] /= n[i] || 1; C[i] /= n[i] || 1; }
  return { L, C, w, h };
}

function sfocaBox(g, w, h, r) {
  const t = new Float32Array(g.length); const out = new Float32Array(g.length);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let s = 0; let k = 0;
    for (let d = -r; d <= r; d += 1) { const xx = x + d; if (xx >= 0 && xx < w) { s += g[y * w + xx]; k += 1; } }
    t[y * w + x] = s / k;
  }
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let s = 0; let k = 0;
    for (let d = -r; d <= r; d += 1) { const yy = y + d; if (yy >= 0 && yy < h) { s += t[yy * w + x]; k += 1; } }
    out[y * w + x] = s / k;
  }
  return out;
}

function gradiente(L, C, w, h) {
  const G = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const i = y * w + x;
    const sob = (a) => {
      const gx = a[i - w + 1] + 2 * a[i + 1] + a[i + w + 1] - a[i - w - 1] - 2 * a[i - 1] - a[i + w - 1];
      const gy = a[i + w - 1] + 2 * a[i + w] + a[i + w + 1] - a[i - w - 1] - 2 * a[i - w] - a[i - w + 1];
      return Math.hypot(gx, gy) / 4;
    };
    G[i] = sob(L) + 0.7 * sob(C);
  }
  return G;
}

// Otsu sui soli valori fra da e a (soglie a più livelli: testo / piano / carta).
function sogliaOtsuF(g, da = -1, a = 256) {
  const isto = new Float64Array(256); let n = 0;
  for (let i = 0; i < g.length; i += 1) { const v = g[i]; if (v > da && v <= a) { isto[v < 0 ? 0 : v > 255 ? 255 : v | 0] += 1; n += 1; } }
  if (n < 50) return null;
  let totale = 0; for (let i = 0; i < 256; i += 1) totale += i * isto[i];
  let sommaB = 0; let pesoB = 0; let migliore = -1; let soglia = null;
  for (let t = 0; t < 256; t += 1) {
    pesoB += isto[t]; if (!pesoB) continue;
    const pesoF = n - pesoB; if (!pesoF) break;
    sommaB += t * isto[t];
    const d = sommaB / pesoB - (totale - sommaB) / pesoF; const v = pesoB * pesoF * d * d;
    if (v > migliore) { migliore = v; soglia = t; }
  }
  return soglia;
}
function soglia(canale, t) { const m = new Uint8Array(canale.length); for (let i = 0; i < m.length; i += 1) m[i] = canale[i] > t ? 1 : 0; return m; }

// Erosione / dilatazione 3×3 separabile (apertura: stacca ponti sottili verso oggetti chiari vicini).
function morfo(mask, w, h, erodi) {
  const t = new Uint8Array(mask.length); const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y += 1) {
    const o = y * w;
    for (let x = 0; x < w; x += 1) {
      const a = x > 0 ? mask[o + x - 1] : 0; const c = x < w - 1 ? mask[o + x + 1] : 0; const b = mask[o + x];
      t[o + x] = erodi ? a & b & c : a | b | c;
    }
  }
  for (let i = 0; i < mask.length; i += 1) {
    const a = i >= w ? t[i - w] : 0; const c = i < mask.length - w ? t[i + w] : 0; const b = t[i];
    out[i] = erodi ? a & b & c : a | b | c;
  }
  return out;
}
const apri = (m, w, h, n) => { let r = m; for (let i = 0; i < n; i += 1) r = morfo(r, w, h, true); for (let i = 0; i < n; i += 1) r = morfo(r, w, h, false); return r; };

// Componenti connesse (4-vicini); restituisce le più grandi (array di indici).
function componenti(mask, w, h, minimo) {
  const visto = new Uint8Array(w * h); const coda = new Int32Array(w * h); const out = [];
  let resto = 0; for (let i = 0; i < mask.length; i += 1) resto += mask[i];
  for (let s = 0; s < mask.length; s += 1) {
    if (!mask[s] || visto[s]) continue;
    let testa = 0; let fine = 0; coda[fine++] = s; visto[s] = 1;
    while (testa < fine) {
      const p = coda[testa++]; const x = p % w;
      if (x > 0 && mask[p - 1] && !visto[p - 1]) { visto[p - 1] = 1; coda[fine++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !visto[p + 1]) { visto[p + 1] = 1; coda[fine++] = p + 1; }
      if (p >= w && mask[p - w] && !visto[p - w]) { visto[p - w] = 1; coda[fine++] = p - w; }
      if (p < w * (h - 1) && mask[p + w] && !visto[p + w]) { visto[p + w] = 1; coda[fine++] = p + w; }
    }
    if (fine >= minimo) out.push(coda.slice(0, fine));
    resto -= fine; if (resto < minimo) break;
  }
  return out.sort((a, b) => b.length - a.length).slice(0, 2);
}

// Riempimento dal centro attraverso i pixel senza bordi forti (G < soglia).
function riempiDalCentro(G, w, h, soglia) {
  const mask = new Uint8Array(w * h); const coda = new Int32Array(w * h);
  let fine = 0;
  for (let y = Math.round(h * 0.45); y <= Math.round(h * 0.55); y += 1) for (let x = Math.round(w * 0.45); x <= Math.round(w * 0.55); x += 1) {
    const p = y * w + x; if (G[p] < soglia && !mask[p]) { mask[p] = 1; coda[fine++] = p; }
  }
  let testa = 0;
  while (testa < fine) {
    const p = coda[testa++]; const x = p % w;
    const vicini = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1];
    for (const q of vicini) if (q >= 0 && !mask[q] && G[q] < soglia) { mask[q] = 1; coda[fine++] = q; }
  }
  return mask;
}

// Involucro convesso (catena monotona) dei punti estremi di ogni riga.
function involucro(punti, w) {
  let y0 = Infinity; let y1 = -1;
  for (let i = 0; i < punti.length; i += 1) { const y = (punti[i] / w) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const mn = new Int32Array(y1 - y0 + 1).fill(1 << 30); const mxx = new Int32Array(y1 - y0 + 1).fill(-1);
  for (let i = 0; i < punti.length; i += 1) { const p = punti[i]; const y = (p / w) | 0; const x = p - y * w; const k = y - y0; if (x < mn[k]) mn[k] = x; if (x > mxx[k]) mxx[k] = x; }
  const P = [];
  for (let k = 0; k < mn.length; k += 1) if (mxx[k] >= 0) { const y = y0 + k; P.push([mn[k], y], [mxx[k] + 1, y], [mn[k], y + 1], [mxx[k] + 1, y + 1]); }
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const giu = []; for (const p of P) { while (giu.length >= 2 && cr(giu[giu.length - 2], giu[giu.length - 1], p) <= 0) giu.pop(); giu.push(p); }
  const su = []; for (let i = P.length - 1; i >= 0; i -= 1) { const p = P[i]; while (su.length >= 2 && cr(su[su.length - 2], su[su.length - 1], p) <= 0) su.pop(); su.push(p); }
  return giu.slice(0, -1).concat(su.slice(0, -1));
}

// Riduce l'involucro a 4 vertici: toglie ogni volta il vertice che, prolungando i lati vicini,
// aggiunge meno area (così gli angoli arrotondati o tagliati tornano angoli veri).
function aQuattro(H) {
  let P = H.map(([x, y]) => ({ x, y }));
  const inter = (a, b, c, d) => {
    const r = { x: b.x - a.x, y: b.y - a.y }; const s = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * s.y - r.y * s.x; if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den; return { x: a.x + t * r.x, y: a.y + t * r.y };
  };
  const areaTri = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  while (P.length > 4) {
    let migliore = null;
    const n = P.length;
    for (let i = 0; i < n; i += 1) {
      // togli il lato P[i]→P[i+1]: i lati vicini si prolungano fino a incontrarsi
      const a = P[(i - 1 + n) % n]; const b = P[i]; const c = P[(i + 1) % n]; const d = P[(i + 2) % n];
      const q = inter(a, b, d, c);
      let costo; let tipo;
      if (q && (q.x - b.x) * (b.x - a.x) + (q.y - b.y) * (b.y - a.y) >= 0) { costo = areaTri(b, q, c); tipo = q; } else { costo = areaTri(a, b, c) + 1e6; tipo = null; }
      if (!migliore || costo < migliore.costo) migliore = { costo, i, q: tipo };
    }
    const { i, q } = migliore;
    if (q) { P[i] = q; P.splice((i + 1) % n, 1); } else P.splice(i, 1);
  }
  return P;
}

// Ordine tl, tr, br, bl (in senso orario sull'immagine, tl = più in alto a sinistra).
function ordina(P) {
  let a = 0; for (let i = 0; i < 4; i += 1) { const p = P[i]; const r = P[(i + 1) % 4]; a += p.x * r.y - r.x * p.y; }
  const Q = a < 0 ? [...P].reverse() : [...P];
  let k = 0; for (let i = 1; i < 4; i += 1) if (Q[i].x + Q[i].y < Q[k].x + Q[k].y) k = i;
  const R = [0, 1, 2, 3].map((i) => Q[(k + i) % 4]);
  return { tl: R[0], tr: R[1], br: R[2], bl: R[3] };
}

function campiona(L, w, h, x, y) {
  const fx = tra(x - 0.5, 0, w - 1); const fy = tra(y - 0.5, 0, h - 1);
  const x0 = Math.floor(fx); const y0 = Math.floor(fy); const x1 = Math.min(w - 1, x0 + 1); const y1 = Math.min(h - 1, y0 + 1);
  const ax = fx - x0; const ay = fy - y0;
  const t = L[y0 * w + x0] + (L[y0 * w + x1] - L[y0 * w + x0]) * ax;
  const b = L[y1 * w + x0] + (L[y1 * w + x1] - L[y1 * w + x0]) * ax;
  return t + (b - t) * ay;
}

// Retta (punto + direzione) che passa meglio fra i punti (minimi quadrati totali).
function retta(punti) {
  let mx = 0; let my = 0; for (const p of punti) { mx += p.x; my += p.y; } mx /= punti.length; my /= punti.length;
  let sxx = 0; let syy = 0; let sxy = 0;
  for (const p of punti) { const dx = p.x - mx; const dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { x: mx, y: my, dx: Math.cos(ang), dy: Math.sin(ang) };
}
const distRetta = (r, p) => Math.abs((p.x - r.x) * r.dy - (p.y - r.y) * r.dx);
function incrocio(r, s) {
  const den = r.dx * s.dy - r.dy * s.dx; if (Math.abs(den) < 1e-6) return null;
  const t = ((s.x - r.x) * s.dy - (s.y - r.y) * s.dx) / den;
  return { x: r.x + t * r.dx, y: r.y + t * r.dy };
}

// Aggancia ogni lato al bordo vero (massimo contrasto lungo la normale) e misura quanto combacia.
function rifinisci(q, R) {
  const { L, w, h } = R; const raggio = Math.max(4, Math.max(w, h) * 0.035);
  const vertici = ORDINE.map((k) => q[k]);
  const lati = []; const misure = [];
  for (let i = 0; i < 4; i += 1) {
    const a = vertici[i]; const b = vertici[(i + 1) % 4];
    const lung = Math.hypot(b.x - a.x, b.y - a.y); if (lung < 8) return null;
    const tx = (b.x - a.x) / lung; const ty = (b.y - a.y) / lung;
    const nx = ty; const ny = -tx; // verso l'esterno (ordine orario sull'immagine)
    const sulBordo = [[a.x, b.x, 0], [a.x, b.x, w], [a.y, b.y, 0], [a.y, b.y, h]]
      .some(([u, v, lim]) => Math.abs(u - lim) < Math.max(w, h) * 0.015 && Math.abs(v - lim) < Math.max(w, h) * 0.015);
    const campioni = 36; const trovati = [];
    for (let k = 0; k < campioni; k += 1) {
      const t = 0.08 + (0.84 * (k + 0.5)) / campioni;
      const cx = a.x + (b.x - a.x) * t; const cy = a.y + (b.y - a.y) * t;
      let meglio = 0; let pos = 0;
      for (let s = -raggio; s <= raggio; s += 0.5) {
        let d = 0;
        for (const o of [-1.5, 0, 1.5]) {
          const px = cx + s * nx + o * tx; const py = cy + s * ny + o * ty;
          d += campiona(L, w, h, px - nx * 1.5, py - ny * 1.5) - campiona(L, w, h, px + nx * 1.5, py + ny * 1.5);
        }
        d /= 3; // >0: più chiaro dentro che fuori
        if (Math.abs(d) > Math.abs(meglio)) { meglio = d; pos = s; }
      }
      if (Math.abs(meglio) >= 6) trovati.push({ x: cx + pos * nx, y: cy + pos * ny, d: meglio });
    }
    misure.push({ trovati, a, b, tx, ty, sulBordo, campioni });
  }
  // Un foglio ha lo stesso verso di contrasto su tutti i lati (di solito più chiaro del piano):
  // si contano solo i bordi con il verso prevalente (una scacchiera o una piastrella non passano).
  let piu = 0; let meno = 0;
  for (const m of misure) for (const p of m.trovati) if (p.d > 0) piu += 1; else meno += 1;
  const verso = piu >= meno ? 1 : -1;
  if (Math.max(piu, meno) < (piu + meno) * 0.8) return null;
  for (const { trovati, a, tx, ty, sulBordo, campioni } of misure) {
    let punti = trovati.filter((p) => p.d * verso > 0);
    let r = null;
    for (let giro = 0; giro < 3 && punti.length >= 6; giro += 1) {
      r = retta(punti);
      const tolleranza = giro === 0 ? raggio * 0.5 : Math.max(1.5, Math.max(w, h) * 0.004);
      punti = punti.filter((p) => distRetta(r, p) <= tolleranza);
    }
    let sostegno = punti.length / campioni;
    if (punti.length >= 6) r = retta(punti); else r = null;
    // la retta trovata non deve girare troppo rispetto al lato di partenza
    if (r && Math.abs(r.dx * tx + r.dy * ty) < Math.cos((12 * Math.PI) / 180)) { r = null; sostegno = 0; }
    if (!r) r = { x: a.x, y: a.y, dx: tx, dy: ty };
    if (sulBordo) sostegno = Math.max(sostegno, 0.5);
    lati.push({ r, sostegno });
  }
  const angoli = [];
  for (let i = 0; i < 4; i += 1) {
    const p = incrocio(lati[(i + 3) % 4].r, lati[i].r);
    if (!p) return null;
    const v = vertici[i];
    if (Math.hypot(p.x - v.x, p.y - v.y) > raggio * 2.5) return null;
    angoli.push({ x: tra(p.x / w, 0, 1), y: tra(p.y / h, 0, 1) });
  }
  const s = lati.map((l) => l.sostegno);
  return { q: { tl: angoli[0], tr: angoli[1], br: angoli[2], bl: angoli[3] }, punteggio: s.reduce((x, y) => x + y, 0) / 4, minimo: Math.min(...s) };
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
// Angoli interni fra 35° e 145°: un foglio, anche in prospettiva, non è mai più storto di così.
function angoliPlausibili(q) {
  const P = ORDINE.map((k) => q[k]);
  for (let i = 0; i < 4; i += 1) {
    const a = P[(i + 3) % 4]; const b = P[i]; const c = P[(i + 1) % 4];
    const u = { x: a.x - b.x, y: a.y - b.y }; const v = { x: c.x - b.x, y: c.y - b.y };
    const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1);
    const g = (Math.acos(tra(cos, -1, 1)) * 180) / Math.PI;
    if (g < 35 || g > 145) return false;
  }
  return true;
}

// Quadrilatero dai punti estremi (x±y) della componente: regge quando un oggetto chiaro sporge da un lato.
function estremi(comp, w) {
  let tl; let tr; let br; let bl; let minS = Infinity; let maxS = -Infinity; let minD = Infinity; let maxD = -Infinity;
  for (const p of comp) {
    const x = p % w; const y = (p - x) / w; const s1 = x + y; const d = x - y;
    if (s1 < minS) { minS = s1; tl = { x, y }; }
    if (s1 > maxS) { maxS = s1; br = { x: x + 1, y: y + 1 }; }
    if (d > maxD) { maxD = d; tr = { x: x + 1, y }; }
    if (d < minD) { minD = d; bl = { x, y: y + 1 }; }
  }
  return [tl, tr, br, bl];
}

// Linee rette dei bordi (Hough sui punti di bordo, ognuno vota solo vicino alla direzione del suo
// gradiente), poi le coppie di linee che formano un quadrilatero plausibile con più bordo sotto.
function quadDaLinee(L, w, h) {
  const n = w * h; const gx = new Float32Array(n); const gy = new Float32Array(n); const m = new Float32Array(n);
  for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const i = y * w + x;
    gx[i] = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1]) / 4;
    gy[i] = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1]) / 4;
    m[i] = Math.hypot(gx[i], gy[i]);
  }
  const ord = Float32Array.from(m).sort(); const soglia = Math.max(2.5, ord[Math.floor(n * 0.9)]);
  const NT = 90; const diag = Math.ceil(Math.hypot(w, h)); const NR = 2 * diag + 1;
  const acc = new Float32Array(NT * NR); const cs = []; const sn = [];
  for (let t = 0; t < NT; t += 1) { cs.push(Math.cos((t * Math.PI) / NT)); sn.push(Math.sin((t * Math.PI) / NT)); }
  const bordo = new Uint8Array(n);
  for (let y = 2; y < h - 2; y += 1) for (let x = 2; x < w - 2; x += 1) {
    const i = y * w + x; if (m[i] < soglia) continue;
    // solo massimi locali lungo il gradiente (bordo sottile)
    const ux = gx[i] / m[i]; const uy = gy[i] / m[i];
    const a = m[Math.round(y + uy) * w + Math.round(x + ux)]; const b = m[Math.round(y - uy) * w + Math.round(x - ux)];
    if (m[i] < a || m[i] < b) continue;
    bordo[i] = 1;
    let t0 = Math.round(((Math.atan2(uy, ux) + Math.PI) % Math.PI) / (Math.PI / NT));
    for (let d = -4; d <= 4; d += 1) {
      const t = (t0 + d + NT) % NT; const r = Math.round(x * cs[t] + y * sn[t]) + diag;
      acc[t * NR + r] += Math.min(m[i], 40);
    }
  }
  // picchi con soppressione dei vicini
  const picchi = [];
  const cand = [];
  for (let i = 0; i < acc.length; i += 1) if (acc[i] > 0) cand.push(i);
  cand.sort((a, b) => acc[b] - acc[a]);
  for (const i of cand) {
    if (picchi.length >= 14 || acc[i] < acc[cand[0]] * 0.15) break;
    const t = Math.floor(i / NR); const r = (i % NR) - diag;
    if (picchi.some((p) => { const dt = Math.min(Math.abs(p.t - t), NT - Math.abs(p.t - t)); const rr = Math.abs(p.t - t) > NT / 2 ? -r : r; return dt <= 4 && Math.abs(p.r - rr) <= 6; })) continue;
    picchi.push({ t, r, c: cs[t], s: sn[t] });
  }
  const inter = (p, q) => { const det = p.c * q.s - p.s * q.c; if (Math.abs(det) < 1e-6) return null; return { x: (p.r * q.s - q.r * p.s) / det, y: (p.c * q.r - q.c * p.r) / det }; };
  const angDiff = (p, q) => { const d = Math.abs(p.t - q.t) % NT; return (Math.min(d, NT - d) * 180) / NT; };
  // quanta parte del contorno passa su punti di bordo
  const sostegno = (P) => {
    let si = 0; let tot = 0;
    for (let k = 0; k < 4; k += 1) {
      const a = P[k]; const b = P[(k + 1) % 4]; const lung = Math.hypot(b.x - a.x, b.y - a.y); const passi = Math.max(4, Math.round(lung));
      for (let j = 0; j <= passi; j += 1) {
        const x = Math.round(a.x + ((b.x - a.x) * j) / passi); const y = Math.round(a.y + ((b.y - a.y) * j) / passi); tot += 1;
        let v = 0; for (let dy = -1; dy <= 1 && !v; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const xx = x + dx; const yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && bordo[yy * w + xx]) { v = 1; break; } }
        si += v;
      }
    }
    return si / tot;
  };
  const coppie = [];
  for (let i = 0; i < picchi.length; i += 1) for (let j = i + 1; j < picchi.length; j += 1) {
    if (angDiff(picchi[i], picchi[j]) < 40) coppie.push([picchi[i], picchi[j]]);
  }
  const risultati = [];
  for (let i = 0; i < coppie.length; i += 1) for (let j = i + 1; j < coppie.length; j += 1) {
    const [a, b] = coppie[i]; const [c, d] = coppie[j];
    if (angDiff(a, c) < 35 || angDiff(a, d) < 35 || angDiff(b, c) < 35 || angDiff(b, d) < 35) continue;
    const P = [inter(a, c), inter(c, b), inter(b, d), inter(d, a)];
    if (P.some((p) => !p || p.x < -0.02 * w || p.y < -0.02 * h || p.x > 1.02 * w || p.y > 1.02 * h)) continue;
    const q = ordina(P);
    const qn = Object.fromEntries(ORDINE.map((k) => [k, { x: q[k].x / w, y: q[k].y / h }]));
    if (!convesso(qn) || area(qn) < 0.1 || !angoliPlausibili(qn)) continue;
    risultati.push({ P: ORDINE.map((k) => q[k]), s: sostegno(ORDINE.map((k) => q[k])) });
  }
  return risultati.sort((x, y) => y.s - x.s).slice(0, 3).map((r) => r.P);
}

// Angoli del foglio, oppure null se la foto non mostra un foglio riconoscibile
// (sfondo uguale alla carta, foglio troppo piccolo o già a tutto schermo).
// `vicino` (angoli del fotogramma precedente, fotocamera dal vivo): se il foglio è ancora lì basta
// riagganciare i lati (pochi millisecondi); la ricerca completa solo quando il foglio si perde.
export function trovaAngoli(px, larghezza, altezza, { vicino = null } = {}) {
  const grande = Math.max(larghezza, altezza) > LATO_RILEVA * 1.4;
  const R = riduci(px, larghezza, altezza, grande ? LATO_RIFINITURA : LATO_RILEVA);
  R.L = sfocaBox(R.L, R.w, R.h, grande ? 1 : 0);
  if (vicino && angoliValidi(vicino)) {
    const r = rifinisci(Object.fromEntries(ORDINE.map((k) => [k, { x: vicino[k].x * R.w, y: vicino[k].y * R.h }])), R);
    if (r && r.punteggio >= 0.7 && r.minimo >= 0.45 && convesso(r.q) && area(r.q) >= 0.1 && angoliPlausibili(r.q)) return ordina(ORDINE.map((k) => r.q[k]));
  }
  const D = grande ? riduci(px, larghezza, altezza, LATO_RILEVA) : { ...R, L: Float32Array.from(R.L) }; const { w, h } = D;
  const L = sfocaBox(sfocaBox(D.L, w, h, 1), w, h, 1); const C = sfocaBox(D.C, w, h, 1);
  const G = gradiente(L, C, w, h);
  const minimo = w * h * 0.08;
  const maschere = [];
  // 1. soglie a più livelli: chiaro rispetto al piano, anche con testo scuro o scrivania chiara
  const W = new Float32Array(L.length); for (let i = 0; i < W.length; i += 1) W[i] = Math.max(0, L[i] - 1.5 * C[i]); // 2. «bianco»: chiaro e poco colorato
  for (const canale of [L, W]) {
    const t1 = sogliaOtsuF(canale); if (t1 === null) continue;
    for (const t of [t1, sogliaOtsuF(canale, t1), sogliaOtsuF(canale, -1, t1)]) if (t !== null) maschere.push(soglia(canale, t));
  }
  // 3. dal centro fino ai bordi forti (ombre e luce sfumata non fermano il riempimento)
  const ordinati = Float32Array.from(G).sort();
  for (const perc of [0.8, 0.9, 0.95]) {
    const limite = Math.max(3, ordinati[Math.floor(ordinati.length * perc)]);
    maschere.push(morfo(morfo(riempiDalCentro(G, w, h, limite), w, h, false), w, h, false));
  }
  const grezzi = []; const viste = [];
  for (const m of maschere) {
    let chiari = 0; for (let i = 0; i < m.length; i += 1) chiari += m[i];
    if (chiari < minimo || chiari > m.length * 0.985) continue;
    if (viste.some((v) => { let d = 0; for (let i = 0; i < m.length; i += 1) d += m[i] ^ v[i]; return d < m.length * 0.005; })) continue;
    viste.push(m);
    for (const pulita of [m, apri(m, w, h, 2)]) {
      for (const comp of componenti(pulita, w, h, minimo)) {
        const H = involucro(comp, w); if (H.length < 4) continue;
        grezzi.push(aQuattro(H), estremi(comp, w));
      }
    }
  }
  // 4. linee rette dei bordi (angoli coperti da un riflesso, un dito, un oggetto)
  grezzi.push(...quadDaLinee(L, w, h));
  const scala = { x: R.w / w, y: R.h / h };
  const provati = [];
  let migliore = null;
  for (const g of grezzi) {
    const grezzo = ordina(g.map((p) => ({ x: p.x * scala.x, y: p.y * scala.y })));
    const chiave = ORDINE.map((k) => grezzo[k]);
    if (provati.some((p) => p.every((v, i) => Math.hypot(v.x - chiave[i].x, v.y - chiave[i].y) < Math.max(R.w, R.h) * 0.01))) continue;
    provati.push(chiave);
    const r = rifinisci(grezzo, R); if (!r) continue;
    const { q } = r;
    if (!convesso(q) || area(q) < 0.1 || !angoliPlausibili(q) || r.minimo < 0.4) continue;
    if (!migliore || r.punteggio > migliore.punteggio + 0.02 || (Math.abs(r.punteggio - migliore.punteggio) <= 0.02 && area(q) > area(migliore.q))) migliore = { ...r, q };
  }
  if (!migliore || migliore.punteggio < 0.5) return null;
  const q = ordina(ORDINE.map((k) => migliore.q[k]));
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
