import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { perPratica } from '../personal/src/lib/daFare.js';

const pr = (id, titolo) => ({ id, titolo, fascicolo: 'legale', n_documenti: 2 });
test('i promemoria della stessa pratica diventano una sola voce; gli altri restano singoli; urgenti prima', () => {
  const A = pr('A', 'Alfa'), B = pr('B', 'Beta');
  const voci = [
    { id: '1', titolo: 'uno', priorita: 'media', scadenza: '2026-12-10', pratica: A },
    { id: '2', titolo: 'due', priorita: 'alta', scadenza: '2026-12-20', pratica: A, importo: 50 },
    { id: '3', titolo: 'tre', priorita: 'bassa', pratica: B },
    { id: '4', titolo: 'quattro', priorita: 'alta', scadenza: '2026-12-01', pratica: null },
  ];
  const e = perPratica(voci);
  assert.deepEqual(e.map((x) => [x.tipo, x.id]), [['promemoria', '4'], ['pratica', 'A'], ['pratica', 'B']]);
  const a = e.find((x) => x.id === 'A');
  assert.equal(a.voci.length, 2); assert.equal(a.priorita, 'alta'); assert.equal(a.scadenza, '2026-12-10'); assert.equal(a.importo, 50);
  assert.deepEqual(a.voci.map((x) => x.id), ['2', '1'], 'dentro la pratica: prima gli urgenti');
});

test('la pratica arriva anche dal documento del promemoria; la voce apre la pratica e ha l\'anteprima', () => {
  const lib = readFileSync('personal/src/lib/daFare.js', 'utf8');
  assert.match(lib, /r\.pratica_id \|\| perId\.get\(r\.documento_id\)\?\.pratica_id/);
  const vista = readFileSync('personal/src/sezioni/dafare/DaFare.jsx', 'utf8');
  assert.match(vista, /ctx\.apri\(\{ tipo: 'pratica', p: pr \}\)/);
  assert.match(vista, /<Miniatura doc=\{pr\.anteprima/);
  assert.match(vista, /ctx\.apri\(\{ tipo: 'documento', id: p\.documento\.id \}\)/);
});
