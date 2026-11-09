// PO 2026-11-09: opzione «Nascondi domenica» nella vista Settimana, ricordata sul dispositivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leggiDomenicaNascosta, salvaDomenicaNascosta, applicaDomenica } from '../shared/agenda/domenica.js';
import { keepOccupiedWeekends } from '../shared/agenda/visibility.js';

const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('la scelta è ricordata sul dispositivo; senza scelta resta null', () => {
  const s = memoria();
  assert.equal(leggiDomenicaNascosta(s), null);
  salvaDomenicaNascosta(true, s); assert.equal(leggiDomenicaNascosta(s), true);
  salvaDomenicaNascosta(false, s); assert.equal(leggiDomenicaNascosta(s), false);
  assert.equal(leggiDomenicaNascosta({ getItem: () => { throw new Error('bloccato'); } }), null);
});

test('applica la scelta senza toccare gli altri giorni nascosti', () => {
  assert.deepEqual(applicaDomenica([], true), [0]);
  assert.deepEqual(applicaDomenica([6], true), [6, 0]);
  assert.deepEqual(applicaDomenica([0, 3], false), [3]);
  assert.deepEqual(applicaDomenica([0], null), [0]);
});

test('una domenica con impegni ricompare anche se nascosta', () => {
  const lunedi = new Date('2026-11-09T12:00');
  assert.deepEqual(keepOccupiedWeekends(lunedi, applicaDomenica([], true), [], []), [0]);
  assert.deepEqual(keepOccupiedWeekends(lunedi, applicaDomenica([], true), [{ data: '2026-11-15', stato: 'confermato' }], []), []);
});

test('Studio e Personal offrono «Nascondi domenica» nel menu vista', () => {
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  assert.equal((studio.match(/sundayHidden=\{domenicaNascosta\} onToggleSunday=\{cambiaDomenica\}/g) || []).length, 4);
  assert.match(personal, /sundayHidden=\{domenicaNascosta\} onToggleSunday=\{cambiaDomenica\}/);
  assert.match(readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8'), /sundayHidden \? 'Mostra domenica' : 'Nascondi domenica'/);
});
