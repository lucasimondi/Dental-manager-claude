import test from 'node:test';
import assert from 'node:assert/strict';
import { addReceivableToLatestPlan, buildContextualPayment } from '../src/lib/domain/incassiActions.js';

test('creates a normal occasional plan when the patient has none', () => {
  const result = addReceivableToLatestPlan([], { pazienteId: '7', descrizione: 'Igiene', importo: 80, eseguita: true });
  assert.equal(result.length, 1); assert.equal(result[0].titolo, 'Prestazioni occasionali');
  assert.equal(result[0].voci[0].prezzo, 80); assert.equal(result[0].voci[0].eseguita, true);
});

test('adds the item to the most recent patient plan only', () => {
  const plans = [{ id: 'old', pazienteId: 7, data: '2026-01-01', voci: [] }, { id: 'new', pazienteId: 7, data: '2026-02-01', voci: [] }, { id: 'other', pazienteId: 8, data: '2026-03-01', voci: [] }];
  const result = addReceivableToLatestPlan(plans, { pazienteId: 7, descrizione: 'Visita', importo: 50, eseguita: false });
  assert.equal(result.find((p) => p.id === 'new').voci.length, 1); assert.equal(result.find((p) => p.id === 'old').voci.length, 0); assert.equal(result.find((p) => p.id === 'other').voci.length, 0);
});

test('builds an immediately collected payment', () => {
  const payment = buildContextualPayment({ pazienteId: '7', importo: 30, descrizione: 'Igiene' });
  assert.equal(payment.stato, 'pagato'); assert.equal(payment.importo, 30); assert.equal(payment.pazienteId, 7);
});
