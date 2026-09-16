import test from 'node:test';
import assert from 'node:assert/strict';
import { totalePagatoPaziente } from '../src/lib/domain/incassiMath.js';

// Product Owner: registered a 50€ payment for Fabio Di Stefano, then
// created a 100€ plan afterwards — "nel pagato in alto... non c'è...
// deve comparire nel pagato comunque a prescindere" (must show up in
// "Pagato" regardless of plan linkage). Root cause: SchedaPaz.jsx's
// "Pagato" figure was aggSaldi.totale_pagato, summed from get_saldo_piano
// rows — PER-PLAN by definition, so a payment with piano_id still NULL
// (made before any plan existed) was invisible to it forever, even after
// a plan was later created (POL-FIN-008).

test('totalePagatoPaziente sums only stato:"pagato" payments, regardless of piano_id (assigned or not)', () => {
  const payments = [
    { id: 'a', importo: 50, stato: 'pagato', pianoId: null }, // unassigned — must still count
    { id: 'b', importo: 30, stato: 'pagato', pianoId: 'plan-1' }, // assigned — counts too
    { id: 'c', importo: 999, stato: 'sospeso' }, // not yet actually received — excluded
  ];
  assert.equal(totalePagatoPaziente(payments), 80);
});

test('totalePagatoPaziente is case-insensitive on stato, matching Incassi.jsx\'s own "Incassato" convention', () => {
  assert.equal(totalePagatoPaziente([{ importo: 40, stato: 'PAGATO' }]), 40);
  assert.equal(totalePagatoPaziente([{ importo: 40, stato: 'Pagato' }]), 40);
});

test('totalePagatoPaziente handles missing/malformed input without throwing', () => {
  assert.equal(totalePagatoPaziente(undefined), 0);
  assert.equal(totalePagatoPaziente([]), 0);
  assert.equal(totalePagatoPaziente([{ importo: null }, { importo: undefined }, {}]), 0);
});

test('totalePagatoPaziente: the exact reported scenario — a payment made before any plan existed still counts as Pagato', () => {
  // Fabio Di Stefano: registers a 50€ payment while he has zero plans yet.
  const paymentBeforeAnyPlan = { id: 'pay-1', importo: 50, stato: 'pagato', pianoId: undefined };
  assert.equal(totalePagatoPaziente([paymentBeforeAnyPlan]), 50);
});
