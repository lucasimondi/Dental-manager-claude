import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTreatmentToPatientPlan,
  completePatientTreatment,
  createClinicalPlanForPatient,
  PATIENT_WORKSPACE_INTEGRATION_CAPABILITIES,
  replacePersistedPlan,
  registerPatientPayment,
} from '../src/lib/patientWorkspaceIntegration.js';

const fakeDb = (initialPlans = []) => {
  const rows = { dm_pl: structuredClone(initialPlans), dm_py: [] };
  return {
    rows,
    async getAll(key) { return structuredClone(rows[key] || []); },
    async getById(key, id) { return structuredClone((rows[key] || []).find((row) => String(row.id) === String(id)) || null); },
    async insert(key, payload) { rows[key].push(structuredClone(payload)); return structuredClone(payload); },
    async update(key, id, payload) { const index = rows[key].findIndex((row) => String(row.id) === String(id)); rows[key][index] = structuredClone(payload); },
  };
};

test('creates and verifies a clinical plan using the legacy canonical service', async () => {
  const db = fakeDb();
  const plan = await createClinicalPlanForPatient(db, { patientId: 7, title: 'Piano conservativa', treatments: [{ procedureRef: { text: 'Otturazione' }, tooth: { state: 'known', value: '26' }, price: 180 }] });
  assert.equal(plan.pazienteId, 7);
  assert.equal(plan.voci[0].prestazione, 'Otturazione');
  assert.equal(plan.voci[0].dente, '26');
});

test('refuses cross-patient plan writes', async () => {
  const db = fakeDb([{ id: 'p1', pazienteId: 8, titolo: 'Altro', stato: 'attivo', voci: [] }]);
  await assert.rejects(() => addTreatmentToPatientPlan(db, { patientId: 7, planId: 'p1', treatment: { procedureRef: { text: 'Igiene' }, price: 100 } }), /non appartiene/);
});

test('adds a treatment after a fresh plan read', async () => {
  const db = fakeDb([{ id: 'p1', pazienteId: 7, titolo: 'Piano', stato: 'attivo', voci: [] }]);
  const plan = await addTreatmentToPatientPlan(db, { patientId: 7, planId: 'p1', treatment: { procedureRef: { text: 'Igiene' }, tooth: { state: 'unknown' }, price: 100 } });
  assert.equal(plan.voci.length, 1);
  assert.equal(plan.voci[0].prestazione, 'Igiene');
});

test('completion is persisted, verified and idempotent', async () => {
  const db = fakeDb([{ id: 'p1', pazienteId: 7, titolo: 'Piano', stato: 'attivo', voci: [{ prestazione: 'Corona', prezzo: 700, eseguita: false }] }]);
  const first = await completePatientTreatment(db, { patientId: 7, planId: 'p1', treatmentIndex: 0 });
  const second = await completePatientTreatment(db, { patientId: 7, planId: 'p1', treatmentIndex: 0 });
  assert.equal(first.voci[0].eseguita, true);
  assert.equal(second.voci[0].dataEsec, first.voci[0].dataEsec);
  assert.equal(second.stato, 'concluso');
});

test('registers a received payment with the existing payment shape', async () => {
  const db = fakeDb();
  const payment = await registerPatientPayment(db, { patientId: 7, amount: 250, method: 'Carta', note: 'Acconto' });
  assert.equal(payment.stato, 'pagato');
  assert.equal(payment.importo, 250);
  assert.equal(payment.metodo, 'Carta');
});

test('unsupported entities stay explicitly blocked instead of inventing persistence', () => {
  assert.equal(PATIENT_WORKSPACE_INTEGRATION_CAPABILITIES.paymentPlans, 'blocked-no-canonical-model');
  assert.equal(PATIENT_WORKSPACE_INTEGRATION_CAPABILITIES.odontogram, 'selector-only');
  assert.equal(PATIENT_WORKSPACE_INTEGRATION_CAPABILITIES.documents, 'existing-module');
});

test('reconciles a verified plan locally without triggering a second remote write', () => {
  const original = [{ id: 'p1', voci: [] }, { id: 'p2', voci: [] }];
  const verified = { id: 'p1', voci: [{ prestazione: 'Igiene', eseguita: true }] };
  const next = replacePersistedPlan(original, verified);
  assert.deepEqual(next[0], verified);
  assert.equal(next[1], original[1]);
});
