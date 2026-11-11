// DOCUMENTI-CATEGORIE (PO 2026-11-11): "I documenti che scannerizzo o allego se non sono del tipo di
// documento che va già in documenti si perde, metti le varie categorie in più in documenti".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizza, categorieConUso, categoriaDi, ALTRE_CATEGORIE } from '../personal/src/lib/impostazioni.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('more ready-made categories, also on already saved settings, unless removed by hand', () => {
  const salvate = normalizza({ categorie: [{ id: 'patente', nome: 'Patente' }] });
  for (const id of ['patente', 'garanzia', 'contratto', 'assicurazione', 'referto', 'altro']) assert.ok(salvate.categorie.some((c) => c.id === id), id);
  const tolta = normalizza({ categorie: [{ id: 'patente', nome: 'Patente' }], categorieTolte: ['garanzia'] });
  assert.ok(!tolta.categorie.some((c) => c.id === 'garanzia'));
  assert.equal(ALTRE_CATEGORIE.length >= 8, true);
});

test('a category already used on a document always has a place (e.g. a type chosen in Studio)', () => {
  const { categorie } = normalizza({});
  const tutte = categorieConUso(categorie, [{ categoria: 'Radiografia' }, { categoria: 'fattura_fornitore' }, { categoria: 'patente' }]);
  assert.ok(tutte.some((c) => c.id === 'Radiografia' && c.nome === 'Radiografia'));
  assert.ok(tutte.some((c) => c.id === 'fattura_fornitore' && c.nome === 'Fattura fornitore'));
  assert.equal(tutte.filter((c) => c.id === 'patente').length, 1);
  assert.equal(categoriaDi({ categoria: 'Radiografia' }, tutte), 'Radiografia');
});

test('Personali shows documents without a known person under «Altri documenti»; chips only for used categories', () => {
  const src = read('../personal/src/sezioni/personali/Personali.jsx');
  assert.match(src, /const attivi=arr\.filter\(d=>documentoDaPersonal\(d,d\._cat\)\);/);
  assert.match(src, /\[\.\.\.persone,null\]\.map\(persona=>/);
  assert.match(src, /titolo=\{persona\|\|'Altri documenti'\}/);
  assert.match(src, /categorieConUso\(impostazioni\.categorie,docs\)/);
});

test('Personal upload: every category plus «Nuovo tipo…»; Studio → Personale keeps the chosen type', () => {
  const carica = read('../personal/src/sezioni/documenti/Carica.jsx');
  assert.match(carica, /categorieConUso\(impostazioni\.categorie/);
  assert.match(carica, /<option value="__nuovo">\+ Nuovo tipo…<\/option>/);
  assert.match(carica, /categoria: categoria === '__nuovo' \? \(nuovoTipo\.trim\(\) \|\| null\) : categoria/);
  const acq = read('../src/components/AcquisisciDocumento.jsx');
  assert.match(acq, /dove === 'personale' \? <TipoETag tipo=\{tipo\} onTipo=\{setTipo\}/);
  assert.match(read('../src/lib/archiviaPersonale.js'), /export async function archiviaInPersonale\(file, descrizione = '', tag = \[\], categoria = null\)/);
});

test('Studio Documenti never shows a raw type id', () => {
  const docs = read('../src/components/ArchivioDocs.jsx');
  assert.match(docs, /const nomeTipo = \(t\) => TIPO_LABEL\[t\] \|\| /);
  assert.doesNotMatch(docs, /\(doc\.titolo \|\| doc\.tipo\)|\{TIPO_LABEL\[t\] \|\| t\}/);
});
