/* POL-FIN-001 — deterministic financial READ queries (task §14).
   Same narrow-and-honest philosophy as commandParser.js: a bounded set
   of regex-recognized question shapes answered directly from the
   canonical `computePatientFinancialSummary`/`computeStudioFinancialSummaries`
   selectors, zero Model Gateway calls. Anything that doesn't match one of
   these shapes returns `null` and falls back to the existing ASK/Model
   Gateway path — this is not a general financial NLU. */

import { resolvePatient, PATIENT_RESOLUTION_STATUS } from './planner/patientResolver.js';
import { computePatientFinancialSummary, computeStudioFinancialSummaries } from '../domain/patientFinancialSummary.js';

export const FINANCIAL_QUERY_TYPE = Object.freeze({
  PATIENT_OUTSTANDING: 'PATIENT_OUTSTANDING',
  PATIENT_NEXT_DEADLINE: 'PATIENT_NEXT_DEADLINE',
  PATIENT_COLLECTED: 'PATIENT_COLLECTED',
  DUE_THIS_WEEK: 'DUE_THIS_WEEK',
  OVERDUE_PATIENTS: 'OVERDUE_PATIENTS',
  TO_COLLECT_MONTH_END: 'TO_COLLECT_MONTH_END',
  OUTSTANDING_WITHOUT_PLAN: 'OUTSTANDING_WITHOUT_PLAN',
});

const PATTERN_PATIENT_OUTSTANDING = /\bquanto\s+deve\s+(?:ancora\s+)?pagare\s+(?<patient>.+?)\??\s*$/i;
const PATTERN_PATIENT_NEXT_DEADLINE = /\bqual\s*[eè]\s+la\s+prossima\s+scadenza\s+di\s+(?<patient>.+?)\??\s*$/i;
const PATTERN_PATIENT_COLLECTED = /\bquanto\s+ha\s+(?:gi[aà]\s+)?pagato\s+(?<patient>.+?)\??\s*$/i;
const PATTERN_DUE_THIS_WEEK = /\bchi\s+deve\s+pagare\s+questa\s+settimana\??\s*$/i;
const PATTERN_OVERDUE = /\bchi\s+ha\s+(?:le\s+)?rate\s+scadut[ei]\??\s*$/i;
const PATTERN_TO_COLLECT_MONTH_END = /\bquanto\s+devo\s+incassare\s+entro\s+fine\s+mese\??\s*$/i;
const PATTERN_NO_PLAN = /\bquali\s+pazient[ei]\s+hanno\s+un\s+residuo\s+senza\s+piano\s+di\s+pagamento\??\s*$/i;

/** classifyFinancialQuery(text) -> { type, patientText? } | null */
export function classifyFinancialQuery(text) {
  const value = (text || '').trim();
  if (!value) return null;
  let m = PATTERN_PATIENT_OUTSTANDING.exec(value);
  if (m) return { type: FINANCIAL_QUERY_TYPE.PATIENT_OUTSTANDING, patientText: m.groups.patient.trim() };
  m = PATTERN_PATIENT_NEXT_DEADLINE.exec(value);
  if (m) return { type: FINANCIAL_QUERY_TYPE.PATIENT_NEXT_DEADLINE, patientText: m.groups.patient.trim() };
  m = PATTERN_PATIENT_COLLECTED.exec(value);
  if (m) return { type: FINANCIAL_QUERY_TYPE.PATIENT_COLLECTED, patientText: m.groups.patient.trim() };
  if (PATTERN_DUE_THIS_WEEK.test(value)) return { type: FINANCIAL_QUERY_TYPE.DUE_THIS_WEEK };
  if (PATTERN_OVERDUE.test(value)) return { type: FINANCIAL_QUERY_TYPE.OVERDUE_PATIENTS };
  if (PATTERN_TO_COLLECT_MONTH_END.test(value)) return { type: FINANCIAL_QUERY_TYPE.TO_COLLECT_MONTH_END };
  if (PATTERN_NO_PLAN.test(value)) return { type: FINANCIAL_QUERY_TYPE.OUTSTANDING_WITHOUT_PLAN };
  return null;
}

const fmtEur = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const patientLabel = (p) => `${p.nome} ${p.cognome}`;

const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const endOfMonthIso = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
};

/**
 * answerFinancialQuery(query, context) -> { answer: string } | { needsClarification: string[] }
 * `query` is `classifyFinancialQuery`'s output. `context = { patients,
 * plans, payments, paymentPlans, paymentDeadlines, paymentAllocations,
 * studioId, today }` — same already-tenant-scoped sources every other
 * selector in this codebase already receives.
 */
