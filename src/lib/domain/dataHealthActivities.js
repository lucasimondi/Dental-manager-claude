/* POL-FIN-007 — Product Owner: "anche quando poliedron segna sulle
   attività, deve essere più chiaro, mandarmi notifica in chat, e dirmi
   pazienti che non hanno dati aggiornati, inoltre poliedron deve agire
   anche quando c'è un piano lì, senza una attività eseguita su quel
   piano, così come pazienti che hanno prestazioni in piani che non
   vengono teoricamente eseguite, e dobbiamo metterlo chiaro in attività
   ma chiaro e con la cliccabili".

   Pure, I/O-free selector: given the same patients/plans/appointments
   Dashboard.jsx already holds, produces ONE entry PER PATIENT per issue
   (never bundled into a vague "N pazienti…" line), each carrying the
   patient id so the caller can render it as a clickable Attività row and
   post a clear chat notification — same "one signal, one clickable target"
   shape the general Piani/SchedaPaz drill-down already established.

   Reuses the existing Poliedron treatment-plan scanner (already reviewed,
   already tested) for two of the four checks rather than reinventing
   "what counts as a data-quality problem" a second time; the yesterday's-
   appointment check is Dashboard's own pre-existing rule, ported here
   unchanged so it gets the same per-patient/clickable/chat treatment. */

import { scanTreatmentPlans } from '../poliedron/intelligence/treatmentPlanScanner.js';
import { SIGNAL_TYPE } from '../poliedron/intelligence/model.js';

export const ACTIVITY_KIND = Object.freeze({
  YESTERDAY_APPOINTMENT_NOT_MARKED: 'YESTERDAY_APPOINTMENT_NOT_MARKED',
  PLAN_AWAITING_ACCEPTANCE_DECISION: SIGNAL_TYPE.PLAN_AWAITING_ACCEPTANCE_DECISION,
  PLAN_NEVER_STARTED: SIGNAL_TYPE.PLAN_NEVER_STARTED,
  STALLED_TREATMENT: 'STALLED_TREATMENT',
});

const SCANNER_SIGNAL_TYPES = new Set([
  SIGNAL_TYPE.PLAN_AWAITING_ACCEPTANCE_DECISION,
  SIGNAL_TYPE.PLAN_NEVER_STARTED,
  SIGNAL_TYPE.UNFINISHED_TREATMENT,
]);

// A fixed, kind-specific phrase guaranteed to be a literal substring of
// that kind's own message, used to dedup ("does an open Attività about
// THIS patient and THIS issue already exist?") without depending on
// anything that can change later (a plan's title, an execution count).
// Deliberately coarse: two different plans on the same patient hitting
// the same kind share one Attività entry until it's resolved — a known,
// disclosed simplification, not a bug (see handoffs.md).
const DEDUP_MARKER_BY_KIND = Object.freeze({
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'prestazioni non ancora segnate come eseguite',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'accettato dal paziente',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'nessuna prestazione eseguita',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'sembra ferma da tempo',
});

export const patientDisplayName = (patient) => {
  const name = [patient?.nome, patient?.cognome].filter(Boolean).join(' ').trim();
  return name || (patient?.id != null ? `Paziente #${patient.id}` : 'Paziente sconosciuto');
};

const dayBefore = (isoDate) => new Date(new Date(`${isoDate}T12:00:00`).getTime() - 86400000).toISOString().slice(0, 10);

/** Product Owner's original rule, unchanged: a confirmed appointment
 *  happened yesterday and the patient still has un-executed voci — likely
 *  just forgotten after the visit, not a real ongoing gap the way the
 *  other three checks are. Kept separate from the scanner (a different,
 *  time-boxed rule, not a general data-quality signal). */
const buildYesterdayAppointmentEntries = ({ patients, plans, appointments, today, formatDate }) => {
  const yesterday = dayBefore(today);
  const confirmedYesterday = (appointments || []).filter((a) => a?.data === yesterday && a?.stato === 'confermato');
  const patientIds = [...new Set(confirmedYesterday.map((a) => a.pazienteId).filter((id) => id != null))];
  const entries = [];
  for (const patientId of patientIds) {
    const hasUnexecuted = (plans || []).some((plan) => plan?.pazienteId === patientId && (plan.voci || []).some((v) => !v.eseguita));
    if (!hasUnexecuted) continue;
    const patient = (patients || []).find((p) => p.id === patientId);
    const name = patientDisplayName(patient);
    entries.push({
      pazienteId: patientId,
      patientName: name,
      planId: null,
      planTitle: null,
      kind: ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED,
      message: `${name}: appuntamento del ${formatDate(yesterday)} — prestazioni non ancora segnate come eseguite in Piani di Cura.`,
      dedupMarker: DEDUP_MARKER_BY_KIND[ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED],
      dedupKey: `${ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED}:${patientId}:${yesterday}`,
    });
  }
  return entries;
};

