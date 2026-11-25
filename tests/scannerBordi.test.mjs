// SCAN-BORDI (PO 2026-11-25: «lo scanner non prende bene i documenti»): il foglio si trova anche con
// ombre, luce non uniforme, scrivania chiara, legno, riflessi, oggetti vicini e fogli ruotati; gli
// angoli sono precisi; dove non c'è un foglio non se ne inventa uno.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trovaAngoli } from '../personal/src/lib/prospettiva.js';
import { SCENE, scena, legno } from './scannerScene.mjs';

const K = ['tl', 'tr', 'br', 'bl'];
const errore = (q, s) => {
  let e = Infinity; // le etichette possono ruotare (foglio a 45°)
  for (let r = 0; r < 4; r++) e = Math.min(e, Math.max(...K.map((k, i) => Math.hypot((q[k].x * s.w) - s.quad[(i + r) % 4].x, (q[k].y * s.h) - s.quad[(i + r) % 4].y))));
  return e;
};

for (const s of SCENE) {
  test(`scanner: trova il foglio — ${s.nome}`, () => {
    const q = trovaAngoli(scena(s), s.w, s.h);
    assert.ok(q, 'foglio trovato');
    const e = errore(q, s);
    assert.ok(e < 3, `angoli entro 3 px (errore ${e.toFixed(2)} px)`);
    // l'ordine resta in senso orario con tl più in alto a sinistra
    assert.ok(q.tl.x + q.tl.y <= Math.min(q.tr.x + q.tr.y, q.br.x + q.br.y, q.bl.x + q.bl.y) + 1e-9);
  });
}

test('scanner: dal vivo riaggancia i lati partendo dal fotogramma prima', () => {
  const s = SCENE[3]; const px = scena(s);
  const base = trovaAngoli(px, s.w, s.h);
  const spostati = Object.fromEntries(K.map((k) => [k, { x: base[k].x + 0.012, y: base[k].y - 0.01 }]));
  const q = trovaAngoli(px, s.w, s.h, { vicino: spostati });
  assert.ok(errore(q, s) < 3);
});

test('scanner: nessun foglio inventato', () => {
  const vuoto = [{ x: -10, y: -10 }, { x: -9, y: -10 }, { x: -9, y: -9 }, { x: -10, y: -9 }];
  const casi = [
    { fondo: legno },
    { fondo: () => [128, 128, 128] },
    { fondo: (x, y) => [x / 2, y / 3, 100] },
    { fondo: (x, y) => ((Math.floor(x / 37) + Math.floor(y / 41)) % 2 ? [200, 200, 200] : [60, 60, 60]) },
  ];
  for (const c of casi) assert.equal(trovaAngoli(scena({ quad: vuoto, ...c }), 480, 640), null);
  assert.equal(trovaAngoli(scena({ quad: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 640 }, { x: 0, y: 640 }] }), 480, 640), null);
});