export function answerFinancialQuery(query, context) {
  const todayIso = context.today;

  if (query.type === FINANCIAL_QUERY_TYPE.PATIENT_OUTSTANDING
    || query.type === FINANCIAL_QUERY_TYPE.PATIENT_NEXT_DEADLINE
    || query.type === FINANCIAL_QUERY_TYPE.PATIENT_COLLECTED) {
    const resolution = resolvePatient(query.patientText, context.patients, { studioId: context.studioId });
    if (resolution.status === PATIENT_RESOLUTION_STATUS.AMBIGUOUS) {
      return { needsClarification: resolution.candidates.map(patientLabel) };
    }
    if (resolution.status !== PATIENT_RESOLUTION_STATUS.RESOLVED) {
      return { answer: `Nessun paziente trovato per "${query.patientText}".` };
    }
    const patient = resolution.candidate;
    const summary = computePatientFinancialSummary(context, patient.id, { today: todayIso });
    if (query.type === FINANCIAL_QUERY_TYPE.PATIENT_OUTSTANDING) {
      return { answer: `${patientLabel(patient)} deve ancora pagare ${fmtEur(summary.totalOutstanding)}.` };
    }
    if (query.type === FINANCIAL_QUERY_TYPE.PATIENT_COLLECTED) {
      return { answer: `${patientLabel(patient)} ha già pagato ${fmtEur(summary.totalCollected)}.` };
    }
    if (!summary.nextDeadline) {
      return { answer: `${patientLabel(patient)} non ha scadenze di pagamento in programma.` };
    }
    return { answer: `La prossima scadenza di ${patientLabel(patient)} è ${fmtEur(summary.nextDeadline.remainingAmount)} il ${summary.nextDeadline.dueDate}.` };
  }

  const summaries = computeStudioFinancialSummaries(context, context.patients, { today: todayIso });

  if (query.type === FINANCIAL_QUERY_TYPE.DUE_THIS_WEEK) {
    const weekEnd = addDaysIso(todayIso, 7);
    const rows = summaries
      .filter(({ summary }) => summary.nextDeadline && summary.nextDeadline.dueDate >= todayIso && summary.nextDeadline.dueDate <= weekEnd)
      .map(({ patient, summary }) => `${patientLabel(patient)}: ${fmtEur(summary.nextDeadline.remainingAmount)} il ${summary.nextDeadline.dueDate}`);
    return { answer: rows.length ? rows.join(' · ') : 'Nessun paziente ha scadenze nei prossimi 7 giorni.' };
  }

  if (query.type === FINANCIAL_QUERY_TYPE.OVERDUE_PATIENTS) {
    const rows = summaries
      .filter(({ summary }) => summary.totalOverdue > 0)
      .map(({ patient, summary }) => `${patientLabel(patient)}: ${fmtEur(summary.totalOverdue)} scaduto`);
    return { answer: rows.length ? rows.join(' · ') : 'Nessun paziente ha rate scadute.' };
  }

  if (query.type === FINANCIAL_QUERY_TYPE.TO_COLLECT_MONTH_END) {
    const monthEnd = endOfMonthIso(todayIso);
    // Sums every OPEN deadline due by month-end across all patients — not
    // just each patient's single "next" deadline, which would under-count
    // a patient with two deadlines both due before month-end.
    let grandTotal = 0;
    for (const d of context.paymentDeadlines || []) {
      if (!d.dueDate || d.dueDate > monthEnd) continue;
      const allocations = (context.paymentAllocations || []).filter((a) => String(a.paymentDeadlineId) === String(d.id));
      const allocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
      grandTotal += Math.max(0, Number(d.amountDue) - allocated);
    }
    return { answer: `Entro fine mese devi incassare ${fmtEur(grandTotal)}.` };
  }

  if (query.type === FINANCIAL_QUERY_TYPE.OUTSTANDING_WITHOUT_PLAN) {
    const rows = summaries
      .filter(({ summary }) => summary.totalUnscheduledOutstanding > 0)
      .map(({ patient, summary }) => `${patientLabel(patient)}: ${fmtEur(summary.totalUnscheduledOutstanding)}`);
    return { answer: rows.length ? rows.join(' · ') : 'Nessun paziente ha un residuo senza piano di pagamento.' };
  }

  return { answer: null };
}
