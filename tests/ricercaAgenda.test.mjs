// RICERCA-AGENDA (PO 2026-11-08): "La barra di ricerca deve cercare direttamente, inoltre deve poter
// anche agire: inserire appuntamenti, spostarli, cancellarli, trovare documenti, note, password,
// acquisire documenti, azioni veloci".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpreta, proposta, trovaElementi, destinazione, trovaDate, trovaOre } from '../shared/ricerca/comandi.js';
import { impegnoSpostato } from '../shared/ricerca/fonti.js';

const OGGI = '2026-11-08'; // domenica

test('date e ore in italiano', () => {
  assert.deepEqual(trovaDate('domani', OGGI).map(d => d.data), ['2026-11-09']);
  assert.deepEqual(trovaDate('giovedì', OGGI).map(d => d.data), ['2026-11-12']);
  assert.deepEqual(trovaDate('domenica', OGGI).map(d => d.data), ['2026-11-15'], 'lo stesso giorno della settimana è quello prossimo');
  assert.deepEqual(trovaDate('12/11', OGGI).map(d => d.data), ['2026-11-12']);
  assert.deepEqual(trovaDate('3 marzo', OGGI).map(d => d.data), ['2027-03-03'], 'una data passata va all\'anno dopo');
  assert.deepEqual(trovaOre('alle 15').map(o => o.ora), ['15:00']);
  assert.deepEqual(trovaOre('alle 9 e mezza').map(o => o.ora), ['09:30']);
  assert.deepEqual(trovaOre('15.30').map(o => o.ora), ['15:30']);
  assert.deepEqual(trovaOre('Rossi 12 novembre').map(o => o.ora), [], 'un numero da solo non è un orario');
  assert.deepEqual(trovaDate('Mario Rossi', OGGI), [], '"Mario" non è martedì');
});

test('i comandi: sposta, cancella, nuovo appuntamento, impegno, nota, password, acquisisci, cerca', () => {
  assert.deepEqual(interpreta('sposta Rossi a giovedì alle 15', OGGI), { tipo: 'sposta', soggetto: 'rossi', testo: 'Rossi a giovedì alle 15', titolo: 'Rossi', date: ['2026-11-12'], ore: ['15:00'] });
  assert.equal(interpreta('cancella Bianchi domani', OGGI).tipo, 'cancella');
  const app = interpreta('appuntamento Mario Rossi martedì alle 10 e mezza', OGGI);
  assert.equal(app.tipo, 'nuovoAppuntamento'); assert.equal(app.soggetto, 'mario rossi'); assert.deepEqual([app.date, app.ore], [['2026-11-10'], ['10:30']]);
  const imp = interpreta('ricordami di comprare il latte domani alle 18', OGGI);
  assert.equal(imp.tipo, 'nuovoImpegno'); assert.equal(imp.titolo, 'comprare il latte');
  assert.equal(interpreta('nota: chiamare il commercialista', OGGI).testo, 'chiamare il commercialista');
  assert.equal(interpreta('password banca', OGGI).tipo, 'password');
  assert.equal(interpreta('acquisisci documento', OGGI).tipo, 'acquisisci');
  assert.equal(interpreta('rossi', OGGI).tipo, 'cerca');
});

const EL = [
  { id: 1, tipo: 'appuntamento', titolo: 'Mario Rossi', data: '2026-11-12', ora: '10:00' },
  { id: 2, tipo: 'appuntamento', titolo: 'Luca Rossi', data: '2026-11-01', ora: '10:00' },
  { id: 3, tipo: 'impegno', titolo: 'Recita bimbe', data: '2026-11-13', ora: null },
];

test('trova prima i prossimi, poi i passati; filtra per data', () => {
  assert.deepEqual(trovaElementi(EL, 'rossi', { oggi: OGGI }).map(e => e.id), [1, 2]);
  assert.deepEqual(trovaElementi(EL, 'rossi', { oggi: OGGI, data: '2026-11-01' }).map(e => e.id), [2]);
  assert.deepEqual(trovaElementi(EL, 'recita', { oggi: OGGI }).map(e => e.id), [3]);
});

test('proposte: lo spostamento tiene ciò che non si dice; con due date la prima dice quale', () => {
  const p = proposta(interpreta('sposta Mario Rossi a venerdì', OGGI), EL, OGGI);
  assert.deepEqual(p.candidati.map(e => e.id), [1]);
  assert.deepEqual(destinazione(p.candidati[0], p.verso), { data: '2026-11-13', ora: '10:00' });
  const q = proposta(interpreta('sposta rossi da domenica 1/11 a lunedì alle 9', OGGI), EL, OGGI);
  assert.deepEqual(q.candidati.map(e => e.id), [2]);
  assert.deepEqual(q.verso, { data: '2026-11-09', ora: '09:00' });
  const c = proposta(interpreta('cancella recita', OGGI), EL, OGGI);
  assert.deepEqual([c.tipo, c.candidati.map(e => e.id)], ['cancella', [3]]);
  assert.deepEqual(proposta(interpreta('impegno recita bimbe venerdì', OGGI), EL, OGGI), { tipo: 'nuovoImpegno', data: '2026-11-13', ora: null, soggetto: 'recita bimbe', titolo: 'Recita bimbe' });
});

test('impegno spostato: stessa durata, giorni interi insieme, camelCase e snake_case', () => {
  assert.deepEqual(impegnoSpostato({ id: 1, dataInizio: '2026-11-10', dataFine: '2026-11-10', oraInizio: '09:00', oraFine: '10:30' }, { data: '2026-11-12', ora: '15:00' }),
    { id: 1, dataInizio: '2026-11-12', dataFine: '2026-11-12', oraInizio: '15:00', oraFine: '16:30' });
  assert.deepEqual(impegnoSpostato({ id: 2, data_inizio: '2026-11-10', data_fine: '2026-11-11', tutto_il_giorno: true }, { data: '2026-11-20', ora: null }),
    { id: 2, data_inizio: '2026-11-20', data_fine: '2026-11-21', tutto_il_giorno: true });
});

test('la barra conferma prima di modificare; le password non escono mai nei risultati', () => {
  const ui = readFileSync('shared/ricerca/RicercaAgenda.jsx', 'utf8');
  assert.match(ui, /onClick=\{\(\) => esegui\(\(\) => azione\(el, verso\), p\.tipo === 'sposta' \? 'Spostato' : 'Eliminato'\)\}>\{p\.tipo === 'sposta' \? 'Conferma' : 'Elimina'\}/);
  assert.match(ui, /className="ricerca-annulla agenda-floating-interactive" onClick=\{chiudi\}>Chiudi</);
  const fonti = readFileSync('shared/ricerca/fonti.js', 'utf8');
  assert.doesNotMatch(fonti, /segreto/, 'i risultati mostrano servizio e utente, mai la password');
  assert.doesNotMatch(readFileSync('shared/ricerca/comandi.js', 'utf8'), /fetch\(|anthropic|openai/i, 'motore locale, nessun modello');
});

test('Personal: la chat Poliedron ha sempre un tasto per uscire; la domanda arriva già scritta', () => {
  const chat = readFileSync('personal/src/sezioni/poliedron/Poliedron.jsx', 'utf8');
  assert.match(chat, /className="pp-chat-esci" onClick=\{\(\) => ctx\.vai\('agenda'\)\}/);
  assert.match(chat, /useState\(\(\) => chat\.bozza \|\| ''\)/);
});
