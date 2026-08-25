import {
  buildNewPlan,
  buildTreatmentItem,
  createPlan,
  getPlanById,
  loadPatientPlans,
  markTreatmentItemCompleted,
  updatePlan,
} from './domain/treatmentPlanService.js';
import { buildPendingPayment, createPayment } from './domain/paymentService.js';

const requireValue = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`${label} obbligatorio`);
  return value;
};

const assertPlanOwnership = (plan, patientId) => {
  if (!plan) throw new Error('Piano clinico non trovato');
  if (String(plan.pazienteId) !== String(patientId)) throw new Error('Il piano non appartiene al paziente selezionato');
  if (!Array.isArray(plan.voci)) throw new Error('Il piano contiene prestazioni non valide');
};

export async function createClinicalPlanForPatient(db, { patientId, title, treatments = [] }) {
  requireValue(patientId, 'Paziente');
  requireValue(title, 'Titolo piano');
  const voci = treatments.map((treatment) => buildTreatmentItem(treatment));
  const payload = buildNewPlan({ pazienteId: patientId, titolo: title.trim(), voci });
  const created = await createPlan(db, payload);
  const verified = await getPlanById(db, created?.id || payload.id);
  if (!verified) throw new Error('Creazione piano non verificata');
  assertPlanOwnership(verified, patientId);
  return verified;
}

export async function addTreatmentToPatientPlan(db, { patientId, planId, treatment }) {
  requireValue(patientId, 'Paziente');
  requireValue(planId, 'Piano clinico');
  const plan = await getPlanById(db, planId);
  assertPlanOwnership(plan, patientId);
  const item = buildTreatmentItem(treatment || {});
  requireValue(item.prestazione, 'Prestazione');
  const updated = { ...plan, voci: [...plan.voci, item], stato: plan.stato === 'concluso' ? 'attivo' : plan.stato };
  const verified = await updatePlan(db, plan.id, updated);
  assertPlanOwnership(verified, patientId);
  if (verified.voci.length !== updated.voci.length) throw new Error('Aggiunta prestazione non verificata');
  return verified;
}

export async function completePatientTreatment(db, { patientId, planId, treatmentIndex }) {
  requireValue(patientId, 'Paziente');
  requireValue(planId, 'Piano clinico');
  if (!Number.isInteger(treatmentIndex) || treatmentIndex < 0) throw new Error('Prestazione non valida');
  const freshPlan = await getPlanById(db, planId);
  assertPlanOwnership(freshPlan, patientId);
  const result = markTreatmentItemCompleted(freshPlan, treatmentIndex);
  if (!freshPlan.voci[treatmentIndex]) throw new Error('Prestazione non trovata');
  if (!result.changed) return freshPlan;
  const verified = await updatePlan(db, freshPlan.id, result.plan);
  assertPlanOwnership(verified, patientId);
  if (verified.voci[treatmentIndex]?.eseguita !== true) throw new Error('Completamento prestazione non verificato');
  return verified;
}

export async function registerPatientPayment(db, { patientId, amount, method = 'Contanti', note = '' }) {
  requireValue(patientId, 'Paziente');
  if (!(Number(amount) > 0)) throw new Error('Importo pagamento non valido');
  const payload = { ...buildPendingPayment({ pazienteId: patientId, amount, metodo: method, nota: note }), stato: 'pagato' };
  const created = await createPayment(db, payload);
  if (!created?.id) throw new Error('Registrazione pagamento non verificata');
  if (String(created.pazienteId) !== String(patientId)) throw new Error('Pagamento associato al paziente errato');
  return created;
}

export async function refreshPatientWorkspace(db, patientId) {
  requireValue(patientId, 'Paziente');
  return { plans: await loadPatientPlans(db, patientId) };
}

export function replacePersistedPlan(plans, persistedPlan) {
  if (!persistedPlan?.id) return Array.isArray(plans) ? plans : [];
  const current = Array.isArray(plans) ? plans : [];
  const index = current.findIndex((plan) => String(plan.id) === String(persistedPlan.id));
  if (index < 0) return [...current, persistedPlan];
  return current.map((plan, planIndex) => planIndex === index ? persistedPlan : plan);
}

export const PATIENT_WORKSPACE_INTEGRATION_CAPABILITIES = Object.freeze({
  clinicalPlans: 'write',
  treatments: 'write',
  treatmentCompletion: 'write',
  payments: 'write',
  documents: 'existing-module',
  consents: 'existing-module',
  odontogram: 'selector-only',
  paymentPlans: 'blocked-no-canonical-model',
  timeline: 'blocked-no-event-store',
});
