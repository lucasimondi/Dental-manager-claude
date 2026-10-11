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
  assert.match(r.answer, /pronta da verificare.*posologia abituale.*Controllala e generala tu/);
});

test('other phrasings: "ricetta di…per", "ricetta a…di", "prescrivi…a", brand names, several drugs', () => {
  assert.match(run('Ricetta di ibuprofene per Mario Rossi').documentRequest.farmaci[0].farmaco, /Ibuprofene 600/);
  assert.match(run('prescrivi Augmentin a Tizio Caio').documentRequest.farmaci[0].farmaco, /Augmentin/);
  const two = run('fai una ricetta a Tizio Caio di amoxicillina e ibuprofene').documentRequest.farmaci.map((f) => f.farmaco);
  assert.deepEqual(two, ['Amoxicillina 1 g', 'Ibuprofene 600 mg']);
  assert.equal(run('Tachipirina per Mario Rossi').documentRequest.farmaci[0].farmaco, 'Paracetamolo 1000 mg');
});

test('a dose different from the favorite, or a drug not in the list: name only, posology left to the clinician', () => {
  const [line] = run('amoxicillina 500 mg per Tizio Caio').documentRequest.farmaci;
  assert.equal(line.farmaco, 'Amoxicillina 500 mg');
  assert.equal(line.posologia, '');
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
