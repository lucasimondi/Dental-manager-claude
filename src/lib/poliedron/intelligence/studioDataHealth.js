import { SIGNAL_TYPE } from './model.js';

const ISSUE_KEY_BY_TYPE = Object.freeze({
  [SIGNAL_TYPE.MISSING_TREATMENT_PLAN]: 'patientsWithoutPlan',
  [SIGNAL_TYPE.MISSING_EXECUTION_STATUS]: 'performancesWithoutExecutionStatus',
  [SIGNAL_TYPE.MISSING_PLAN_STATUS]: 'plansWithoutStatus',
  [SIGNAL_TYPE.EMPTY_ACCEPTED_PLAN]: 'acceptedPlansWithoutPerformances',
  [SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING]: 'preventionRecordsWithoutConfiguration',
  [SIGNAL_TYPE.MISSING_TOOTH_REFERENCE]: 'treatmentsWithoutToothReference',
  [SIGNAL_TYPE.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'plansAwaitingAcceptanceDecision',
});

export function calculateStudioDataHealth({
  results, patientCount, planCount, performanceCount, available = true,
}) {
  const issues = {
    patientsWithoutPlan: 0,
    performancesWithoutExecutionStatus: 0,
    plansWithoutStatus: 0,
    acceptedPlansWithoutPerformances: 0,
    preventionRecordsWithoutConfiguration: 0,
    treatmentsWithoutToothReference: 0,
    plansAwaitingAcceptanceDecision: 0,
  };
  for (const result of results) {
    for (const signal of result.signals) {
      const key = ISSUE_KEY_BY_TYPE[signal.type];
      if (!key) continue;
      const amount = signal.type === SIGNAL_TYPE.MISSING_EXECUTION_STATUS || signal.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE
        ? signal.context?.count || 1
        : 1;
      issues[key] += amount;
    }
  }
  if (!available) {
    return Object.freeze({
      name: 'Studio Data Health',
      nonClinical: true,
      available: false,
      score: null,
      issues: Object.freeze(issues),
      evaluatedWorkflowStates: 0,
      message: 'Non disponibile con i permessi o i dati valutabili correnti.',
    });
  }
  const issueCount = Object.values(issues).reduce((sum, value) => sum + value, 0);
  const evaluatedWorkflowStates = Math.max(1, patientCount + planCount + performanceCount);
  const score = Math.max(0, Math.round(100 * (1 - Math.min(1, issueCount / evaluatedWorkflowStates))));
  return Object.freeze({
    name: 'Studio Data Health',
    nonClinical: true,
    available: true,
    score,
    issues: Object.freeze(issues),
    evaluatedWorkflowStates,
    message: issueCount
      ? `${issueCount} stati operativi incompleti riducono l’affidabilità dei suggerimenti. Completarli renderà Poliedron più preciso.`
      : 'I dati operativi valutabili risultano completi per gli stati richiesti.',
  });
}
