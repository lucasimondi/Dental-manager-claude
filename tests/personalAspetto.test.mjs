import test from 'node:test';
import assert from 'node:assert/strict';
import { applicaAspetto, CHIAVE_ASPETTO, leggiAspetto, normalizzaAspetto, salvaAspetto } from '../personal/src/lib/aspetto.js';

test('appearance: modern default and unknown stored values never activate a theme', () => {
  for (const valore of [null, undefined, '', 'dark', 'windows', '{}']) assert.equal(normalizzaAspetto(valore), 'moderno');
  assert.equal(leggiAspetto(null), 'moderno');
  assert.equal(leggiAspetto({ getItem: () => 'win95' }), 'win95');
});
test('appearance: Windows95 and modern roundtrip use one isolated device preference', () => {
  const mem = new Map([['poliedron-personal-vista', 'documenti']]);
  const storage = { getItem: (k) => mem.get(k), setItem: (k,v) => mem.set(k,v) };
  assert.equal(salvaAspetto(storage, 'win95'), 'win95');
  assert.equal(leggiAspetto(storage), 'win95');
  salvaAspetto(storage, 'moderno');
  assert.equal(leggiAspetto(storage), 'moderno');
  assert.equal(mem.get('poliedron-personal-vista'), 'documenti');
  assert.deepEqual([...mem.keys()], ['poliedron-personal-vista', CHIAVE_ASPETTO]);
});
test('appearance: unavailable storage never prevents switching during the current session', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.equal(leggiAspetto(storage), 'moderno');
  assert.equal(salvaAspetto(storage, 'win95'), 'win95');
  assert.equal(salvaAspetto(null, 'moderno'), 'moderno');
});
test('appearance: root marker is reversible and preserves unrelated attributes', () => {
  const root = { dataset: { other: 'keep' } };
  applicaAspetto(root, 'win95');
  assert.deepEqual(root.dataset, { other: 'keep', personalTheme: 'win95' });
  applicaAspetto(root, 'moderno');
  assert.equal(root.dataset.personalTheme, 'moderno');
  assert.equal(applicaAspetto(null, 'win95'), 'win95');
});
