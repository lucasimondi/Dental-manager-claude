import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agendaStatusOptions,
  combineLocalDateTime,
  createDemoAgendaEvents,
  toLocalDateValue,
  toLocalTimeValue,
} from '../src/components/AgendaLab/demoAgendaData.js';

test('Agenda Lab demo data covers required days, durations, statuses, and overlaps', () => {
  const base = new Date(2026, 7, 22, 12, 0, 0);
  const events = createDemoAgendaEvents(base);
  const dayOffsets = new Set(events.map((event) => {
    const date = new Date(event.start);
    return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(2026, 7, 22)) / 86400000);
  }));
  const durations = new Set(events.map((event) => (new Date(event.end) - new Date(event.start)) / 60000));
  const statuses = new Set(events.map((event) => event.extendedProps.status));
  const starts = events.map((event) => new Date(event.start).getTime());

  assert.deepEqual([...dayOffsets].sort(), [-1, 0, 1]);
  assert.ok([15, 30, 60, 120].every((duration) => durations.has(duration)));
  assert.ok(agendaStatusOptions.every(({ value }) => statuses.has(value)));
  assert.ok(new Set(starts).size < starts.length, 'expected at least two events with the same start');
  assert.ok(events.every((event) => event.extendedProps.patientName.startsWith('DEMO ·')));
});

test('Agenda Lab local form date helpers round-trip without changing wall time', () => {
  const iso = combineLocalDateTime('2026-08-22', '09:15');
  assert.equal(toLocalDateValue(iso), '2026-08-22');
  assert.equal(toLocalTimeValue(iso), '09:15');
});

test('Agenda Lab is mounted before App and cannot trigger App Supabase loading', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'));
  assert.match(source, /pathAgendaLab/);
  assert.match(source, /if \(pathAgendaLab\) elementoRadice = <AgendaLab \/>/);
  assert.match(source, /const App = lazy\(\(\) => import\('\.\/App\.jsx'\)\)/);
  assert.doesNotMatch(source, /^import App from/m);
});

test('Agenda Lab enables local interaction features without importing Supabase', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/components/AgendaLab/AgendaLab.jsx', import.meta.url), 'utf8'));
  assert.match(source, /initialView="timeGridDay"/);
  assert.match(source, /\r?\n\s+editable\r?\n/);
  assert.match(source, /\r?\n\s+selectable\r?\n/);
  assert.match(source, /eventDrop=/);
  assert.match(source, /eventResize=/);
  assert.match(source, /eventLongPressDelay=\{350\}/);
  assert.doesNotMatch(source, /supabase|DB\./i);
});
