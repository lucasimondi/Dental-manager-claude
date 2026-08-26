import { createPatientWorkspaceContext } from './patientWorkspaceDomain.js';
import { buildClinicalFinancialTimeline, planNetTotal, treatmentsFromPlans } from './patientWorkspaceClinicalFinancial.js';

const samePatient = (row, patientId) => String(row?.pazienteId ?? row?.paziente_id ?? '') === String(patientId ?? '');
const dateValue = (plan) => String(plan?.updated_at || plan?.data || plan?.created_at || '');
const ACTIVE_EXCLUSIONS = new Set(['concluso', 'rifiutato', 'annullato', 'archiviato']);

export function selectActiveClinicalPlan(plans = [], patientId) {
  return plans
    .filter((plan) => samePatient(plan, patientId) && !ACTIVE_EXCLUSIONS.has(String(plan.stato || '').toLowerCase()))
    .sort((a, b) => dateValue(b).localeCompare(dateValue(a)) || String(b.id).localeCompare(String(a.id)))[0] || null;
}

export function createPatientWorkspaceRealAdapter({
  patient, plans = [], payments = [], appointments = [], pricelist = [], recalls = [], documents = [],
  canonicalFinancial = null, financialScope = null, features = {}, studioMembership = null,
  currentUserId = null, isStudioAdmin = false,
} = {}) {
  const patientId = patient?.id;
  const patientPlans = plans.filter((row) => samePatient(row, patientId)).sort((a, b) => dateValue(b).localeCompare(dateValue(a)) || String(b.id).localeCompare(String(a.id)));
  const patientPayments = payments.filter((row) => samePatient(row, patientId));
  const patientAppointments = appointments.filter((row) => samePatient(row, patientId));
  const patientRecalls = recalls.filter((row) => samePatient(row, patientId));
  const treatments = treatmentsFromPlans(patientPlans);
  const activeClinicalPlan = selectActiveClinicalPlan(patientPlans, patientId);
  const quotes = patientPlans.map((plan) => ({
    id: `legacy-plan-quote:${plan.id}`,
    sourceId: plan.id,
    sourceEntity: 'plans',
    provenance: 'LEGACY_PLAN_PROJECTION',
    title: plan.titolo || 'Piano di cura',
    status: plan.stato || null,
    ...planNetTotal(plan),
  }));
  const timeline = buildClinicalFinancialTimeline({ plans: patientPlans, payments: patientPayments, appointments: patientAppointments, documents, recalls: patientRecalls });
  const patientFinancial = financialScope === 'PATIENT' ? canonicalFinancial : null;

  return createPatientWorkspaceContext({
    patient, activeClinicalPlan, clinicalPlans: patientPlans, treatments,
    anatomicalContext: treatments.map((item) => ({ type: item.site === 'Generale' ? 'GENERAL' : 'TOOTH', value: item.site, treatmentId: item.id })),
    alerts: [], quotes, payments: patientPayments, paymentPlans: [], installments: [],
    appointments: patientAppointments, recalls: patientRecalls, followups: [], documents,
    prescriptions: documents.filter((item) => item.category === 'prescriptions'),
    consents: documents.filter((item) => item.category === 'consents'), automationRules: [], timeline,
    provenance: {
      source: 'REAL_ADAPTER', factsAreAuthoritative: true, suggestionsAreFacts: false,
      treatments: 'plans.voci', quotes: 'plans legacy projection', payments: 'payments',
      financialSnapshot: canonicalFinancial ? `get_financial_snapshot_v1:${financialScope || 'UNKNOWN_SCOPE'}` : 'unavailable',
    },
    financial: {
      scope: financialScope, snapshot: patientFinancial,
      available: Boolean(patientFinancial), unavailableReason: patientFinancial ? null : 'PATIENT_SCOPED_CANONICAL_SNAPSHOT_UNAVAILABLE',
    },
    access: { features, studioMembership, currentUserId, isStudioAdmin, pricelist },
  });
}

export const isPatientWorkspaceV2Enabled = (features) => features?.patientWorkspaceV2 === true;
