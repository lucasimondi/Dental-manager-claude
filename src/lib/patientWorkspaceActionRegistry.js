export const PATIENT_WORKSPACE_ACTIONS = Object.freeze({
  CREATE_CLINICAL_PLAN: { id: 'CREATE_CLINICAL_PLAN', domain: 'clinical', confirmation: true, prototypeOnly: true },
  ADD_TREATMENT: { id: 'ADD_TREATMENT', domain: 'clinical', confirmation: true, prototypeOnly: true },
  UPDATE_TREATMENT_STATUS: { id: 'UPDATE_TREATMENT_STATUS', domain: 'clinical', confirmation: true, prototypeOnly: true },
  CREATE_QUOTE: { id: 'CREATE_QUOTE', domain: 'financial', confirmation: true, prototypeOnly: true },
  SEND_QUOTE: { id: 'SEND_QUOTE', domain: 'communication', confirmation: true, prototypeOnly: true },
  PRINT_QUOTE: { id: 'PRINT_QUOTE', domain: 'document', confirmation: true, prototypeOnly: true },
  CREATE_PRESCRIPTION: { id: 'CREATE_PRESCRIPTION', domain: 'clinical-document', confirmation: true, prototypeOnly: false, adapter: 'prescription.create' },
  CREATE_CONSENT: { id: 'CREATE_CONSENT', domain: 'clinical-document', confirmation: true, prototypeOnly: true, adapter: 'consenso_modelli', blockedReason: 'SIGNED_CONSENT_CREATION_CONTRACT_NOT_VERIFIED' },
  SEND_CLINICAL_SUMMARY: { id: 'SEND_CLINICAL_SUMMARY', domain: 'communication', confirmation: true, prototypeOnly: true },
  CREATE_RECALL: { id: 'CREATE_RECALL', domain: 'automation', confirmation: true, prototypeOnly: true },
  CREATE_FOLLOWUP: { id: 'CREATE_FOLLOWUP', domain: 'automation', confirmation: true, prototypeOnly: true },
  SUGGEST_TREATMENT: { id: 'SUGGEST_TREATMENT', domain: 'automation', confirmation: true, prototypeOnly: true },
  CREATE_TASK: { id: 'CREATE_TASK', domain: 'automation', confirmation: true, prototypeOnly: true },
  SUGGEST_APPOINTMENT: { id: 'SUGGEST_APPOINTMENT', domain: 'automation', confirmation: true, prototypeOnly: true },
  CHECK_MISSING_STEP: { id: 'CHECK_MISSING_STEP', domain: 'automation', confirmation: false, prototypeOnly: true },
  NOTIFY_CLINICIAN: { id: 'NOTIFY_CLINICIAN', domain: 'automation', confirmation: false, prototypeOnly: true },
  REGISTER_PAYMENT: { id: 'REGISTER_PAYMENT', domain: 'financial', confirmation: true, prototypeOnly: true },
  CREATE_PAYMENT_PLAN: { id: 'CREATE_PAYMENT_PLAN', domain: 'financial', confirmation: true, prototypeOnly: true },
  UPDATE_PAYMENT_PLAN: { id: 'UPDATE_PAYMENT_PLAN', domain: 'financial', confirmation: true, prototypeOnly: true },
});

export const getPatientWorkspaceAction = (id) => PATIENT_WORKSPACE_ACTIONS[id] || null;
