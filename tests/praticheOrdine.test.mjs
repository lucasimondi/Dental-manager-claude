import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { perNome, chiaveNome, sommarioPratica } from '../personal/src/lib/praticheOrdine.js';

test('le pratiche vanno in ordine alfabetico, senza badare a maiuscole, accenti e «Avv.»', () => {
  const elenco = [
    { id: 1, titolo: 'UnoEnergy – gas' }, { id: 2, titolo: 'banca Alpi Marittime' }, { id: 3, titolo: 'Avv. Conoscente – danni' },
    { id: 4, titolo: 'Èlite srl' }, { id: 5, titolo: 'Mondino – esecuzione 36/2023' }, { id: 6, titolo: 'Pratica 10' }, { id: 7, titolo: 'Pratica 9' },
  ];
  assert.deepEqual(perNome(elenco).map((p) => p.id), [2, 3, 4, 5, 7, 6, 1]);
  assert.equal(chiaveNome('Avv. Conoscente – danni'), 'Conoscente – danni');
  assert.equal(elenco[0].id, 1, 'non modifica l\'elenco originale');
});

test('il sommario della pratica conta scadenze aperte, passi aperti, date e documenti', () => {
  const v = sommarioPratica({
    documenti: [{}, {}, {}],
    scadenze: [{ data: '2099-01-29', completata: false }, { data: '2020-01-01', completata: false }, { data: '2099-01-01', completata: true }],
    filo: 12,
    passi: [{ stato: 'aperto', scadenza: '2099-12-15' }, { stato: 'aperto', scadenza: '2099-11-26' }, { stato: 'gestito', scadenza: '2000-01-01' }],
  });
  assert.deepEqual(v.map((x) => [x.id, x.n, x.prossima]), [
    ['pp-sez-scadenze', 2, '2099-01-29'], ['pp-sez-passi', 2, '2099-11-26'], ['pp-sez-filo', 12, null], ['pp-sez-documenti', 3, null],
  ]);
  assert.equal(sommarioPratica({}).find((x) => x.id === 'pp-sez-documenti').n, null);
});

test('elenchi e pagina della pratica usano ordine per nome e sommario con le ancore', () => {
  const legal = readFileSync('personal/src/sezioni/legal/Legal.jsx', 'utf8');
  const doc = readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8');
  const pagina = readFileSync('personal/src/sezioni/documenti/Pratica.jsx', 'utf8');
  const scheda = readFileSync('personal/src/sezioni/legal/SchedaPratica.jsx', 'utf8');
  assert.match(legal, /perNome\(elenco/);
  assert.match(doc, /perNome\(await caricaPratiche/);
  for (const id of ['pp-sez-scadenze', 'pp-sez-documenti']) assert.ok(pagina.includes(`id="${id}"`), id);
  for (const id of ['pp-sez-filo', 'pp-sez-passi']) assert.ok(scheda.includes(`id="${id}"`), id);
  assert.match(pagina, /onDati=\{setDatiScheda\}/);
  assert.ok(pagina.indexOf('id="pp-sez-scadenze"') < pagina.indexOf('<SchedaPratica'), 'le scadenze vengono prima della scheda');
});
