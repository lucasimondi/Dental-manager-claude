// PO 2026-11-08: "tema win togliamo" — un solo stile, moderno.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { applicaAspetto, CHIAVE_ASPETTO, leggiAspetto, normalizzaAspetto, salvaAspetto } from '../personal/src/lib/aspetto.js';

test('aspetto: sempre moderno, anche con una vecchia scelta win95 salvata', () => {
  for (const valore of [null, undefined, '', 'win95', 'dark']) assert.equal(normalizzaAspetto(valore), 'moderno');
  assert.equal(leggiAspetto({ getItem: () => 'win95' }), 'moderno');
  const mem = new Map([[CHIAVE_ASPETTO, 'win95']]);
  assert.equal(salvaAspetto({ setItem: (k, v) => mem.set(k, v) }), 'moderno');
  assert.equal(mem.get(CHIAVE_ASPETTO), 'moderno');
  assert.equal(salvaAspetto({ setItem() { throw new Error('quota'); } }), 'moderno');
  const root = { dataset: { other: 'keep' } };
  applicaAspetto(root);
  assert.deepEqual(root.dataset, { other: 'keep', personalTheme: 'moderno' });
});

test('aspetto: niente più interruttore né foglio di stile Windows 95', () => {
  assert.equal(existsSync('personal/src/retro.css'), false);
  for (const f of ['personal/src/App.jsx', 'personal/src/Accesso.jsx', 'personal/src/sezioni/impostazioni/Impostazioni.jsx', 'personal/src/main.jsx']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /CambioAspetto|retro\.css|Windows 95/, f);
  }
});
