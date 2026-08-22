import test from 'node:test';
import assert from 'node:assert/strict';
import { pianificaInvioWABatch, annullaInvioWABatch } from '../src/lib/waBatchSender.js';

test('schedules one send per item, spaced by delayMs, in order', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const aperti = [];
  // Come nel codice reale (i * delayMs): il primo apre subito, i successivi
  // distanziati di delayMs — i browser bloccano più popup aperti nello
  // stesso istante da uno stesso click.
  pianificaInvioWABatch(['a', 'b', 'c'], { delayMs: 350, apri: (item) => aperti.push(item) });
  assert.deepEqual(aperti, []);
  t.mock.timers.tick(0);
  assert.deepEqual(aperti, ['a']);
  t.mock.timers.tick(350);
  assert.deepEqual(aperti, ['a', 'b']);
  t.mock.timers.tick(350);
  assert.deepEqual(aperti, ['a', 'b', 'c']);
});

test('onInviato fires alongside each apri, with the item and its index', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const inviati = [];
  pianificaInvioWABatch(['x', 'y'], { delayMs: 100, apri: () => {}, onInviato: (item, i) => inviati.push([item, i]) });
  t.mock.timers.tick(100);
  assert.deepEqual(inviati, [['x', 0], ['y', 1]]);
});

test('annullaInvioWABatch stops every send not yet fired — already-opened ones are untouched', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const aperti = [];
  const timerIds = pianificaInvioWABatch(['p1', 'p2', 'p3', 'p4'], { delayMs: 350, apri: (item) => aperti.push(item) });
  t.mock.timers.tick(0);   // p1 parte (nessun ritardo iniziale)
  t.mock.timers.tick(350); // p2 parte
  assert.deepEqual(aperti, ['p1', 'p2']);

  // L'utente annulla dopo aver visto partire i primi due invii: p3 e p4
  // erano ancora in coda, non ancora aperti.
  annullaInvioWABatch(timerIds);

  // Anche facendo avanzare il tempo oltre tutti i delay restanti, p3 e p4
  // non devono più partire: erano gli unici non ancora aperti al momento
  // dell'annullamento.
  t.mock.timers.tick(10_000);
  assert.deepEqual(aperti, ['p1', 'p2']);
});

test('cancelling before any send fires stops the entire batch', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const aperti = [];
  const timerIds = pianificaInvioWABatch(['solo'], { delayMs: 350, apri: (item) => aperti.push(item) });
  annullaInvioWABatch(timerIds);
  t.mock.timers.tick(10_000);
  assert.deepEqual(aperti, []);
});

test('an empty batch schedules nothing and cancels safely (no-op, no throw)', () => {
  const timerIds = pianificaInvioWABatch([], { apri: () => { throw new Error('non deve mai essere chiamato'); } });
  assert.deepEqual(timerIds, []);
  assert.doesNotThrow(() => annullaInvioWABatch(timerIds));
});
