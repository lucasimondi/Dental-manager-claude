import test from 'node:test';
import assert from 'node:assert/strict';
import { trovaPazienteInTesto } from '../src/lib/ricercaPazienti.js';

const patients = [
  { id: 1, nome: 'Mario', cognome: 'Rossi' },
  { id: 2, nome: 'Anna', cognome: 'Bianchi' },
  { id: 3, nome: 'Mario', cognome: 'Verdi' },
];

test('trovaPazienteInTesto finds the one patient whose name+surname both appear in the text', () => {
  const found = trovaPazienteInTesto(patients, 'BONIFICO DA MARIO ROSSI RIF FATTURA 123');
  assert.equal(found.id, 1);
});

test('trovaPazienteInTesto is accent/case-insensitive and order-independent', () => {
  const found = trovaPazienteInTesto(patients, 'accredito bianchi ANNA saldo conto corrente');
  assert.equal(found.id, 2);
});

test('trovaPazienteInTesto returns null when no patient name is found', () => {
  assert.equal(trovaPazienteInTesto(patients, 'ACCREDITO POS TERMINALE 00123'), null);
});

test('trovaPazienteInTesto returns null on ambiguity (two patients share a first name)', () => {
  // "Mario" alone matches two patients, but neither surname appears, so
  // nothing qualifies here; this checks the real ambiguous case instead:
  // a text mentioning both a first name shared by two patients AND both
  // their surnames must not silently pick one.
  const found = trovaPazienteInTesto(patients, 'MARIO ROSSI E MARIO VERDI VERSAMENTO CONGIUNTO');
  assert.equal(found, null);
});

test('trovaPazienteInTesto returns null for empty/missing text', () => {
  assert.equal(trovaPazienteInTesto(patients, ''), null);
  assert.equal(trovaPazienteInTesto(patients, null), null);
});
