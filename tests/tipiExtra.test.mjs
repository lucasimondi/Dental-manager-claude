// ETICHETTE-PREMIUM (PO 2026-11-21): tempi e promemoria per tipo di appuntamento.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizzaExtra, extraTipo, conExtraTipo, durataTipo, minutiOccupati, messaggioPromemoria, CONFERMA_TESTO } from '../shared/agenda/tipiExtra.js';

test('valori puliti: minuti a passi di 5 tra 0 e 120, testi tagliati, conferma solo se vera', () => {
  assert.deepEqual(normalizzaExtra({ prima: '12', dopo: 500, testo: '  ciao  ', conferma: 'sì' }), { prima: 10, dopo: 120, testo: 'ciao', istruzioni: '', conferma: false });
  assert.deepEqual(normalizzaExtra(null), { prima: 0, dopo: 0, testo: '', istruzioni: '', conferma: false });
  assert.equal(normalizzaExtra({ testo: 'x'.repeat(2000) }).testo.length, 1000);
});

test('lettura per id o per nome, scrittura che non tocca gli altri tipi e toglie i vuoti', () => {
  const tipi = [{ id: 7, nome: 'Chirurgia', durata: 60 }, { id: 8, nome: 'Igiene' }];
  let ag = { etichette: [{ id: 'ferie' }], tipi_extra: { 8: { dopo: 10 } } };
  ag = { ...ag, tipi_extra: conExtraTipo(ag, 7, { prima: 10, dopo: 15, conferma: true }) };
  assert.equal(extraTipo(ag, tipi[0]).dopo, 15);
  assert.equal(extraTipo(ag, 'Chirurgia', tipi).prima, 10);
  assert.equal(extraTipo(ag, 'Igiene', tipi).dopo, 10);
  assert.equal(extraTipo(ag, 'Sconosciuto', tipi).dopo, 0);
  assert.deepEqual(Object.keys(conExtraTipo(ag, 8, {})), ['7']);
  assert.deepEqual(ag.etichette, [{ id: 'ferie' }]);
});

test('durata dal tipo e minuti occupati in agenda', () => {
  assert.equal(durataTipo({ durata: '60' }), 60);
  assert.equal(durataTipo({ durata: '' }), null);
  assert.equal(minutiOccupati(60, { prima: 10, dopo: 15 }), 85);
});

test('messaggio: testo del tipo con segnaposto, istruzioni e conferma; altrimenti il messaggio di sempre', () => {
  const extra = { testo: 'Buongiorno {nome}, intervento {data} alle {ora} ({tipo}).', istruzioni: 'Colazione leggera.', conferma: true };
  const m = messaggioPromemoria({ extra, nome: 'Maria', data: '25/11/2026', ora: '09:00', tipo: 'Chirurgia', predefinito: 'X' });
  assert.equal(m, `Buongiorno Maria, intervento 25/11/2026 alle 09:00 (Chirurgia).\n\nColazione leggera.\n\n${CONFERMA_TESTO}`);
  assert.equal(messaggioPromemoria({ extra: null, predefinito: 'Messaggio di sempre' }), 'Messaggio di sempre');
  assert.equal(messaggioPromemoria({ extra: { istruzioni: 'Porti la RX.' }, predefinito: 'Ciao' }), 'Ciao\n\nPorti la RX.');
});

test('Agenda e Impostazioni dello Studio usano tipi_extra (nessuna colonna nuova su app_types)', () => {
  const agenda = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const imp = readFileSync(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');
  assert.match(agenda, /messaggioPromemoria\(/);
  assert.match(agenda, /durataTipo\(/);
  assert.match(imp, /conExtraTipo\(/);
  assert.doesNotMatch(imp, /setAppTypes\([^)]*tipoExtra/);
});
