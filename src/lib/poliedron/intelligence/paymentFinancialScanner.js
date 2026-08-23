/* POL-FIN-001 §19 — proactive financial intelligence.
   Same shape as treatmentPlanScanner.js/recallScanner.js: one pure
   function returning createSignal() rows, called once per patient inside
   patientOpportunityScanner.js's existing loop. Every number here comes
   from `computePatientFinancialSummary` — the SAME canonical selector
   every write path and every future UI consumer uses — never a second,
   independently-computed figure. No noisy/speculative alerts: a signal
   only fires when there is real evidence (an actual overdue amount, an
   actual upcoming deadline, an actual unscheduled outstanding balance),
   never a guess. */

import { createSignal, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE } from './model.js';
import { computePatientFinancialSummary } from '../../domain/patientFinancialSummary.js';

const DUE_SOON_WINDOW_DAYS = 7;

const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function scanPaymentFinancials({ patient, sources, today, canReadFinancial }) {
  if (!canReadFinancial) return [];
  const summary = computePatientFinancialSummary(sources, patient.id, { today });
  const signals = [];

  if (summary.totalOverdue > 0 && summary.nextDeadline) {
    signals.push(createSignal({
      type: SIGNAL_TYPE.PAYMENT_OVERDUE,
      taxonomy: SIGNAL_TAXONOMY.ADMINISTRATIVE,
      severity: SEVERITY.HIGH,
      reason: `${summary.totalOverdue} € scaduti dal ${summary.nextDeadline.dueDate}.`,
      source: 'payment_deadline',
      sourceId: summary.nextDeadline.id,
      confidence: 1,
      contactRecommended: true,
      context: { amount: summary.totalOverdue, dueDate: summary.nextDeadline.dueDate },
    }));
  } else if (summary.nextDeadline && summary.nextDeadline.dueDate <= addDaysIso(today, DUE_SOON_WINDOW_DAYS)) {
    signals.push(createSignal({
      type: SIGNAL_TYPE.PAYMENT_DUE_SOON,
      taxonomy: SIGNAL_TAXONOMY.ADMINISTRATIVE,
      severity: SEVERITY.MEDIUM,
      reason: `${summary.nextDeadline.remainingAmount} € in scadenza il ${summary.nextDeadline.dueDate}.`,
      source: 'payment_deadline',
      sourceId: summary.nextDeadline.id,
      confidence: 1,
      context: { amount: summary.nextDeadline.remainingAmount, dueDate: summary.nextDeadline.dueDate },
    }));
  }

  if (summary.totalUnscheduledOutstanding > 0) {
    signals.push(createSignal({
      type: SIGNAL_TYPE.OUTSTANDING_WITHOUT_PAYMENT_PLAN,
      taxonomy: SIGNAL_TAXONOMY.ADMINISTRATIVE,
      severity: SEVERITY.LOW,
      reason: `${summary.totalUnscheduledOutstanding} € di residuo senza un piano di pagamento concordato.`,
      source: 'patient_financial',
      sourceId: patient.id,
      confidence: 1,
      context: { amount: summary.totalUnscheduledOutstanding },
    }));
  }

  return signals;
}
