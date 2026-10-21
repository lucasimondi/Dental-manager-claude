import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePatientAgendaSlot, persistPatientAgendaBooking } from '../src/lib/patientAgendaBooking.js';
const appointment = { pazienteId: 7, data: '2099-01-05', ora: '10:00', durata: 60, tipo: ' Controllo ', operatoreId: null, poltronaId: null };
const opts = { appointment, appointments: [], impegni: [], agendaSettings: { oraInizio: 8, oraFine: 20, slotMin: 30 }, today: '2099-01-01' };
test('free slot preserves the patient and normalizes the manual procedure', () => {
  const row = validatePatientAgendaSlot(opts);
  assert.equal(row.pazienteId, 7); assert.equal(row.tipo, 'Controllo'); assert.equal(row.durata, 60);
});
test('rejects partial overlap even when appointment is hidden from the calendar', () => {
  assert.throws(() => validatePatientAgendaSlot({ ...opts, appointments: [{ data: appointment.data, ora: '10:30', durata: 30, visibileStudio: false }] }), /Spazio non disponibile/);
});
test('rejects full-day and timed personal blocks', () => {
  for (const block of [{ tuttoIlGiorno: true }, { tuttoIlGiorno: false, oraInizio: '10:30', oraFine: '11:00' }]) assert.throws(() => validatePatientAgendaSlot({ ...opts, impegni: [{ ...block, dataInizio: appointment.data, dataFine: appointment.data }] }), /Spazio non disponibile/);
});
test('rejects invalid duration, missing patient/procedure and past date', () => {
  for (const patch of [{ durata: '' }, { durata: 'abc' }, { durata: -1 }, { durata: 15 }, { durata: 30.5 }, { durata: 1500 }, { pazienteId: null }, { tipo: ' ' }, { data: '2020-01-01' }]) assert.throws(() => validatePatientAgendaSlot({ ...opts, appointment: { ...appointment, ...patch } }));
});
test('protects selected chair across operators, allows a cancelled booking', () => {
  const row = { data: appointment.data, ora: '10:30', durata: 30, operatoreId: 2, poltronaId: 3 };
  const selected = { ...appointment, operatoreId: 1, poltronaId: 3 };
  assert.throws(() => validatePatientAgendaSlot({ ...opts, appointment: selected, appointments: [row] }), /postazione/);
  assert.ok(validatePatientAgendaSlot({ ...opts, appointment: selected, appointments: [{ ...row, stato: 'annullato' }] }));
});
test('re-reads authoritative rows before insert and returns only confirmed saved data', async () => {
  const calls = [], saved = { ...appointment, id: 99 };
  const db = { getAll: async (key, options) => { calls.push(key); assert.equal(options.throwOnError, true); return []; }, insert: async (key, row) => { calls.push('insert'); assert.equal(key, 'dm_a'); assert.equal(row.tipo, 'Controllo'); return saved; } };
  assert.equal(await persistPatientAgendaBooking({ ...opts, db }), saved);
  assert.deepEqual(calls, ['dm_a', 'dm_ip', 'insert']);
});
test('newly occupied slot prevents insert', async () => {
  let writes = 0;
  const db = { getAll: async key => key === 'dm_a' ? [{ ...appointment, id: 33 }] : [], insert: async () => { writes++; } };
  await assert.rejects(persistPatientAgendaBooking({ ...opts, db }), /Spazio non disponibile/); assert.equal(writes, 0);
});
test('read and write errors propagate instead of reporting success', async () => {
  let writes = 0;
  await assert.rejects(persistPatientAgendaBooking({ ...opts, db: { getAll: async () => { throw Error('offline'); }, insert: async () => writes++ } }), /offline/);
  assert.equal(writes, 0);
  await assert.rejects(persistPatientAgendaBooking({ ...opts, db: { getAll: async () => [], insert: async () => { throw Error('write denied'); } } }), /write denied/);
});
