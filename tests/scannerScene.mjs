// Scene sintetiche per il rilevatore del foglio (SCAN-BORDI): foglio in prospettiva su piani diversi,
// con ombre, testo, rumore. Solo per i test: nessuna foto reale.
const dentro = (x, y, q) => {
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < 0) return false; }
  return true;
};
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// Coordinate dentro il foglio (u,v in 0..1) per disegnare righe di testo.
function uv(x, y, q) {
  // inversa bilineare approssimata: proiezione su lati opposti (sufficiente per le righe di testo)
  const [a, b, c, d] = q;
  let u = 0.5, v = 0.5;
  for (let k = 0; k < 8; k++) {
    const px = (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x;
    const py = (1 - u) * (1 - v) * a.y + u * (1 - v) * b.y + u * v * c.y + (1 - u) * v * d.y;
    const dxu = (1 - v) * (b.x - a.x) + v * (c.x - d.x), dyu = (1 - v) * (b.y - a.y) + v * (c.y - d.y);
    const dxv = (1 - u) * (d.x - a.x) + u * (c.x - b.x), dyv = (1 - u) * (d.y - a.y) + u * (c.y - b.y);
    const det = dxu * dyv - dxv * dyu; if (Math.abs(det) < 1e-9) break;
    const ex = x - px, ey = y - py;
    u += (ex * dyv - ey * dxv) / det; v += (dxu * ey - dyu * ex) / det;
  }
  return { u, v };
}
export function scena({ w = 480, h = 640, quad, fondo = () => [60, 60, 60], carta = [238, 236, 230], luce = () => 1, testo = true, rumore = 6, seed = 1, extra = null }) {
  const r = rnd(seed), px = new Uint8ClampedArray(w * h * 4);
  const ss = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let R = 0, G = 0, B = 0;
    for (const [ox, oy] of ss) {
      const X = x + ox, Y = y + oy; let col;
      if (dentro(X, Y, quad)) {
        col = carta;
        if (testo) {
          const { u, v } = uv(X, Y, quad);
          const riga = (v * 34) % 1, n = Math.floor(v * 34);
          if (u > 0.1 && u < 0.9 - (n % 3) * 0.12 && v > 0.08 && v < 0.92 && riga > 0.55 && riga < 0.8 && Math.sin(u * 90 + n) > -0.3) col = [40, 40, 50];
          if (v > 0.06 && v < 0.12 && u > 0.1 && u < 0.5) col = [30, 60, 140];
        }
      } else col = extra?.(X, Y) || fondo(X, Y);
      const l = luce(X, Y);
      R += col[0] * l; G += col[1] * l; B += col[2] * l;
    }
    const i = (y * w + x) * 4, n = (r() - 0.5) * rumore * 2;
    px[i] = R / 4 + n; px[i + 1] = G / 4 + n; px[i + 2] = B / 4 + n; px[i + 3] = 255;
  }
  return px;
}
export const legno = (x, y) => { const v = 150 + 25 * Math.sin(x * 0.05 + Math.sin(y * 0.02) * 3) + 10 * Math.sin(x * 0.31); return [v + 30, v - 5, v - 45]; };
export const quadPersp = (w, h) => [{ x: w * 0.18, y: h * 0.14 }, { x: w * 0.84, y: h * 0.18 }, { x: w * 0.90, y: h * 0.86 }, { x: w * 0.10, y: h * 0.82 }];
export const quadRuotato = (w, h, gradi = 25) => {
  const cx = w / 2, cy = h / 2, a = (gradi * Math.PI) / 180, hw = w * 0.3, hh = h * 0.3;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) }));
};
export const SCENE = (() => {
  const w = 480, h = 640, P = quadPersp(w, h);
  return [
    { nome: 'piano scuro', w, h, quad: P },
    { nome: 'piano grigio chiaro', w, h, quad: P, fondo: () => [185, 185, 182] },
    { nome: 'scrivania bianca, carta avorio', w, h, quad: P, fondo: () => [214, 216, 220], carta: [236, 230, 212] },
    { nome: 'legno chiaro', w, h, quad: P, fondo: legno },
    { nome: 'ombra su metà foglio', w, h, quad: P, fondo: () => [110, 100, 95], luce: (x) => 0.55 + 0.45 / (1 + Math.exp(-(x - w * 0.55) / 12)) },
    { nome: 'luce sfumata (vignetta)', w, h, quad: P, fondo: () => [150, 150, 150], luce: (x, y) => 1.05 - 0.6 * Math.hypot(x / w - 0.3, y / h - 0.2) },
    { nome: 'ruotato 25°', w, h, quad: quadRuotato(w, h, 25), fondo: () => [90, 80, 70] },
    { nome: 'ruotato 45°', w, h, quad: quadRuotato(w, h, 45), fondo: () => [70, 75, 90] },
    { nome: 'oggetto chiaro che tocca il foglio', w, h, quad: P, fondo: () => [80, 80, 80], extra: (x, y) => (x > w * 0.82 && y > h * 0.4 && y < h * 0.6 ? [245, 245, 245] : null) },
    { nome: 'riflesso chiaro sul piano', w, h, quad: P, fondo: (x, y) => (Math.hypot(x - w * 0.95, y - h * 0.05) < 110 ? [240, 240, 240] : [120, 115, 110]) },
    { nome: 'orizzontale, piano scuro', w: 640, h: 480, quad: quadPersp(640, 480), fondo: () => [50, 55, 60] },
    { nome: 'rumore forte', w, h, quad: P, fondo: () => [120, 110, 100], rumore: 25 },
  ];
})();
