// POL-AI-010 step 2c: the "Attività di Poliedron" log shows readable labels and
// details, and cancelled appointments no longer occupy the agenda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etichettaAttivita, dettaglioAttivita, idsRipristinati, puoRipristinare, tabelleDopoRipristino } from '../src/lib/poliedron/attivita.js';

test('activity labels and details come from the server summary', () => {
  assert.equal(etichettaAttivita('elimina_appuntamento'), 'Appuntamento annullato');
  assert.equal(etichettaAttivita('sconosciuta'), 'Azione');
  assert.equal(dettaglioAttivita('Fatto. Nota aggiunta nella scheda di Mario Rossi\n"Allergico"'), '"Allergico"');
});

test('cancelled appointments are hidden from the agenda grid and the dashboard day lists', () => {
  const agenda = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  assert.match(agenda, /const appointmentsAgenda = appointments\.filter\(a => a\.stato !== 'annullato'/);
  const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /a\.data === t && a\.stato !== 'annullato'/);
  assert.match(dashboard, /a\.data === domani && a\.stato !== 'annullato'/);
});

test('Ripristina is offered once, only for undoable actions; agenda undo refreshes recalls too', () => {
  const rows = [
    { id: 'a', azione: 'elimina_appuntamento' },
    { id: 'b', azione: 'crea_paziente' },
    { id: 'c', azione: 'aggiungi_nota_paziente' },
    { id: 'u', azione: 'ripristino', ripristino_di: 'c' },
  ];
  const done = idsRipristinati(rows);
  assert.deepEqual([...done], ['c']);
  assert.deepEqual(rows.map((r) => puoRipristinare(r, done)), [true, false, false, false]);
  assert.deepEqual(tabelleDopoRipristino('appointments'), ['appointments', 'richiami']);
  assert.deepEqual(tabelleDopoRipristino('todos'), ['todos']);
});
