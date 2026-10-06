import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isSaveToRecordRequest,
  patientFilePath,
  saveAttachmentToPatient,
  saveTargetCandidates,
} from '../src/lib/poliedron/attachmentToPatient.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

// POL-AI-011 — salvare nella scheda del paziente il file allegato in Chat.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const controller = read('../src/components/poliedron/Poliedron.jsx');
const chatPage = read('../src/components/poliedron/PoliedronChatPage.jsx');
const card = read('../src/components/poliedron/PoliedronSaveAttachment.jsx');
const photos = read('../src/components/PatientPhotos.jsx');

const patients = [
  { id: 11, nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' },
  { id: 12, nome: 'Anna', cognome: 'Rossi', cf: '', telefono: '' },
  { id: 13, nome: 'Laura', cognome: 'Bianchi', cf: '', telefono: '3331234567' },
];
const ATTACHMENT = { name: 'referto rx.pdf', mediaType: 'application/pdf', size: 9, data: 'JVBERi0xLjQK' };

test('only an explicit "save into the record" request is recognised', () => {
  for (const ok of ['Salvalo nella scheda di Mario Rossi', 'archivia nella cartella del paziente', 'mettilo nel fascicolo di Bianchi', 'Carica il referto nella scheda']) {
    assert.equal(isSaveToRecordRequest(ok), true, ok);
  }
  for (const no of ['Cosa vedi in questa foto?', 'Leggi il file allegato', 'Apri la scheda di Rossi', 'salva il numero di telefono']) {
    assert.equal(isSaveToRecordRequest(no), false, no);
  }
});

test('the patient is pre-selected only when unambiguous', () => {
  assert.deepEqual(saveTargetCandidates('salvalo nella scheda di Mario Rossi', patients).map((p) => p.id), [11]);
  assert.deepEqual(saveTargetCandidates('salvalo nella scheda di Rossi', patients).map((p) => p.id).sort(), [11, 12]);
  assert.deepEqual(saveTargetCandidates('mettilo nel fascicolo della signora Bianchi.', patients).map((p) => p.id), [13]);
  assert.deepEqual(saveTargetCandidates('salvalo nella sua scheda', patients), []);
  assert.deepEqual(saveTargetCandidates('salvalo nella scheda', patients), []);
});

test('files land in the same folder and name scheme as the patient "Foto" section', () => {
  assert.equal(patientFilePath(11, 'referto rx (1).pdf', 1700000000000), '11/1700000000000_LABEL_referto_rx__1_.pdf');
  assert.match(photos, /from\('patient-files'\)\.upload\(`\$\{patientId\}\/\$\{Date\.now\(\)\}_LABEL_\$\{safeName\}`/);
  assert.match(photos, /file\.name\.replace\(\/\[\^a-zA-Z0-9\._-\]\/g, '_'\)/);
});

test('upload goes to the private patient-files storage with the user login, never overwriting', async () => {
  let call = null;
  const client = { storage: { from: (bucket) => ({ upload: async (path, blob, options) => { call = { bucket, path, blob, options }; return { error: null }; } }) } };
  const path = await saveAttachmentToPatient(client, 11, ATTACHMENT, 1700000000000);
  assert.equal(path, '11/1700000000000_LABEL_referto_rx.pdf');
  assert.equal(call.bucket, 'patient-files');
  assert.deepEqual(call.options, { upsert: false, contentType: 'application/pdf' });
  assert.equal(call.blob.type, 'application/pdf');
  assert.equal(call.blob.size, 9);

  const failing = { storage: { from: () => ({ upload: async () => ({ error: { message: 'new row violates row-level security policy' } }) }) } };
  await assert.rejects(saveAttachmentToPatient(failing, 11, ATTACHMENT), /Salvataggio non riuscito/);
  await assert.rejects(saveAttachmentToPatient(client, null, ATTACHMENT), /Scegli il paziente/);
  await assert.rejects(saveAttachmentToPatient(client, 11, { name: 'x' }), /non è più disponibile/);
});

test('a save request with a file never calls the model and returns the candidates', async () => {
  let invoked = false;
  const supabaseClient = { functions: { invoke: async () => { invoked = true; return { data: { text: 'x' }, error: null }; } } };
  const result = await processQuery({
    query: 'salvalo nella scheda di Mario Rossi',
    sources: { patients },
    supabaseClient,
    allowModel: true,
    attachment: { nome: 'referto.pdf', media_type: 'application/pdf', data: 'JVBERi0xLjQK' },
  });
  assert.equal(invoked, false);
  assert.equal(result.intent, 'SAVE_ATTACHMENT');
  assert.deepEqual(result.attachmentSave.candidates.map((p) => p.id), [11]);

  const withoutFile = await processQuery({ query: 'salvalo nella scheda di Mario Rossi', sources: { patients }, allowModel: false });
  assert.equal(withoutFile.attachmentSave, undefined);
});

test('UI: save button on the file, confirmation card, nothing saved without "Salva"', () => {
  assert.match(chatPage, /aria-label="Salva nella scheda del paziente"/);
  assert.match(chatPage, /if \(state\.attachmentSave\) \{[\s\S]*<PoliedronSaveAttachment/);
  assert.match(card, /onClick=\{\(\) => onSave\?\.\(selected\)\} disabled=\{!selected \|\| busy\}/);
  assert.match(card, /useState\(candidates\.length === 1 \? candidates\[0\] : null\)/);
  assert.match(controller, /await saveAttachmentToPatient\(supabaseClient, patient\.id, attachment\);/);
  assert.match(controller, /Ho salvato "\$\{attachment\.name\}" nella scheda di/);
  assert.match(controller, /if \(result\?\.attachmentSave\)/);
});
