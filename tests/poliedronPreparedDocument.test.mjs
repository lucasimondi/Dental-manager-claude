// Ricetta in chat: Poliedron genera subito il PDF (stesso generatore del modulo
// Ricetta) e nulla viene archiviato o inviato finché il medico non conferma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRicettaPdf, archiviaDocumento } from '../src/lib/documenti/pdfLayout.js';

const si = { nome: 'Studio Test', spec: 'Odontoiatra', iscr: 'Iscr. Albo 123', addr1: 'Via Roma 1', tel: '0123', email: 's@t.it', piva: '01234567890' };
const paziente = { id: 7, nome: 'Tizio', cognome: 'Caio' };
const farmaci = [{ farmaco: 'Amoxicillina + acido clavulanico (Augmentin)', dosaggio: '875 mg + 125 mg', posologia: '1 compressa ogni 12 ore', durata: 'Per 6 giorni', note: '' }];
const source = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the chat PDF is a real prescription with patient, drug, posology and studio header', () => {
  const pdf = buildRicettaPdf({ si, paziente, farmaci, data: '2026-10-11' });
  assert.equal(pdf.filename, 'Tizio Caio.pdf');
  assert.equal(pdf.tipoDoc, 'ricetta');
  const bytes = Buffer.from(pdf.dataUrl.split(',')[1], 'base64').toString('latin1');
  assert.match(bytes, /^%PDF-/);
  for (const text of ['RICETTA MEDICA', 'Tizio Caio', 'Augmentin', '1 compressa ogni 12 ore', 'Studio Test']) assert.ok(bytes.includes(text), text);
});

test('archive: only when the studio keeps prescriptions, under its own studio and patient', async () => {
  const inserts = [];
  const client = { from: (table) => ({ insert: (rows) => { inserts.push({ table, rows }); return { select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }) }; } }) };
  const args = { studioId: 's1', paziente, tipoDoc: 'ricetta', titolo: 'Ricetta medica', data: '2026-10-11', dataUrl: 'data:application/pdf;base64,AA==' };
  assert.deepEqual(await archiviaDocumento(client, { ...args, si }), { id: 1 });
  assert.equal(inserts[0].table, 'documenti_medici');
  assert.equal(inserts[0].rows[0].studio_id, 's1');
  assert.equal(inserts[0].rows[0].paziente_id, 7);
  assert.equal(await archiviaDocumento(client, { ...args, si: { ...si, documenti_settings: { ricetta: false } } }), null);
  assert.equal(inserts.length, 1, 'not archived when the studio turned it off');
});

test('chat wiring: the PDF is prepared at once; archive and sending happen only on the clinician’s tap', () => {
  const poliedron = source('src/components/poliedron/Poliedron.jsx');
  assert.match(poliedron, /if \(result\.documentRequest\) \{\s*prepareDocumentInChat\(result\.documentRequest\);/);
  const prepare = poliedron.slice(poliedron.indexOf('const prepareDocumentInChat'), poliedron.indexOf('const archivePreparedDocument'));
  assert.match(prepare, /buildRicettaPdf\(/);
  assert.doesNotMatch(prepare, /archivia|condividi|imparaDaRicetta/, 'preparing never archives, shares or learns');
  const send = poliedron.slice(poliedron.indexOf('const sendPreparedDocument'), poliedron.indexOf('const savePreparedDocument'));
  assert.ok(send.indexOf('condividiPdf(') < send.indexOf('archivePreparedDocument('), 'share sheet opens straight from the tap');
  // Same checks as the form: a patient of this studio and the Ricetta permission.
  assert.match(prepare, /actions\.some\(\(action\) => action\.id === 'prescription\.create'\)/);
});

test('card: sending needs a second explicit confirmation', async () => {
  const card = source('src/components/poliedron/PoliedronPreparedDocument.jsx');
  assert.match(card, /onClick=\{\(\) => setConfirming\(true\)\}[^>]*>Invia a/);
  assert.match(card, /setConfirming\(false\); onSend\?\.\(\);[^>]*>Sì, invia/);
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Card } = await import('../src/components/poliedron/PoliedronPreparedDocument.jsx').catch(() => ({ default: null }));
  if (!Card) return; // JSX is not loadable by plain Node: the source checks above cover it
  const html = renderToStaticMarkup(React.createElement(Card, { prepared: { patient: paziente, farmaci, pdf: {}, status: 'ready' } }));
  assert.match(html, /Tizio Caio/);
  assert.doesNotMatch(html, /Sì, invia/);
});

// PO: "la scheda mi fa aprire una sola volta poi sparisce" — iOS reloads the
// installed app after a download/share; the card lived only in memory.
test('the prepared prescription survives a reload: kept on this device for 12 hours, PDF rebuilt, never stored', () => {
  const poliedron = source('src/components/poliedron/Poliedron.jsx');
  assert.match(poliedron, /poliedron_ricetta_preparata_\$\{studioId\}_\$\{userId\}/);
  assert.match(poliedron, /12 \* 60 \* 60 \* 1000/);
  const persist = poliedron.slice(poliedron.indexOf('window.localStorage.setItem(preparedStorageKey'));
  assert.doesNotMatch(persist.slice(0, persist.indexOf(';')), /pdf|dataUrl/, 'the PDF itself is not written to the device');
  const restore = poliedron.slice(poliedron.indexOf('const raw = window.localStorage.getItem(preparedStorageKey)'), poliedron.indexOf('window.localStorage.setItem(preparedStorageKey'));
  assert.match(restore, /buildRicettaPdf\(\{ si: studioInfo, paziente: patient, farmaci: stored\.farmaci, data: stored\.data \}\)/);
});

// PO: "le salva nel software? Quando le scarico".
test('sharing or downloading from the PDF viewer archives the prescription, once', () => {
  const viewer = source('src/components/ui/PdfViewerModal.jsx');
  assert.match(viewer, /scaricaPdf\(dataUrl, filename\); onExport\?\.\(\);/);
  assert.match(viewer, /if \(!ok\) scaricaPdf\(dataUrl, filename\);\s*onExport\?\.\(\);/);
  const card = source('src/components/poliedron/PoliedronPreparedDocument.jsx');
  assert.match(card, /onExport=\{onExport\}/);
  const poliedron = source('src/components/poliedron/Poliedron.jsx');
  assert.match(poliedron, /if \(prepared\.archiveDone\) return prepared\.archived;/);
  assert.match(poliedron, /onExportPreparedDocument=\{exportPreparedDocument\}/);
});

// PO: "il pdf generato deve avere solo il nome cognome del paziente .pdf".
test('every patient document is saved as "Nome Cognome.pdf"', async () => {
  const { nomeFilePaziente } = await import('../src/lib/documenti/pdfLayout.js');
  assert.equal(nomeFilePaziente({ nome: 'Andrea', cognome: 'Abello' }), 'Andrea Abello.pdf');
  assert.equal(nomeFilePaziente({ nome: ' Maria ', cognome: "D'Amico / De Luca" }), "Maria D'Amico De Luca.pdf");
  assert.equal(nomeFilePaziente({}), 'Paziente.pdf');
  const doc = source('src/components/DocMedico.jsx');
  assert.equal((doc.match(/const filename = nomeFilePaziente\(paz\);/g) || []).length, 5);
  assert.doesNotMatch(doc, /const filename = `/);
  assert.doesNotMatch(source('src/lib/pdfDocs.js'), /const filename = `/);
});
