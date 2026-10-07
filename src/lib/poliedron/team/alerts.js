// POL-AI-TEAM-003: proactive alerts, each sent by the assistant who owns the
// matter, in that assistant's chat. Pure and deterministic (no model calls):
// built from the same data-health findings the studio app already computes,
// plus a short window of past appointments without an outcome.
import { buildDataHealthActivities, ACTIVITY_KIND } from '../../domain/dataHealthActivities.js';

/** Which assistant sends which kind of alert. */
export const ALERT_OWNER = Object.freeze({
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'agenda',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'clinical',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'clinical',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'finance',
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'documents',
});

/** Quick replies offered with each kind of alert (in order). */
export const ALERT_ACTIONS = Object.freeze({
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: ['venuto', 'assente', 'nota', 'scheda'],
  [ACTIVITY_KIND.STALLED_TREATMENT]: ['richiamo', 'gestito', 'nota', 'scheda'],
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: ['richiamo', 'gestito', 'nota', 'scheda'],
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: ['scheda', 'gestito', 'nota'],
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: ['scheda', 'gestito', 'nota'],
});

export const ACTION_LABEL = Object.freeze({
  venuto: 'È venuto',
  assente: 'Non è venuto',
  nota: 'Aggiungi nota',
  scheda: 'Apri scheda',
  richiamo: 'Crea richiamo',
  gestito: 'Già gestito',
});

// Same marker phrases the Attività rows carry (dataHealthActivities.js), so
// an answer here and a "fatto" in Attività resolve the same thing.
const MARKER = Object.freeze({
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'prestazioni non ancora segnate come eseguite',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'accettato dal paziente',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'nessuna prestazione eseguita',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'sembra ferma da tempo',
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'nessuna anamnesi risulta compilata',
});
export const alertMarker = (kind) => MARKER[kind] || kind;

const firstName = (name = '') => name.split(' ')[0] || name;
const longDate = (iso) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  .format(new Date(`${iso}T12:00:00Z`));
const dayBefore = (iso) => new Date(new Date(`${iso}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);

/** Proposal text, written as the assistant talking to the studio. */
export function alertText(kind, { patientName, planTitle, appointment, yesterday }) {
  const who = patientName;
  if (kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED) {
    const when = appointment ? `${longDate(appointment.data)}${appointment.ora ? ` alle ${String(appointment.ora).slice(0, 5)}` : ''}` : longDate(yesterday);
    const what = appointment?.tipo ? ` (${appointment.tipo})` : '';
    return `${who} aveva un appuntamento ${when}${what}, ma non risulta segnato nulla. È venuto/a? Se sì, ricordati di segnare le prestazioni eseguite.`;
  }
  if (kind === ACTIVITY_KIND.STALLED_TREATMENT) {
    return `Il piano "${planTitle || 'senza titolo'}" di ${who} sembra fermo: restano prestazioni da fare e non c'è un prossimo appuntamento. Vuoi che crei un richiamo per ricontattare ${firstName(who)}?`;
  }
  if (kind === ACTIVITY_KIND.PLAN_NEVER_STARTED) {
    return `Il piano "${planTitle || 'senza titolo'}" di ${who} è aperto ma non è ancora iniziato. Lo ricontattiamo con un richiamo?`;
  }
  if (kind === ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION) {
    return `Il piano "${planTitle || 'senza titolo'}" di ${who} ha prestazioni già eseguite ma non risulta né accettato né rifiutato. Apri la scheda per confermarlo con Accetta/Non accetta.`;
  }
  if (kind === ACTIVITY_KIND.ANAMNESI_MANCANTE) {
    return `${who} è in cura ma non ha ancora un'anamnesi compilata. Apri la scheda per compilarla.`;
  }
  return `${who}: c'è qualcosa da controllare.`;
}

