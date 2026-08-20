import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFreeSlots } from '../src/lib/agendaSlots.js';

const settings = { oraInizio: 9, oraFine: 12, slotMin: 30 };

test('free slots derive strictly from real appointments and settings, never invented', () => {
  const appointments = [{ data: '2026-08-25', ora: '09:30', durata: 30, operatoreId: null, stato: 'confermato' }];
  const slots = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: null, appointments, impegni: [], agendaSettings: settings });
  assert.deepEqual(slots.map((s) => s.ora), ['09:00', '10:00', '10:30', '11:00', '11:30']);
});

test('a longer appointment blocks every overlapping candidate start', () => {
  const appointments = [{ data: '2026-08-25', ora: '09:00', durata: 90, operatoreId: null, stato: 'confermato' }];
  const slots = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: null, appointments, impegni: [], agendaSettings: settings });
  assert.deepEqual(slots.map((s) => s.ora), ['10:30', '11:00', '11:30']);
});

test('cancelled appointments do not block a slot', () => {
  const appointments = [{ data: '2026-08-25', ora: '09:00', durata: 30, operatoreId: null, stato: 'annullato' }];
  const slots = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: null, appointments, impegni: [], agendaSettings: settings });
  assert.ok(slots.some((s) => s.ora === '09:00'));
});

test('operatore filter only considers that operatore\'s own appointments', () => {
  const appointments = [
    { data: '2026-08-25', ora: '09:00', durata: 30, operatoreId: 1, stato: 'confermato' },
    { data: '2026-08-25', ora: '09:30', durata: 30, operatoreId: 2, stato: 'confermato' },
  ];
  const slotsOp1 = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: '1', appointments, impegni: [], agendaSettings: settings });
  assert.ok(!slotsOp1.some((s) => s.ora === '09:00'));
  assert.ok(slotsOp1.some((s) => s.ora === '09:30'));
  const slotsOp2 = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: '2', appointments, impegni: [], agendaSettings: settings });
  assert.ok(slotsOp2.some((s) => s.ora === '09:00'));
  assert.ok(!slotsOp2.some((s) => s.ora === '09:30'));
});

test('a full-day impegno blocks the entire day, a partial one only blocks its window', () => {
  const fullDay = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: null, appointments: [], impegni: [{ dataInizio: '2026-08-25', dataFine: '2026-08-25', tuttoIlGiorno: true }], agendaSettings: settings });
  assert.equal(fullDay.length, 0);
  const partial = computeFreeSlots({ data: '2026-08-25', durata: 30, operatoreId: null, appointments: [], impegni: [{ dataInizio: '2026-08-25', dataFine: '2026-08-25', tuttoIlGiorno: false, oraInizio: '09:00', oraFine: '10:00' }], agendaSettings: settings });
  assert.ok(!partial.some((s) => s.ora === '09:00' || s.ora === '09:30'));
  assert.ok(partial.some((s) => s.ora === '10:00'));
});

test('a slot whose duration would run past the agenda closing time is never offered', () => {
  const slots = computeFreeSlots({ data: '2026-08-25', durata: 45, operatoreId: null, appointments: [], impegni: [], agendaSettings: settings });
  assert.ok(!slots.some((s) => s.ora === '11:30'));
});
