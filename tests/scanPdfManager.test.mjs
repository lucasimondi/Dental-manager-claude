import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { pdfDaElementi, preparaAllegatiScan } from '../personal/src/lib/pdfUnico.js';
import { pagineDaIntervallo, nomeDocumento, organizzaPdf } from '../personal/src/pdf/operazioni.js';
import { inviaCon } from '../personal/src/lib/condividi.js';
async function fixture(name = 'prova.pdf') {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([300 + i * 100, 600]);
  const field = doc.getForm().createTextField('test'); field.setText('ESEMPIO');
  field.addToPage(doc.getPage(0), { x: 10, y: 10, width: 100, height: 25 });
  return new File([await doc.save()], name, { type: 'application/pdf' });
}
test('Scan single PDF keeps exact bytes and editable form when renamed', async () => {
  const file = await fixture();
  const result = await pdfDaElementi([{ tipo: 'pdf', file }], 'Nuovo nome');
  assert.equal(result.name, 'Nuovo nome.pdf');
  assert.deepEqual(await result.arrayBuffer(), await file.arrayBuffer());
  const doc = await PDFDocument.load(await result.arrayBuffer());
  assert.equal(doc.getForm().getTextField('test').getText(), 'ESEMPIO');
});
test('Scan selected separate files retain order, content and unique names; combined PDF contains all pages', async () => {
  const a = await fixture(), b = await fixture();
  const files = await preparaAllegatiScan([{ tipo: 'pdf', file: a }, { tipo: 'pdf', file: b }], 'Uniti', true);
  assert.deepEqual(files.map(f => f.name), ['prova.pdf', 'prova - 2.pdf']);
  assert.deepEqual(await files[1].arrayBuffer(), await b.arrayBuffer());
  const combined = await preparaAllegatiScan([{ tipo: 'pdf', file: a }, { tipo: 'pdf', file: b }], 'Uniti', false);
  assert.equal(combined.length, 1); assert.equal(combined[0].name, 'Uniti.pdf');
  assert.equal((await PDFDocument.load(await combined[0].arrayBuffer())).getPageCount(), 6);
  await assert.rejects(preparaAllegatiScan([], 'x', true), /Seleziona/);
  await assert.rejects(preparaAllegatiScan(Array(21).fill({tipo:'pdf',file:a}), 'x', true), /20/);
});
test('Extract ranges reject mistakes, preserve requested order and leave source unchanged', async () => {
  assert.deepEqual(pagineDaIntervallo('3, 1-2, 2', 3).map(p=>p.index), [2,0,1]);
  for (const value of ['', '0', '4', '2-1', '1,,2', '1.5', '-1', '1-9999999999']) assert.throws(() => pagineDaIntervallo(value, 3));
  const file = await fixture(); const bytes = new Uint8Array(await file.arrayBuffer()), original = bytes.slice();
  const out = await PDFDocument.load(await organizzaPdf(bytes, pagineDaIntervallo('3,1', 3)));
  assert.deepEqual(out.getPages().map(p => p.getWidth()), [500,300]); assert.deepEqual(bytes, original);
});
test('Rename normalizes one PDF extension and rejects empty names', () => {
  assert.equal(nomeDocumento('  Referto: test.PDF  '.trim()), 'Referto- test.pdf');
  assert.throws(() => nomeDocumento(' ')); assert.throws(() => nomeDocumento('..'));
});
test('Separate attachment delivery never falls back to a message without files', async () => {
  const files = [await fixture('a.pdf'), await fixture('b.pdf')]; let shared;
  assert.equal(await inviaCon('mail', {files}, {canShare:()=>true,share:async x=>{shared=x;}}), 'files');
  assert.deepEqual(shared.files, files);
  assert.equal(await inviaCon('whatsapp', {files}, {share:()=>{throw Error('must not share text');},canShare:()=>false}), 'non_disponibile');
  assert.equal(await inviaCon('mail', {files}, {canShare:()=>true,share:async()=>{throw new DOMException('cancel','AbortError');}}), 'annullato');
});

test('Long duplicate attachment names remain unique without a suffix truncation loop', async () => {
  const file = await fixture(`${'a'.repeat(100)}.pdf`);
  const files = await preparaAllegatiScan([{tipo:'pdf',file}, {tipo:'pdf',file}], 'test', true);
  assert.notEqual(files[0].name, files[1].name);
  assert.ok(files.every(f => f.name.length <= 84));
});