/**
 * An alert is resolved by an Attività row about the same patient carrying
 * the kind's marker and already done ("fatto"). For a missed appointment
 * only rows dated on/after that appointment count, so last month's answer
 * does not silence this week's appointment.
 */
export function isResolved(alert, todos = []) {
  return todos.some((t) => t?.fatto
    && String(t.paziente_id ?? t.pazienteId ?? '') === String(alert.patientId)
    && String(t.testo || '').includes(alertMarker(alert.kind))
    && (!alert.since || String(t.data || '') >= alert.since));
}

/**
 * Alerts to deliver now: one per patient per issue, with its owner, text,
 * quick replies and the appointment involved (for outcome questions).
 */
export function buildAlerts({ patients = [], plans = [], appointments = [], todos = [], today, windowDays = 7 }) {
  if (!today) return [];
  const yesterday = dayBefore(today);
  const alerts = [];
  const push = (alert, planTitle) => {
    if (isResolved(alert, todos)) return;
    alerts.push({ ...alert, text: alertText(alert.kind, { patientName: alert.patientName, planTitle, appointment: alert.appointment, yesterday }) });
  };
  // Appointment outcomes: confirmed appointments of the last days (not only
  // yesterday) whose patient still has un-executed treatments, so the
  // question keeps coming until it is answered.
  let from = today;
  for (let i = 0; i < windowDays; i += 1) from = dayBefore(from);
  const hasUnexecuted = (patientId) => (plans || []).some((plan) => plan?.pazienteId === patientId && (plan.voci || []).some((v) => !v.eseguita));
  const seen = new Set();
  const past = (appointments || [])
    .filter((a) => a?.stato === 'confermato' && a.pazienteId != null && a.data >= from && a.data < today)
    .sort((x, y) => `${y.data}${y.ora || ''}`.localeCompare(`${x.data}${x.ora || ''}`));
  for (const appointment of past) {
    const key = `${appointment.pazienteId}:${appointment.data}`;
    if (seen.has(key) || !hasUnexecuted(appointment.pazienteId)) continue;
    seen.add(key);
    const patient = (patients || []).find((p) => p.id === appointment.pazienteId);
    if (!patient) continue;
    const patientName = [patient.nome, patient.cognome].filter(Boolean).join(' ').trim() || `Paziente #${patient.id}`;
    push({
      id: `${ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED}:${appointment.pazienteId}:${appointment.data}`,
      kind: ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED,
      owner: ALERT_OWNER[ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED],
      patientId: appointment.pazienteId,
      patientName,
      planId: null,
      appointment: { id: appointment.id, data: appointment.data, ora: appointment.ora, tipo: appointment.tipo },
      since: appointment.data,
      actions: ALERT_ACTIONS[ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED],
    });
  }
  for (const f of buildDataHealthActivities({ patients, plans, appointments, today })) {
    if (f.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED) continue; // handled above
    const owner = ALERT_OWNER[f.kind];
    if (!owner) continue;
    push({
      id: f.dedupKey,
      kind: f.kind,
      owner,
      patientId: f.pazienteId,
      patientName: f.patientName,
      planId: f.planId,
      appointment: null,
      since: null,
      actions: ALERT_ACTIONS[f.kind] || ['scheda', 'gestito'],
    }, f.planTitle);
  }
  return alerts;
}

const REMIND_AFTER_MS = 20 * 60 * 60 * 1000;

/**
 * Messages to append to the assistants' chats: the first time an alert is
 * seen, and again (as a reminder) every ~day while it is still unanswered.
 * `sent` is { [alertId]: { at, count, answered } } kept with the team state.
 */
export function alertsToDeliver(alerts, sent = {}, now = Date.now()) {
  const out = [];
  for (const alert of alerts) {
    const record = sent[alert.id];
    if (record?.answered) continue;
    if (record && now - Date.parse(record.at) < REMIND_AFTER_MS) continue;
    out.push({ alert, reminder: Boolean(record) });
  }
  return out;
}
