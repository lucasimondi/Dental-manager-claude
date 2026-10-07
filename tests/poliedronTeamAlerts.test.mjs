import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, alertsToDeliver, isResolved, ALERT_OWNER } from '../src/lib/poliedron/team/alerts.js';
import { ACTIVITY_KIND } from '../src/lib/domain/dataHealthActivities.js';
import { deliverAlerts, answerAlert, closeSolvedAlerts, markThreadRead, unreadIn, threadHistory, emptyTeamState } from '../src/lib/poliedron/team/threads.js';

const today = '2026-10-07';
const patients = [{ id: 1, nome: 'Jenifer', cognome: 'Pancera' }, { id: 2, nome: 'Mario', cognome: 'Rossi' }];
const plans = [{ id: 10, pazienteId: 1, titolo: 'Igiene', voci: [{ eseguita: false }] }];
const appointments = [
  { id: 100, pazienteId: 1, data: '2026-10-06', ora: '10:30', tipo: 'Igiene', stato: 'confermato' },
  { id: 101, pazienteId: 2, data: '2026-10-06', ora: '11:00', stato: 'confermato' }, // no open plan: no question
];
let n = 0;
const newId = () => `m${++n}`;

test('a missed appointment outcome is asked by the Agenda assistant with quick replies', () => {
  const alerts = buildAlerts({ patients, plans, appointments, today });
  const outcome = alerts.find((a) => a.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED);
  assert.equal(outcome.owner, 'agenda');
  assert.equal(outcome.patientName, 'Jenifer Pancera');
  assert.equal(outcome.appointment.id, 100);
  assert.deepEqual(outcome.actions, ['venuto', 'assente', 'nota', 'scheda']);
  assert.match(outcome.text, /Jenifer Pancera aveva un appuntamento martedì 6 ottobre alle 10:30 \(Igiene\)/);
  assert.equal(alerts.filter((a) => a.patientId === 2).length, 0);
});
test('the question keeps coming for a few days, not only the day after', () => {
  const later = buildAlerts({ patients, plans, appointments, today: '2026-10-10' });
  assert.ok(later.some((a) => a.id === 'YESTERDAY_APPOINTMENT_NOT_MARKED:1:2026-10-06'));
  assert.equal(buildAlerts({ patients, plans, appointments, today: '2026-10-20' }).filter((a) => a.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED).length, 0);
});
test('a done Attività about the same patient and issue resolves the alert', () => {
  const alert = { kind: ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED, patientId: 1, since: '2026-10-06' };
  const done = { fatto: true, paziente_id: 1, testo: 'Jenifer: prestazioni non ancora segnate come eseguite', data: '2026-10-07' };
  assert.equal(isResolved(alert, [done]), true);
  assert.equal(isResolved(alert, [{ ...done, data: '2026-09-01' }]), false, 'an older answer does not silence a newer appointment');
  assert.equal(isResolved(alert, [{ ...done, fatto: false }]), false);
  assert.equal(buildAlerts({ patients, plans, appointments, today, todos: [done] }).some((a) => a.patientId === 1 && a.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED), false);
});
test('every alert kind has an owner among the team specialists', () => {
  for (const owner of Object.values(ALERT_OWNER)) assert.ok(['agenda', 'clinical', 'finance', 'documents', 'marketing'].includes(owner));
});
test('delivery: first time, then a daily reminder until answered; answered alerts stop', () => {
  const alerts = buildAlerts({ patients, plans, appointments, today }).filter((a) => a.owner === 'agenda');
  const t0 = Date.parse('2026-10-07T08:00:00Z');
  let state = emptyTeamState();
  state = deliverAlerts(state, alertsToDeliver(alerts, state.alertsSent, t0), new Date(t0).toISOString(), newId);
  const thread = state.threads['assistant:agenda'];
  assert.equal(thread.length, 1);
  assert.equal(thread[0].unread, true);
  assert.equal(unreadIn(thread), 1);
  assert.equal(alertsToDeliver(alerts, state.alertsSent, t0 + 3600000).length, 0, 'not again within the same day');
  const reminders = alertsToDeliver(alerts, state.alertsSent, t0 + 21 * 3600000);
  assert.equal(reminders[0].reminder, true);
  state = deliverAlerts(state, reminders, new Date(t0 + 21 * 3600000).toISOString(), newId);
  assert.match(state.threads['assistant:agenda'][1].content, /^Promemoria — /);
  state = answerAlert(state, alerts[0].id, 'È venuto');
  assert.ok(state.threads['assistant:agenda'].every((m) => m.answered === 'È venuto' && !m.unread));
  assert.equal(alertsToDeliver(alerts, state.alertsSent, t0 + 99 * 3600000).length, 0);
});
test('alerts solved elsewhere are closed; opening a chat marks it read', () => {
  const alerts = buildAlerts({ patients, plans, appointments, today }).filter((a) => a.owner === 'agenda');
  let state = deliverAlerts(emptyTeamState(), alertsToDeliver(alerts, {}), '2026-10-07T08:00:00.000Z', newId);
  state = closeSolvedAlerts(state, []);
  assert.equal(state.threads['assistant:agenda'][0].answered, 'Risolto');
  state = deliverAlerts(emptyTeamState(), alertsToDeliver(alerts, {}), '2026-10-07T08:00:00.000Z', newId);
  state = markThreadRead(state, 'assistant:agenda');
  assert.equal(unreadIn(state.threads['assistant:agenda']), 0);
});
test('model history starts with the user and alternates even after alerts', () => {
  assert.deepEqual(threadHistory([
    { role: 'assistant', content: 'avviso 1' },
    { role: 'assistant', content: 'avviso 2' },
    { role: 'user', content: 'ok' },
    { role: 'user', content: 'e poi?' },
    { role: 'assistant', content: 'risposta' },
  ]), [{ role: 'user', content: 'ok\n\ne poi?' }, { role: 'assistant', content: 'risposta' }]);
});
