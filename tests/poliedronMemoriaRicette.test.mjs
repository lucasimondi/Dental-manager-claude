import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as edge from '../supabase/functions/agente-assistente/memoria.js';
import * as client from '../src/lib/poliedron/memoryRepository.js';
import { unisciFarmaciPreparati } from '../src/lib/farmaciPreferiti.js';
import { documentRequestFromModel, processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { resolvePrescriptionRequest } from '../src/lib/poliedron/prescriptionWorkflow.js';
import { ACTION_REGISTRY } from '../src/lib/poliedron/actionRegistry.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';

// POL-AI-009 — Poliedron ricorda, prepara le ricette e impara da quelle generate.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../supabase/functions/agente-assistente/index.ts');
const migration = read('../supabase/migrations/20261006120000_pol_ai_009_poliedron_memoria.sql');
const controller = read('../src/components/poliedron/Poliedron.jsx');
const chatPage = read('../src/components/poliedron/PoliedronChatPage.jsx');
const docMedico = read('../src/components/DocMedico.jsx');
const app = read('../src/App.jsx');

const patients = [
  { id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' },
  { id: 'p2', nome: 'Laura', cognome: 'Bianchi', cf: '', telefono: '' },
];

const DOC = {
  tipo: 'ricetta',
  paziente_id: 'p1',
  paziente_nome: 'Mario Rossi',
  farmaci: [{ farmaco: 'Amoxicillina 1 g', dosaggio: '1 g', posologia: '1 compressa ogni 8 ore', durata: 'Per 6 giorni', note: '' }],
};

test('memory key and text are identical in the Edge Function and in the app', () => {
  const samples = [
    { farmaco: '  Amoxicillina   1 g ', dosaggio: '1 g', posologia: '1 compressa ogni 8 ore', durata: 'Per 6 giorni', note: '' },
    { farmaco: 'Ibuprofene 600 mg', posologia: 'al bisogno', note: 'a stomaco pieno' },
    { farmaco: 'Clorexidina', dosaggio: '', posologia: '', durata: '' },
  ];
  for (const f of samples) {
    assert.equal(edge.chiaveFarmaco(f.farmaco), client.chiaveFarmaco(f.farmaco));
    assert.equal(edge.testoPrescrizione(f), client.testoPrescrizione(f));
  }
  assert.equal(edge.chiaveFarmaco('  Amoxicillina   1 g '), 'farmaco:amoxicillina 1 g');
  assert.equal(edge.testoPrescrizione(samples[0]), 'Amoxicillina 1 g: dosaggio 1 g, 1 compressa ogni 8 ore, Per 6 giorni');
  assert.equal(edge.chiaveFarmaco(''), null);
});

test('ricorda: valid category, key only for a prescription with its drug, empty text refused', () => {
  assert.deepEqual(edge.normalizzaMemoria({ testo: ' Preferisce   risposte brevi ', categoria: 'preferenza' }), { categoria: 'preferenza', chiave: null, testo: 'Preferisce risposte brevi' });
  assert.equal(edge.normalizzaMemoria({ testo: 'x', categoria: 'clinica' }).categoria, 'altro');
  assert.equal(edge.normalizzaMemoria({ testo: 'Augmentin 1 cp ogni 12 ore', categoria: 'prescrizione', farmaco: 'Augmentin' }).chiave, 'farmaco:augmentin');
  assert.equal(edge.normalizzaMemoria({ testo: 'x', categoria: 'preferenza', farmaco: 'Augmentin' }).chiave, null);
  assert.equal(edge.normalizzaMemoria({ testo: 'a'.repeat(900), categoria: 'altro' }).testo.length, 500);
  assert.throws(() => edge.normalizzaMemoria({ testo: '   ', categoria: 'altro' }), /mancante/);
});

test('the memory section of the prompt lists ids and stays within its character budget', () => {
  assert.match(edge.sezioneMemoria([]), /Ancora niente/);
  const righe = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, categoria: 'altro', testo: `voce numero ${i + 1} `.repeat(10) }));
  const sezione = edge.sezioneMemoria(righe);
  assert.match(sezione, /- \[1\] \(altro\) voce numero 1/);
  assert.ok(sezione.length < edge.MAX_CARATTERI_MEMORIA_PROMPT + 400);
  assert.doesNotMatch(sezione, /\[200\]/);
  assert.equal(edge.sezioneFarmaciFrequenti(null), '');
  assert.match(edge.sezioneFarmaciFrequenti([{ farmaco: 'Ibuprofene 600 mg', posologia: '1 cp ogni 8 ore' }]), /- Ibuprofene 600 mg: 1 cp ogni 8 ore/);
});

