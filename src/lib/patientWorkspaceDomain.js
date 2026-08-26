export const PATIENT_WORKSPACE_ENTITIES = Object.freeze([
  'PATIENT', 'CLINICAL_PLAN', 'CLINICAL_PATHWAY', 'TREATMENT', 'ANATOMICAL_SITE', 'QUOTE', 'PAYMENT',
  'PAYMENT_PLAN', 'INSTALLMENT', 'APPOINTMENT', 'RECALL', 'FOLLOWUP', 'CLINICAL_ALERT', 'PRESCRIPTION',
  'CONSENT', 'DOCUMENT', 'TIMELINE_EVENT', 'AUTOMATION_RULE',
]);

export const AUTOMATION_CONTRACT = Object.freeze({ stages: ['TRIGGER', 'CONDITION', 'ACTION'], prototypeOnly: true });

export function createPatientWorkspaceContext(input = {}) {
  return Object.freeze({
    patient: input.patient || null,
    activeClinicalPlan: input.activeClinicalPlan || null,
    clinicalPlans: input.clinicalPlans || [], treatments: input.treatments || [], anatomicalContext: input.anatomicalContext || [],
    alerts: input.alerts || [], quotes: input.quotes || [], payments: input.payments || [], paymentPlans: input.paymentPlans || [],
    installments: input.installments || [], appointments: input.appointments || [], recalls: input.recalls || [], followups: input.followups || [],
    documents: input.documents || [], prescriptions: input.prescriptions || [], consents: input.consents || [], automationRules: input.automationRules || [], timeline: input.timeline || [],
    provenance: input.provenance || { source: 'synthetic-preview', factsAreAuthoritative: false, suggestionsAreFacts: false },
  });
}
