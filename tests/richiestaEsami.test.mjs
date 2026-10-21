import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRichiestaEsamiPdf } from '../src/lib/documenti/richiestaEsami.js';
const base = { si: { nome: 'Studio Test', spec: 'Medico', addr1: 'Via Test 1' }, paziente: { nome: 'Mario', cognome: 'Test', dataNascita: '1980-01-02' }, data: '2026-10-21', esami: 'Ecografia addome completo\nTAC massiccio facciale', distretto: 'Addome', quesito: 'Valutazione diagnostica', note: 'Confronto con precedente' };
const raw = pdf => Buffer.from(pdf.dataUrl.split(',')[1], 'base64').toString('latin1');
test('diagnostic request includes clinician-selected content and shared patient/header/footer', () => {
  const pdf = buildRichiestaEsamiPdf(base);
  assert.equal(pdf.tipoDoc, 'esami');
  assert.equal(pdf.filename, 'Mario Test.pdf');
  const body = raw(pdf);
  for (const text of ['RICHIESTA ESAMI DIAGNOSTICI', 'Studio Test', 'Mario Test', 'Ecografia addome completo', 'TAC massiccio facciale', 'Addome', 'Valutazione diagnostica', 'Confronto con precedente']) assert.ok(body.includes(text), text);
});
test('blank examination and missing patient cannot generate a request', () => {
  assert.throws(() => buildRichiestaEsamiPdf({ ...base, esami: '   ' }), /almeno un esame/);
  assert.throws(() => buildRichiestaEsamiPdf({ ...base, paziente: null }), /paziente/);
});
test('long notes paginate before the signature and repeat header on each page', () => {
  const body = raw(buildRichiestaEsamiPdf({ ...base, note: Array.from({ length: 130 }, (_, i) => `Nota clinica ${i}`).join('\n') }));
  const pages = (body.match(/\/Type \/Page\b/g) || []).length;
  assert.ok(pages > 2);
  assert.equal((body.match(/\(Studio Test\) Tj/g) || []).length, pages * 2);
  assert.ok(body.includes('Nota clinica 129'));
  for (const match of body.matchAll(/1\. 0\. 0\. 1\. [\d.]+ ([\d.]+) Tm\n\(Nota clinica/g)) assert.ok(Number(match[1]) >= 210, 'body must stay above signature');
});