test('prepara_ricetta: patient id required, empty drugs dropped, at most 10, no PDF in the result', () => {
  assert.throws(() => edge.normalizzaRicetta({ farmaci: [{ farmaco: 'x' }] }), /paziente_id/);
  assert.throws(() => edge.normalizzaRicetta({ paziente_id: 3, farmaci: [{ farmaco: '  ' }] }), /almeno un farmaco/);
  const many = Array.from({ length: 14 }, (_, i) => ({ farmaco: `F${i}` }));
  const { pazienteId, farmaci } = edge.normalizzaRicetta({ paziente_id: '7', farmaci: [{ farmaco: '' }, ...many] });
  assert.equal(pazienteId, 7);
  assert.equal(farmaci.length, 9);
  assert.deepEqual(farmaci[0], { farmaco: 'F0', dosaggio: '', posologia: '', durata: '', note: '' });
  const doc = edge.documentoRicetta({ id: 7, nome: 'Mario', cognome: 'Rossi' }, farmaci);
  assert.deepEqual(Object.keys(doc).sort(), ['farmaci', 'paziente_id', 'paziente_nome', 'tipo']);
  assert.equal(edge.STRUMENTO_RICETTA.name, 'prepara_ricetta');
  assert.match(edge.STRUMENTO_RICETTA.description, /Non inventare mai farmaci o dosi/);
});

test('Edge Function wiring: memory read under the user login, tools added only where allowed, document returned', () => {
  assert.match(index, /supabase\.from\("poliedron_memoria"\)\.select\("id, categoria, testo"\)\.eq\("studio_id", studioId\)\.eq\("user_id", user\.id\)/);
  assert.match(index, /if \(memoriaAttiva\) toolsFinali = \[\.\.\.toolsFinali, \.\.\.STRUMENTI_MEMORIA\];/);
  assert.match(index, /if \(prescrive && lettureAmmesse\) toolsFinali = \[\.\.\.toolsFinali, STRUMENTO_RICETTA\];/);
  // Tools are added before the allow-list is computed, so the loop's permission check covers them.
  assert.ok(index.indexOf('STRUMENTO_RICETTA];') < index.indexOf('const allowedNames = new Set(toolsFinali.map'));
  assert.match(index, /\.from\('patients'\)\.select\('id, nome, cognome'\)\.eq\('id', pazienteId\)\.eq\('studio_id', studioId\)/);
  assert.match(index, /const conDocumento = documentoPreparato \? \{ \.\.\.value, documento: documentoPreparato \} : value;/);
  assert.match(index, /\.from\('poliedron_memoria'\)\.delete\(\)\.eq\('id', Number\(input\.id\)\)\.eq\('user_id', user\.id\)/);
  assert.doesNotMatch(index, /Documenti, ricette, piani di cura e pagamenti per ora vanno fatti nei moduli/);
  // The old auto-generating tool stays unreachable.
  assert.doesNotMatch(index, /toolsFinali = \[[^\]]*compila_ricetta_medica/);
});

