// Ricetta rapida dalla chat: "amoxicillina e clavulanico per Tizio Caio" apre il
// modulo Ricetta già compilato con i farmaci frequenti dello studio, senza modello.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickPrescription, prescriptionLines, resolveQuickPrescription } from '../src/lib/poliedron/quickPrescription.js';
import { FARMACI_PREFERITI_DEFAULT as F } from '../src/lib/farmaciPreferiti.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

const patients = [{ id: 1, nome: 'Tizio', cognome: 'Caio' }, { id: 2, nome: 'Mario', cognome: 'Rossi' }, { id: 3, nome: 'Maria', cognome: 'Rossi' }];
const actions = [{ id: 'prescription.create', label: 'Ricetta' }];
const run = (text, extra = {}) => resolveQuickPrescription(text, { patients, favorites: F, actions, submitted: true, ...extra });

test('PO case: "amoxicillina e clavulanico per Tizio Caio" → Augmentin with the usual posology', () => {
  const r = run('amoxicillina e clavulanico per Tizio Caio');
  assert.equal(r.documentRequest.type, 'ricetta');
  assert.equal(r.documentRequest.patientId, 1);
  assert.equal(r.documentRequest.farmaci.length, 1, 'one combined drug, not two');
  assert.match(r.documentRequest.farmaci[0].farmaco, /Augmentin/);
  assert.equal(r.documentRequest.farmaci[0].posologia, F.find((f) => /Augmentin/.test(f.farmaco)).posologia);
  assert.match(r.answer, /pronta da verificare.*posologia abituale.*solo quando confermi/);
});

test('other phrasings: "ricetta di…per", "ricetta a…di", "prescrivi…a", brand names, several drugs', () => {
  assert.match(run('Ricetta di ibuprofene per Mario Rossi').documentRequest.farmaci[0].farmaco, /Ibuprofene 600/);
  assert.match(run('prescrivi Augmentin a Tizio Caio').documentRequest.farmaci[0].farmaco, /Augmentin/);
  const two = run('fai una ricetta a Tizio Caio di amoxicillina e ibuprofene').documentRequest.farmaci.map((f) => f.farmaco);
  assert.deepEqual(two, ['Amoxicillina 1 g', 'Ibuprofene 600 mg']);
  assert.equal(run('Tachipirina per Mario Rossi').documentRequest.farmaci[0].farmaco, 'Paracetamolo 1000 mg');
});

// PO: "per ibuprofene 400 già non capisce" (the studio keeps Ibuprofene 600 mg).
test('a dose different from the favorite keeps the said dose, takes the usual posology and asks to check it', () => {
  const r400 = run('ibuprofene 400 per Tizio Caio');
  const [ibu] = r400.documentRequest.farmaci;
  assert.equal(ibu.farmaco, 'Ibuprofene 400 mg');
  assert.equal(ibu.dosaggio, '400 mg');
  assert.match(ibu.posologia, /ogni 8 ore/);
  assert.match(r400.answer, /Ibuprofene 400 mg: ho usato la posologia abituale di Ibuprofene 600 mg, controlla che valga per questa dose/);
  const [amox] = run('amoxicillina 500 mg per Tizio Caio').documentRequest.farmaci;
  assert.equal(amox.farmaco, 'Amoxicillina 500 mg');
  assert.equal(amox.dosaggio, '500 mg');
  // "1" is not a dose of a favorite just because "125" contains it.
  assert.equal(run('augmentin 1 g per Tizio Caio').documentRequest.farmaci[0].dosaggio, '1 g');
});

test('a drug not in the list: name only, posology left to the clinician', () => {
  const r = run('ricetta di metronidazolo per Tizio Caio');
  assert.equal(r.documentRequest.farmaci[0].posologia, '');
  assert.match(r.answer, /completa dosaggio e posologia/);
});

test('patients are never guessed: homonyms and unknown names ask, nothing opens', () => {
  const homonyms = run('ricetta di amoxicillina per Rossi');
  assert.equal(homonyms.documentRequest, undefined);
  assert.match(homonyms.answer, /Mario Rossi, Maria Rossi/);
  const unknown = run('ibuprofene per Pinco Pallino');
  assert.equal(unknown.documentRequest, undefined);
  assert.match(unknown.answer, /Non trovo il paziente/);
});

test('not a quick prescription: agenda, questions, dictated posology, non-drugs', () => {
  for (const s of ['fissa appuntamento Tizio per igiene', 'cosa prescrivo per Tizio Caio?', 'amoxicillina per Tizio Caio ogni 8 ore per 6 giorni', 'preventivo per Mario Rossi', 'controllo per Mario Rossi']) {
    assert.equal(parseQuickPrescription(s, F), null, s);
  }
});

test('never opens on a keystroke preview; respects the Ricetta permission', () => {
  const preview = run('amoxicillina e clavulanico per Tizio Caio', { submitted: false });
  assert.equal(preview.documentRequest, undefined);
  assert.equal(preview.awaitingSubmit, true);
  const denied = run('amoxicillina e clavulanico per Tizio Caio', { actions: [] });
  assert.equal(denied.documentRequest, undefined);
  assert.match(denied.answer, /permessi/);
});

test('combined names stay one line; "e" splits only unrelated drugs', () => {
  assert.equal(prescriptionLines('amoxicillina e acido clavulanico', F).length, 1);
  assert.equal(prescriptionLines('amoxicillina e ibuprofene', F).length, 2);
});

test('processQuery answers from the app, with no model call', async () => {
  const r = await processQuery({ query: 'amoxicillina e clavulanico per Tizio Caio', sources: { patients, actions, farmaciPreferiti: F }, allowModel: true, supabaseClient: null });
  assert.equal(r.intent, 'PRESCRIPTION');
  assert.equal(r.documentRequest.patientId, 1);
});

// PO screenshot: "Zytromax per Andrea Abello" went to the model.
test('drug names typed or dictated with a typo are recognized; studio words never are', () => {
  assert.match(run('Zytromax per Mario Rossi').documentRequest.farmaci[0].farmaco, /Zitromax/);
  assert.match(run('amoxicilina per Mario Rossi').documentRequest.farmaci[0].farmaco, /Amoxicillina/);
  for (const w of ['appuntamento', 'preventivo', 'certificato', 'promemoria', 'radiografia', 'otturazione', 'pulizia', 'messaggio']) {
    assert.equal(run(`${w} per Mario Rossi`), null, w);
  }
});