/** The three checks that ride the shared Poliedron treatment-plan scanner:
 *  accettazione mancante, piano mai iniziato, trattamento in stallo senza
 *  un prossimo appuntamento. One entry per (patient, plan). */
const buildScannerEntries = ({ patients, plans, appointments, today }) => {
  const appointmentsByPatient = new Map();
  for (const appointment of appointments || []) {
    const patientId = appointment?.pazienteId;
    if (patientId == null) continue;
    const list = appointmentsByPatient.get(patientId) || [];
    list.push(appointment);
    appointmentsByPatient.set(patientId, list);
  }
  const hasFutureAppointment = (patientId) => (appointmentsByPatient.get(patientId) || []).some((a) => String(a.data || '') > today);

  const entries = [];
  for (const patient of patients || []) {
    const patientPlans = (plans || []).filter((plan) => plan?.pazienteId === patient.id);
    if (!patientPlans.length) continue;
    const signals = scanTreatmentPlans({
      plans: patientPlans,
      hasFuture: hasFutureAppointment(patient.id),
      today,
      canReadClinical: true,
    });
    const name = patientDisplayName(patient);
    for (const signal of signals) {
      if (!SCANNER_SIGNAL_TYPES.has(signal.type)) continue;
      // UNFINISHED_TREATMENT means "stalled enough to act on" for Attività
      // purposes only when the scanner also couldn't find a future
      // appointment to fix it on its own — otherwise it's just a normal
      // in-progress plan with a visit already booked.
      if (signal.type === SIGNAL_TYPE.UNFINISHED_TREATMENT && !signal.contactRecommended) continue;
      const kind = signal.type === SIGNAL_TYPE.UNFINISHED_TREATMENT ? ACTIVITY_KIND.STALLED_TREATMENT : signal.type;
      const planId = signal.sourceId ?? null;
      const plan = planId != null ? patientPlans.find((candidate) => String(candidate.id) === String(planId)) : null;
      const planTitle = signal.context?.planTitle || plan?.titolo || 'senza titolo';
      // Composed here (not the scanner's own `signal.reason` verbatim) so
      // each kind is guaranteed to contain its DEDUP_MARKER_BY_KIND phrase
      // exactly, independent of mutable details like a plan's title.
      const message = kind === ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION
        ? `${name}: il piano "${planTitle}" ha prestazioni eseguite ma non risulta accettato dal paziente né rifiutato — confermalo con Accetta/Non accetta in Piani di Cura.`
        : kind === ACTIVITY_KIND.PLAN_NEVER_STARTED
          ? `${name}: il piano "${planTitle}" è aperto da ${signal.context?.ageDays ?? '?'} giorni ma non ha ancora nessuna prestazione eseguita.`
          : `${name}: il piano "${planTitle}" sembra ferma da tempo — restano prestazioni non eseguite e non c'è un prossimo appuntamento in agenda.`;
      entries.push({
        pazienteId: patient.id,
        patientName: name,
        planId,
        planTitle: signal.context?.planTitle || plan?.titolo || null,
        kind,
        message,
        dedupMarker: DEDUP_MARKER_BY_KIND[kind],
        dedupKey: `${kind}:${patient.id}:${planId ?? 'none'}`,
      });
    }
  }
  return entries;
};

/** Every Attività-worthy data-health entry, one per patient per issue,
 *  each clickable (pazienteId) and ready to become both a todo row and a
 *  chat notification line. `formatDate` defaults to passing the ISO date
 *  through unchanged — pass `fmtD` from lib/utils for the real UI. */
export function buildDataHealthActivities({ patients = [], plans = [], appointments = [], today, formatDate = (d) => d }) {
  if (!today) return [];
  return [
    ...buildYesterdayAppointmentEntries({ patients, plans, appointments, today, formatDate }),
    ...buildScannerEntries({ patients, plans, appointments, today }),
  ];
}
