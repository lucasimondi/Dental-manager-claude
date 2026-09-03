import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDataHealthActivities, ACTIVITY_KIND, patientDisplayName } from '../src/lib/domain/dataHealthActivities.js';

const TODAY = '2026-09-02';
const patient = (id, overrides = {}) => ({ id, nome: 'Mario', cognome: `Rossi${id}`, ...overrides });

test('patientDisplayName falls back to a stable placeholder, never a blank name', () => {
  assert.equal(patientDisplayName({ nome: 'Anna', cognome: 'Bianchi' }), 'Anna Bianchi');
  assert.equal(patientDisplayName({ id: 7 }), 'Paziente #7');
});

test('a confirmed appointment yesterday with unexecuted voci produces one clearly-named, clickable entry', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: false }] }],
    appointments: [{ pazienteId: 'p1', data: '2026-09-01', stato: 'confermato' }],
    today: TODAY,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED);
  assert.ok(entry);
  assert.equal(entry.pazienteId, 'p1');
  assert.match(entry.message, /^Mario Rossip1:/);
  assert.match(entry.message, /2026-09-01/);
});

test('no yesterday entry when everything for that appointment is already marked eseguita', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true }] }],
    appointments: [{ pazienteId: 'p1', data: '2026-09-01', stato: 'confermato' }],
    today: TODAY,
  });
  assert.ok(!entries.some((e) => e.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED));
});

test('two different patients seen yesterday each get their OWN named entry, never bundled', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1'), patient('p2', { nome: 'Anna', cognome: 'Bianchi' })],
    plans: [
      { id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: false }] },
      { id: 'pl2', pazienteId: 'p2', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Otturazione', eseguita: false }] },
    ],
    appointments: [
      { pazienteId: 'p1', data: '2026-09-01', stato: 'confermato' },
      { pazienteId: 'p2', data: '2026-09-01', stato: 'confermato' },
    ],
    today: TODAY,
  });
  const yesterdayEntries = entries.filter((e) => e.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED);
  assert.equal(yesterdayEntries.length, 2);
  assert.deepEqual(new Set(yesterdayEntries.map((e) => e.pazienteId)), new Set(['p1', 'p2']));
  assert.ok(yesterdayEntries.every((e) => e.message.includes(e.patientName)));
});

test('a plan with executed work but no accettato/rifiutato decision surfaces as a clickable, patient-named Attività entry', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'attivo', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }] }],
    appointments: [],
    today: TODAY,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION);
  assert.ok(entry);
  assert.equal(entry.pazienteId, 'p1');
  assert.equal(entry.planId, 'pl1');
  assert.match(entry.message, /accettato dal paziente/);
});

test('a plan open for weeks with nothing executed surfaces as never-started, one entry, clickable', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'attivo', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: false }] }],
    appointments: [],
    today: TODAY,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.PLAN_NEVER_STARTED);
  assert.ok(entry);
  assert.equal(entry.pazienteId, 'p1');
  assert.equal(entry.planId, 'pl1');
});

test('an accepted plan with remaining prestazioni and no future appointment surfaces as stalled', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{
      id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01',
      voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }, { prestazione: 'Otturazione', eseguita: false }],
    }],
    appointments: [],
    today: TODAY,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.STALLED_TREATMENT);
  assert.ok(entry);
  assert.equal(entry.pazienteId, 'p1');
});

test('an accepted plan with remaining prestazioni but a future appointment already booked is NOT stalled', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{
      id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01',
      voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }, { prestazione: 'Otturazione', eseguita: false }],
    }],
    appointments: [{ pazienteId: 'p1', data: '2026-09-10', stato: 'confermato' }],
    today: TODAY,
  });
  assert.ok(!entries.some((e) => e.kind === ACTIVITY_KIND.STALLED_TREATMENT));
});

test('every entry carries a dedup key stable across repeated calls with the same input', () => {
  const build = () => buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'attivo', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }] }],
    appointments: [],
    today: TODAY,
  });
  const first = build().map((e) => e.dedupKey);
  const second = build().map((e) => e.dedupKey);
  assert.deepEqual(first, second);
});

test('patients with no plans at all produce no entries — nothing to report', () => {
  const entries = buildDataHealthActivities({ patients: [patient('p1')], plans: [], appointments: [], today: TODAY });
  assert.deepEqual(entries, []);
});

test('every entry\'s dedupMarker is a real, literal substring of its own message — safe to ilike-match', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [
      { id: 'pl1', pazienteId: 'p1', stato: 'attivo', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }] },
      { id: 'pl2', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }, { prestazione: 'Otturazione', eseguita: false }] },
    ],
    appointments: [{ pazienteId: 'p1', data: '2026-09-01', stato: 'confermato' }],
    today: TODAY,
  });
  assert.ok(entries.length >= 3);
  for (const entry of entries) {
    assert.ok(entry.dedupMarker, `missing dedupMarker for ${entry.kind}`);
    assert.ok(entry.message.includes(entry.dedupMarker), `dedupMarker not found in message for ${entry.kind}`);
  }
});

// POL-UI-020: Product Owner — "poliedron dovrà segnalare le anamnesi
// mancanti". Scoped like the other scanner-based checks (only patients
// with at least one plan) so shipping the new anamnesi fields doesn't
// instantly flood Attività with every patient who ever existed.
test('a patient with a plan but no anamnesi compilata surfaces as a clickable, patient-named Attività entry', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1', { anamnesiCompilataIl: null })],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }] }],
    appointments: [],
    today: TODAY,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.ANAMNESI_MANCANTE);
  assert.ok(entry);
  assert.equal(entry.pazienteId, 'p1');
  assert.match(entry.message, /nessuna anamnesi risulta compilata/);
});

test('a patient with anamnesi already compilata never surfaces ANAMNESI_MANCANTE', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1', { anamnesiCompilataIl: '2026-08-20T10:00:00.000Z' })],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: true, dente: '11' }] }],
    appointments: [],
    today: TODAY,
  });
  assert.ok(!entries.some((e) => e.kind === ACTIVITY_KIND.ANAMNESI_MANCANTE));
});

test('a patient with no plans at all never surfaces ANAMNESI_MANCANTE, even without anamnesi — avoids flooding on rollout', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1', { anamnesiCompilataIl: null })],
    plans: [],
    appointments: [],
    today: TODAY,
  });
  assert.ok(!entries.some((e) => e.kind === ACTIVITY_KIND.ANAMNESI_MANCANTE));
});

test('formatDate is used for the yesterday-appointment message when provided', () => {
  const entries = buildDataHealthActivities({
    patients: [patient('p1')],
    plans: [{ id: 'pl1', pazienteId: 'p1', stato: 'accettato', data: '2026-08-01', voci: [{ prestazione: 'Igiene', eseguita: false }] }],
    appointments: [{ pazienteId: 'p1', data: '2026-09-01', stato: 'confermato' }],
    today: TODAY,
    formatDate: (iso) => `[${iso}]`,
  });
  const entry = entries.find((e) => e.kind === ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED);
  assert.match(entry.message, /\[2026-09-01\]/);
});
