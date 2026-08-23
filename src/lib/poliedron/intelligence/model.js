export const INTELLIGENCE_VERSION = 'pol-ai-004-v1';

export const SIGNAL_TAXONOMY = Object.freeze({
  OPPORTUNITY: 'OPPORTUNITY',
  DATA_QUALITY: 'DATA_QUALITY',
  FOLLOW_UP: 'FOLLOW_UP',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  PREVENTION: 'PREVENTION',
});

export const SIGNAL_TYPE = Object.freeze({
  UNFINISHED_TREATMENT: 'UNFINISHED_TREATMENT',
  NO_FUTURE_APPOINTMENT: 'NO_FUTURE_APPOINTMENT',
  RECALL_OVERDUE: 'RECALL_OVERDUE',
  RECALL_DUE: 'RECALL_DUE',
  RECALL_OPEN: 'RECALL_OPEN',
  HYGIENE_OVERDUE: 'HYGIENE_OVERDUE',
  OPEN_ACTIVITY: 'OPEN_ACTIVITY',
  ACCEPTED_QUOTE_FOLLOW_UP: 'ACCEPTED_QUOTE_FOLLOW_UP',
  MISSING_TREATMENT_PLAN: 'MISSING_TREATMENT_PLAN',
  MISSING_EXECUTION_STATUS: 'MISSING_EXECUTION_STATUS',
  MISSING_PLAN_STATUS: 'MISSING_PLAN_STATUS',
  EMPTY_ACCEPTED_PLAN: 'EMPTY_ACCEPTED_PLAN',
  HYGIENE_CONFIGURATION_MISSING: 'HYGIENE_CONFIGURATION_MISSING',
  // POL-AI-005B: a treatment marked eseguita (completed) whose tooth is
  // still unknown — e.g. "segna devitalizzazione di Rossi come eseguita,
  // non ricordo il dente". Derived live from `voci` on every scan, so it
  // clears automatically the moment the tooth is filled in — no separate
  // signal storage/clearing logic needed.
  MISSING_TOOTH_REFERENCE: 'MISSING_TOOTH_REFERENCE',
});

export const SEVERITY = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export function createSignal({
  type,
  taxonomy,
  severity,
  reason,
  source,
  sourceId = null,
  confidence = 1,
  confidencePenalty = 0,
  contactRecommended = false,
  context = null,
}) {
  if (!type || !taxonomy || !reason || !source) {
    throw new Error('Every intelligence signal requires type, taxonomy, reason and source.');
  }
  return Object.freeze({
    type,
    taxonomy,
    severity,
    reason,
    source,
    sourceId,
    confidence,
    confidencePenalty,
    contactRecommended,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

export const patientDisplayName = (patient) => {
  const name = [patient?.nome, patient?.cognome].filter(Boolean).join(' ').trim();
  return name || 'Paziente senza nome';
};

export const rowTenantId = (row) => row?.studio_id ?? row?.studioId ?? null;

export const belongsToTenant = (row, studioId) => (
  !!studioId && !!row && String(rowTenantId(row)) === String(studioId)
);

export const patientKey = (value) => String(value ?? '');
