import {
  createSignal, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';

export function scanDataCompleteness({ plans, canReadClinical }) {
  if (!canReadClinical || plans.length) return [];
  return [createSignal({
    type: SIGNAL_TYPE.MISSING_TREATMENT_PLAN,
    taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
    severity: SEVERITY.LOW,
    reason: 'Il paziente è registrato ma non risulta alcun piano di cura; l’assenza può essere legittima oppure indicare dati incompleti.',
    source: 'patient_plan_index',
    confidence: 0.45,
    confidencePenalty: 0.2,
  })];
}
