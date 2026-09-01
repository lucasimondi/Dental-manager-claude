import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPaymentsToPatients, flagPossibleDuplicates, riepilogoEstrattoConto, buildPaymentsFromEstrattoConto } from '../src/lib/domain/estrattoContoService.js';

const patients = [
  { id: 1, nome: 'Mario', cognome: 'Rossi' },
  { id: 2, nome: 'Anna', cognome: 'Bianchi' },
];

test('matchPaymentsToPatients decorates rows with a pazienteId guess, or null', () => {
  const righe = [
    { data: '2026-08-05', importo: 100, descrizione: 'BONIFICO MARIO ROSSI' },
    { data: '2026-08-06', importo: 50, descrizione: 'ACCREDITO POS TERMINALE 123' },
  ];
  const result = matchPaymentsToPatients(righe, patients);
  assert.equal(result[0].pazienteId, 1);
  assert.equal(result[1].pazienteId, null);
});

test('flagPossibleDuplicates flags a row matching an existing paid payment by amount+nearby date', () => {
  const righe = [
    { data: '2026-08-05', importo: 100, descrizione: 'BONIFICO MARIO ROSSI' },
    { data: '2026-08-06', importo: 250, descrizione: 'BONIFICO NUOVO' },
  ];
  const payments = [{ id: 1, importo: 100, data: '2026-08-03', stato: 'pagato' }];
  const result = flagPossibleDuplicates(righe, payments);
  assert.equal(result[0].possibileDuplicato, true);
  assert.equal(result[1].possibileDuplicato, false);
});

test('flagPossibleDuplicates ignores non-pagato payments and far-apart dates', () => {
  const righe = [{ data: '2026-08-05', importo: 100, descrizione: 'x' }];
  const sospeso = flagPossibleDuplicates(righe, [{ importo: 100, data: '2026-08-05', stato: 'sospeso' }]);
  assert.equal(sospeso[0].possibileDuplicato, false);
  const lontano = flagPossibleDuplicates(righe, [{ importo: 100, data: '2026-01-01', stato: 'pagato' }]);
  assert.equal(lontano[0].possibileDuplicato, false);
});

test('riepilogoEstrattoConto sums the statement and the already-registered period total', () => {
  const righe = [{ data: '2026-08-05', importo: 100 }, { data: '2026-08-20', importo: 50 }];
  const payments = [
    { data: '2026-08-10', importo: 200, stato: 'pagato' }, // inside period
    { data: '2026-07-01', importo: 999, stato: 'pagato' }, // outside period
    { data: '2026-08-15', importo: 10, stato: 'sospeso' }, // not pagato
  ];
  const riepilogo = riepilogoEstrattoConto(righe, payments, { periodoDa: '2026-08-01', periodoA: '2026-08-31' });
  assert.equal(riepilogo.totaleEstrattoConto, 150);
  assert.equal(riepilogo.totaleRegistratoPeriodo, 200);
  assert.equal(riepilogo.periodoDa, '2026-08-01');
  assert.equal(riepilogo.periodoA, '2026-08-31');
});

test('riepilogoEstrattoConto derives the period from the rows when not given', () => {
  const righe = [{ data: '2026-08-05', importo: 10 }, { data: '2026-08-20', importo: 10 }];
  const riepilogo = riepilogoEstrattoConto(righe, []);
  assert.equal(riepilogo.periodoDa, '2026-08-05');
  assert.equal(riepilogo.periodoA, '2026-08-20');
});

test('buildPaymentsFromEstrattoConto builds pagato payments, auto-assigning piano_id for a single-plan patient', () => {
  const plans = [{ id: 9, pazienteId: 1, stato: 'attivo' }];
  const righe = [{ data: '2026-08-05', importo: 100, descrizione: 'BONIFICO MARIO ROSSI', pazienteId: 1 }];
  const result = buildPaymentsFromEstrattoConto(righe, plans);
  assert.equal(result.length, 1);
  assert.equal(result[0].pazienteId, 1);
  assert.equal(result[0].importo, 100);
  assert.equal(result[0].stato, 'pagato');
  assert.equal(result[0].metodo, 'Bonifico');
  assert.equal(result[0].pianoId, 9);
});

test('buildPaymentsFromEstrattoConto uses the row-chosen piano_id for a multi-plan patient', () => {
  const plans = [{ id: 9, pazienteId: 1, stato: 'attivo' }, { id: 10, pazienteId: 1, stato: 'attivo' }];
  const righe = [{ data: '2026-08-05', importo: 100, descrizione: 'x', pazienteId: 1, pianoId: '10' }];
  const result = buildPaymentsFromEstrattoConto(righe, plans);
  assert.equal(result[0].pianoId, 10);
});

test('buildPaymentsFromEstrattoConto skips rows without a resolved patient (never guesses)', () => {
  const righe = [{ data: '2026-08-05', importo: 100, descrizione: 'x', pazienteId: null }];
  assert.deepEqual(buildPaymentsFromEstrattoConto(righe, []), []);
});