test('migration: owner-only RLS, active membership, revoked defaults, 300-row cap', () => {
  assert.match(migration, /ALTER TABLE public\.poliedron_memoria ENABLE ROW LEVEL SECURITY;/);
  assert.match(migration, /user_id = \(SELECT auth\.uid\(\)\)\s+AND EXISTS \(\s+SELECT 1 FROM public\.studio_users su/);
  assert.match(migration, /su\.stato = 'attivo'/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.poliedron_memoria FROM PUBLIC, anon, authenticated;/);
  assert.match(migration, />= 300 THEN/);
  assert.match(migration, /UNIQUE \(studio_id, user_id, chiave\)/);
});

test('learning from a generated prescription: one entry per drug with posology or duration, no patient data', () => {
  const righe = client.vociDaRicetta([
    { farmaco: 'Amoxicillina 1 g', posologia: '1 cp ogni 8 ore', durata: 'Per 6 giorni' },
    { farmaco: 'amoxicillina 1 g', posologia: 'altro' },
    { farmaco: 'Clorexidina' },
    { farmaco: '' },
  ], { studioId: 's1', userId: 'u1' });
  assert.equal(righe.length, 1);
  assert.deepEqual(Object.keys(righe[0]).sort(), ['categoria', 'chiave', 'origine', 'studio_id', 'testo', 'user_id']);
  assert.equal(righe[0].origine, 'ricetta');
  assert.equal(client.vociDaRicetta([{ farmaco: 'X', posologia: 'y' }], { studioId: null, userId: 'u1' }).length, 0);
});

test('imparaDaRicetta upserts on the drug key and never throws', async () => {
  let call = null;
  const fake = { from: (table) => ({ upsert: async (rows, opts) => { call = { table, rows, opts }; return { error: null }; } }) };
  const n = await client.imparaDaRicetta(fake, { studioId: 's1', userId: 'u1', farmaci: [{ farmaco: 'Ibuprofene', posologia: 'al bisogno' }] });
  assert.equal(n, 1);
  assert.equal(call.table, 'poliedron_memoria');
  assert.deepEqual(call.opts, { onConflict: 'studio_id,user_id,chiave' });
  const failing = { from: () => ({ upsert: async () => { throw new Error('relation does not exist'); } }) };
  assert.equal(await client.imparaDaRicetta(failing, { studioId: 's1', userId: 'u1', farmaci: [{ farmaco: 'X', durata: '3 giorni' }] }), 0);
});

test('a prepared prescription fills the form: same drug replaced, empty rows reused, others appended', () => {
  const vuota = { farmaco: '', dosaggio: '', posologia: '', durata: '', note: '' };
  const lista = unisciFarmaciPreparati(
    [{ ...vuota, farmaco: 'Amoxicillina 1 g' }, vuota],
    [
      { farmaco: 'amoxicillina 1 g', posologia: '1 cp ogni 12 ore', durata: 'Per 5 giorni' },
      { farmaco: 'Ibuprofene 600 mg', posologia: 'al bisogno' },
      { farmaco: 'Pantoprazolo 20 mg' },
      { farmaco: '   ' },
    ],
  );
  assert.equal(lista.length, 3);
  assert.equal(lista[0].posologia, '1 cp ogni 12 ore');
  assert.equal(lista[1].farmaco, 'Ibuprofene 600 mg');
  assert.equal(lista[2].farmaco, 'Pantoprazolo 20 mg');
});

test('a prescription with posology or several drugs goes to Poliedron; a plain one keeps the deterministic form', async () => {
  assert.equal(resolvePrescriptionRequest('crea ricetta per Mario Rossi Amoxicillina 875mg', patients).hasDetails, false);
  assert.equal(resolvePrescriptionRequest('crea ricetta per Mario Rossi Amoxicillina 875mg una compressa ogni 8 ore per 7 giorni', patients).hasDetails, true);
  assert.equal(resolvePrescriptionRequest('crea ricetta per Mario Rossi Amoxicillina e Ibuprofene', patients).hasDetails, true);

  const calls = [];
  const supabaseClient = { functions: { invoke: async (name, { body }) => { calls.push(body); return { data: { text: 'Ho preparato la ricetta: controllala.', documento: DOC }, error: null }; } } };
  const sources = { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY };
  const detailed = await processQuery({
    query: 'crea ricetta per Mario Rossi Amoxicillina 1 g una compressa ogni 8 ore per 6 giorni',
    context: buildContext(), permissions: {}, sources, supabaseClient, allowModel: true,
  });
  assert.equal(calls.length, 1);
  assert.equal(detailed.answer, 'Ho preparato la ricetta: controllala.');
  assert.deepEqual(detailed.documentRequest, { type: 'ricetta', patientId: 'p1', patientName: 'Mario Rossi', farmaci: DOC.farmaci });

  const plain = await processQuery({
    query: 'crea ricetta per Mario Rossi Amoxicillina 875mg',
    context: buildContext(), permissions: {}, sources, supabaseClient, allowModel: true,
  });
  assert.equal(plain.intent, 'WORKFLOW');
  assert.equal(calls.length, 1);

  const preview = await processQuery({
    query: 'crea ricetta per Mario Rossi Amoxicillina 1 g una compressa ogni 8 ore',
    context: buildContext(), permissions: {}, sources, supabaseClient, allowModel: false,
  });
  assert.equal(preview.intent, 'WORKFLOW');
  assert.equal(calls.length, 1);
});

test('only a well-formed prescription from the model becomes a document request', () => {
  assert.equal(documentRequestFromModel({ raw: {} }), null);
  assert.equal(documentRequestFromModel({ raw: { documento: { ...DOC, tipo: 'certificato' } } }), null);
  assert.equal(documentRequestFromModel({ raw: { documento: { ...DOC, farmaci: [{ farmaco: ' ' }] } } }), null);
  assert.equal(documentRequestFromModel({ raw: { documento: { ...DOC, paziente_id: null } } }), null);
  const req = documentRequestFromModel({ raw: { documento: { ...DOC, farmaci: [{ farmaco: 'X', posologia: 3 }] } } });
  assert.deepEqual(req.farmaci, [{ farmaco: 'X', dosaggio: '', posologia: '', durata: '', note: '' }]);
});

test('app wiring: patient from the studio list, Ricetta permission, review banner, learning after generation', () => {
  assert.match(controller, /const patient = \(patients \|\| \[\]\)\.find\(\(p\) => String\(p\.id\) === String\(documentRequest\.patientId\)\);/);
  assert.match(controller, /const allowed = actions\.some\(\(action\) => action\.id === 'prescription\.create'\);/);
  assert.match(controller, /openPrescription\(\{ patient, farmaci: documentRequest\.farmaci \}\)/);
  assert.match(app, /const prefill = Array\.isArray\(farmaci\) && farmaci\.length \? \{ farmaco: '', farmaci \} : \{ farmaco: drug \};/);
  assert.match(docMedico, /Compilata da Poliedron\.<\/strong> Controlla farmaci, dosi e durata prima di generare la ricetta\./);
  assert.match(docMedico, /void imparaDaRicetta\(supabase, \{ studioId, userId, farmaci: farmaci\.filter\(\(f\) => f\.farmaco\.trim\(\)\) \}\);/);
  // Learning happens only when the ricetta PDF is generated, not on prefill.
  assert.ok(docMedico.indexOf('void imparaDaRicetta') > docMedico.indexOf('const generaRicetta = () => {'));
  assert.ok(docMedico.indexOf('void imparaDaRicetta') < docMedico.indexOf('const generaEsamiEmatici = () => {'));
});

test('chat: memory panel reachable from the header, attached file stays in use until removed', () => {
  assert.match(chatPage, /aria-label="Cosa ricorda Poliedron"/);
  assert.match(chatPage, /<PoliedronMemoryPanel client=\{memoryClient\}/);
  assert.match(controller, /memoryClient=\{supabaseClient\}/);
  assert.match(controller, /setChatAttachment\(\(current\) => \(current === attachment \? \{ \.\.\.attachment, inUse: true \} : current\)\)/);
  assert.match(chatPage, /`In uso: \$\{attachment\.name\}`/);
});
