export const PATIENT_WORKSPACE_ACTIONS = Object.freeze({
  CREATE_CLINICAL_PLAN: { id: 'CREATE_CLINICAL_PLAN', domain: 'clinical', confirmation: true, prototypeOnly: true },
  ADD_TREATMENT: { id: 'ADD_TREATMENT', domain: 'clinical', confirmation: true, prototypeOnly: true },
  UPDATE_TREATMENT_STATUS: { id: 'UPDATE_TREATMENT_STATUS', domain: 'clinical', confirmation: true, prototypeOnly: true },
  CREATE_QUOTE: { id: 'CREATE_QUOTE', domain: 'financial', confirmation: true, prototypeOnly: true },
  SEND_QUOTE: { id: 'SEND_QUOTE', domain: 'communication', confirmation: true, prototypeOnly: true },
  PRINT_QUOTE: { id: 'PRINT_QUOTE', domain: 'document', confirmation: true, prototypeOnly: true },
  CREATE_PRESCRIPTION: { id: 'CREATE_PRESCRIPTION', domain: 'clinical-document', confirmation: true, prototypeOnly: true },
  CREATE_CONSENT: { id: 'CREATE_CONSENT', domain: 'clinical-document', confirmation: true, prototypeOnly: true },
  SEND_CLINICAL_SUMMARY: { id: 'SEND_CLINICAL_SUMMARY', domain: 'communication', confirmation: true, prototypeOnly: true },
});

export const getPatientWorkspaceAction = (id) => PATIENT_WORKSPACE_ACTIONS[id] || null;
