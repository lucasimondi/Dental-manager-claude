import test from 'node:test';
import assert from 'node:assert/strict';
import { addReceivableToLatestPlan, buildContextualPayment, isActivePlan, planAssignmentForPatient, unassignedPaymentsForMultiPlanPatients } from '../src/lib/domain/incassiActions.js';

test('creates a normal occasional plan when the patient has none, and returns its id', () => {
  const result = addReceivableToLatestPlan([], { pazienteId: '7', descrizione: 'Igiene', importo: 80, eseguita: true });
  assert.equal(result.plans.length, 1); assert.equal(result.plans[0].titolo, 'Prestazioni occasionali');
  assert.equal(result.plans[0].voci[0].prezzo, 80); assert.equal(result.plans[0].voci[0].eseguita, true);
  assert.equal(result.planId, result.plans[0].id);
});

test('adds the item to the most recent patient plan only, and returns that plan id', () => {
  const plans = [{ id: 'old', pazienteId: 7, data: '2026-01-01', voci: [] }, { id: 'new', pazienteId: 7, data: '2026-02-01', voci: [] }, { id: 'other', pazienteId: 8, data: '2026-03-01', voci: [] }];
  const result = addReceivableToLatestPlan(plans, { pazienteId: 7, descrizione: 'Visita', importo: 50, eseguita: false });
  assert.equal(result.plans.find((p) => p.id === 'new').voci.length, 1); assert.equal(result.plans.find((p) => p.id === 'old').voci.length, 0); assert.equal(result.plans.find((p) => p.id === 'other').voci.length, 0);
  assert.equal(result.planId, 'new');
});

test('builds an immediately collected payment, carrying piano_id when given', () => {
  const payment = buildContextualPayment({ pazienteId: '7', importo: 30, descrizione: 'Igiene', pianoId: 'new' });
  assert.equal(payment.stato, 'pagato'); assert.equal(payment.importo, 30); assert.equal(payment.pazienteId, 7);
  assert.equal(payment.pianoId, 'new');
});

test('builds a contextual payment without piano_id when none is given (no guessing)', () => {
  const payment = buildContextualPayment({ pazienteId: '7', importo: 30, descrizione: 'Igiene' });
  assert.equal('pianoId' in payment, false);
});

test('isActivePlan excludes concluso/rifiutato, includes attivo/accettato', () => {
  assert.equal(isActivePlan({ stato: 'attivo' }), true);
  assert.equal(isActivePlan({ stato: 'accettato' }), true);
  assert.equal(isActivePlan({ stato: 'concluso' }), false);
  assert.equal(isActivePlan({ stato: 'rifiutato' }), false);
});

test('unassignedPaymentsForMultiPlanPatients: only piano_id-less payments for patients with >1 plan', () => {
  const plans = [
    { id: 1, pazienteId: 2 }, { id: 2, pazienteId: 2 }, // patient 2: two plans
    { id: 3, pazienteId: 4 }, // patient 4: one plan
  ];
  const payments = [
    { id: 'a', pazienteId: 2, importo: 900 }, // no pianoId, patient has 2 plans -> unresolved
    { id: 'b', pazienteId: 2, importo: 300, pianoId: 1 }, // already assigned -> excluded
    { id: 'c', pazienteId: 4, importo: 150 }, // single-plan patient, no pianoId (should have been auto-backfilled server-side, but even so: not ambiguous) -> excluded
    { id: 'd', pazienteId: 99, importo: 50 }, // no plans at all -> excluded
  ];
  const result = unassignedPaymentsForMultiPlanPatients(payments, plans);
  assert.deepEqual(result.map((p) => p.id), ['a']);
});

test('planAssignmentForPatient: auto-assigns the single active plan', () => {
  const plans = [{ id: 1, pazienteId: 5, stato: 'attivo' }, { id: 2, pazienteId: 5, stato: 'concluso' }];
  assert.deepEqual(planAssignmentForPatient(plans, 5), { mode: 'auto', pianoId: 1 });
});

test('planAssignmentForPatient: asks to choose among more than one active plan', () => {
  const plans = [{ id: 1, pazienteId: 5, stato: 'attivo' }, { id: 2, pazienteId: 5, stato: 'accettato' }];
  const result = planAssignmentForPatient(plans, 5);
  assert.equal(result.mode, 'choose');
  assert.deepEqual(result.options.map((p) => p.id), [1, 2]);
});

test('planAssignmentForPatient: nothing to link when the patient has no active plan', () => {
  assert.deepEqual(planAssignmentForPatient([], 5), { mode: 'none' });
  assert.deepEqual(planAssignmentForPatient([{ id: 1, pazienteId: 5, stato: 'concluso' }], 5), { mode: 'none' });
});
