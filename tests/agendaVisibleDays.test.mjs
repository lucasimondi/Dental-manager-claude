import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisibleWeekDays } from '../src/lib/agendaVisibleDays.js';

const monday = new Date('2026-08-17T12:00:00');

test('visible Agenda days follow the configured hidden weekdays', () => {
  const cases = [
    { hidden: [], expected: [1, 2, 3, 4, 5, 6, 0] },
    { hidden: [0], expected: [1, 2, 3, 4, 5, 6] },
    { hidden: [0, 6], expected: [1, 2, 3, 4, 5] },
    { hidden: [0, 2, 4, 6], expected: [1, 3, 5] },
    { hidden: [0, 2, 3, 4, 5, 6], expected: [1] },
  ];

  for (const { hidden, expected } of cases) {
    assert.deepEqual(getVisibleWeekDays(monday, hidden).map((day) => day.getDay()), expected);
  }
});

test('hiding every weekday fails safe to the complete week', () => {
  assert.equal(getVisibleWeekDays(monday, [0, 1, 2, 3, 4, 5, 6]).length, 7);
});
