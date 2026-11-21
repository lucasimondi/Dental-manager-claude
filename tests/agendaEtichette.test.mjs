// AGENDA-ETICHETTE (PO 2026-11-20): etichette comuni Studio/Personal, Compleanni, ripetizioni.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ETICHETTE_BASE, normalizzaEtichette, etichetteDaImpostazioni, nuovaEtichetta, tipoPerDb, coloreImpegno, nomeEtichettaImpegno,
  dateRipetizione, fineRipetizionePredefinita, RIPETIZIONI, durataGiorni, piuGiorniIso,
} from '../shared/agenda/etichette.js';
import { rigaImpegno, generaDateRipetizione } from '../personal/src/lib/agenda.js';

test('Compleanni c\'è sempre, anche in una lista salvata senza', () => {
  assert.ok(ETICHETTE_BASE.some((e) => e.id === 'compleanni'));
  const salvate = normalizzaEtichette([{ id: 'palestra', nome: 'Palestra', colore: '#123456' }]);
  assert.deepEqual(salvate.map((e) => e.id), ['palestra', 'compleanni']);
  assert.deepEqual(etichetteDaImpostazioni({}).map((e) => e.id), ETICHETTE_BASE.map((e) => e.id));
});

test('lista pulita: niente doppioni, colori validi, etichette di Personal unite alle predefinite', () => {
  const l = normalizzaEtichette([{ nome: 'Sport', colore: 'rosso' }, { nome: 'sport' }, { nome: '' }]);
  assert.equal(l.filter((e) => e.nome.toLowerCase() === 'sport').length, 1);
  assert.equal(l[0].colore, '#059669');
  const unite = normalizzaEtichette(null, { aggiuntive: [{ id: 'barca', nome: 'Barca', colore: '#0000ff' }, { id: 'sport', nome: 'Sport', colore: '#059669' }] });
  assert.ok(unite.some((e) => e.id === 'barca'));
  assert.equal(unite.filter((e) => e.id === 'sport').length, 1);
});

test('nuova etichetta: id unico, nome obbligatorio e non ripetuto', () => {
  const base = normalizzaEtichette(null);
  assert.deepEqual(nuovaEtichetta(base, ' Scuola bimbi ', '#AABBCC'), { id: 'scuola_bimbi', nome: 'Scuola bimbi', colore: '#aabbcc' });
  assert.throws(() => nuovaEtichetta(base, 'compleanni'), /c’è già/);
  assert.throws(() => nuovaEtichetta(base, '  '), /nome/);
  assert.equal(nuovaEtichetta([...base, { id: 'gita', nome: 'Gita 1', colore: '#000000' }], 'Gita', '#111111').id, 'gita_2');
});

test('tipo nel database resta uno dei quattro ammessi, l\'etichetta va in «etichetta»', () => {
  for (const e of [...ETICHETTE_BASE, { id: 'palestra' }]) assert.ok(['personale', 'ferie', 'chiamata', 'altro'].includes(tipoPerDb(e.id)));
  const riga = rigaImpegno({ titolo: 'Compleanno di Giulia', tipo: 'compleanni', tutto_il_giorno: true, data_inizio: '2026-03-14' });
  assert.equal(riga.tipo, 'personale');
  assert.equal(riga.etichetta, 'compleanni');
});

test('colore e nome: prima il colore proprio, poi quello dell\'etichetta (studio o Personal)', () => {
  const l = normalizzaEtichette(null);
  assert.equal(coloreImpegno({ etichetta: 'compleanni', tipo: 'personale' }, l), '#e11d48');
  assert.equal(coloreImpegno({ tipo: 'ferie' }, l), '#f59e0b');
  assert.equal(coloreImpegno({ etichetta: 'compleanni', colore: '#111111' }, l), '#111111');
  assert.equal(nomeEtichettaImpegno({ etichetta: 'compleanni' }, l), 'Compleanni');
});

test('ripetizioni: ogni anno (anche 29 febbraio), ogni mese, ogni giorno', () => {
  assert.ok(RIPETIZIONI.some(([k]) => k === 'annuale'));
  assert.deepEqual(dateRipetizione('2028-02-29', '2031-12-31', 'annuale'), ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28']);
  assert.deepEqual(dateRipetizione('2027-01-31', '2027-03-31', 'mensile'), ['2027-01-31', '2027-02-28', '2027-03-31']);
  assert.deepEqual(dateRipetizione('2026-11-20', '2026-11-22', 'giornaliera'), ['2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual(dateRipetizione('2026-11-20', '', 'nessuna'), ['2026-11-20']);
  assert.deepEqual(dateRipetizione('2026-11-20', '2026-11-01', 'settimanale'), []);
  assert.deepEqual(generaDateRipetizione('2026-03-14', '2028-03-14', 'annuale'), ['2026-03-14', '2027-03-14', '2028-03-14']);
});

test('compleanni: per 30 anni se non si sceglie la fine; impegni di più giorni restano lunghi uguali', () => {
  const fine = fineRipetizionePredefinita('2026-03-14', 'annuale');
  assert.equal(fine, '2056-03-13');
  assert.equal(dateRipetizione('2026-03-14', fine, 'annuale').length, 30);
  assert.equal(durataGiorni('2026-08-01', '2026-08-15'), 14);
  assert.equal(piuGiorniIso('2027-08-01', 14), '2027-08-15');
});

test('agenda dello studio e impostazioni usano la lista comune e la ripetizione per tutto il giorno', () => {
  const agenda = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  assert.match(agenda, /etichetteDaImpostazioni\(si\?\.agenda_settings\)/);
  assert.match(agenda, /\+ Nuova etichetta/);
  assert.match(agenda, /dateRipetizione\(impForm\.dataInizio, impForm\.ripetiFino, impForm\.ripeti\)/);
  assert.doesNotMatch(agenda, /TIPO_IMPEGNO/);
  const imp = readFileSync(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');
  assert.match(imp, /Etichette degli impegni/);
  assert.match(imp, /sectionDestination\('personal', 'impostazioni'\)/);
  const pers = readFileSync(new URL('../personal/src/sezioni/impostazioni/Impostazioni.jsx', import.meta.url), 'utf8');
  assert.match(pers, /sectionDestination\('studio', 'set'\)/);
  assert.match(pers, /salvaEtichette/);
});
