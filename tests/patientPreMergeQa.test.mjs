import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { creaRicettaPdf } from '../src/lib/pdfDocs.js';
import { drawFiscalStamp, pdfImageFormat } from '../src/lib/pdfSignature.js';
import { patientWithNote, patientWithRecall, formatClinicalHistoryNote, computeAnamnesiAlert } from '../src/lib/patientQuickActions.js';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('A. Ricetta produce un PDF reale visualizzabile e scaricabile', () => {
  const result = creaRicettaPdf({
    paziente: { nome: 'Mario', cognome: 'Rossi' },
    studio: { nome: 'Studio QA' }, data: '2026-08-26',
    farmaci: [{ nome: 'Farmaco QA', posologia: '1 al giorno' }],
  });
  assert.match(result.dataUrl, /^data:application\/pdf;/);
  assert.equal(result.filename, 'ricetta_Rossi_2026-08-26.pdf');
  assert.ok(result.doc.output('arraybuffer').byteLength > 1000);
});

test('B. Ricetta conserva timbro/firma configurati', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhQGAWjR9WQAAAABJRU5ErkJggg==';
  const base = { paziente: { nome: 'Mario', cognome: 'Rossi' }, studio: { nome: 'Studio QA' }, data: '2026-08-26', farmaci: [{ nome: 'Farmaco QA' }] };
  const unsigned = creaRicettaPdf(base).doc.output('arraybuffer').byteLength;
  const signed = creaRicettaPdf({ ...base, studio: { ...base.studio, firma_b64: png } }).doc.output('arraybuffer').byteLength;
  assert.ok(signed > unsigned);
});

test('DocFiscale conserva e applica firma/timbro configurati PNG o JPEG', () => {
  const calls = [];
  const doc = new Proxy({}, { get: (_, name) => name === 'addImage'
    ? (...args) => calls.push(args)
    : () => {} });
  const firma = 'data:image/jpeg;base64,AA==';
  assert.equal(pdfImageFormat(firma), 'JPEG');
  assert.equal(drawFiscalStamp(doc, { nome: 'Studio', firma_b64: firma }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'JPEG');
});

test('C. Anamnesi produce dati reali salvabili', () => {
  const note = formatClinicalHistoryNote({ risposte: [{ titolo: 'Diabete', valore: 'si', note: 'compensato' }], farmaci: [], allergie: [] }, '2026-08-27');
  assert.match(note, /ANAMNESI 2026-08-27/);
  assert.match(note, /Diabete: Sì \(compensato\)/);
});

// POL-UI-020: Product Owner — la croce anamnesi in header diventa rossa
// lampeggiante "nel caso di allarmi anamnesi" (allergie, malattie
// cardiache, oncologiche ecc, tutte le controindicazioni). Ogni risposta
// "Sì" è di per sé una controindicazione riferita, così come ogni
// allergia — nessuna lista fissa da mantenere a mano.
test('computeAnamnesiAlert segnala allarme per ogni risposta "sì" e ogni allergia, mai per "no"/"non so"', () => {
  const nessunAllarme = computeAnamnesiAlert({
    risposte: [{ chiave: 'fumo', titolo: 'Fumatore', valore: 'no' }, { chiave: 'alcol', titolo: 'Alcol', valore: 'non_so' }],
    farmaci: [], allergie: [],
  });
  assert.equal(nessunAllarme.allarme, false);
  assert.deepEqual(nessunAllarme.dettagli, []);

  const conAllarme = computeAnamnesiAlert({
    risposte: [{ chiave: 'cardiopatie', titolo: 'Cardiopatie', valore: 'si', note: 'stent 2019' }, { chiave: 'fumo', titolo: 'Fumatore', valore: 'no' }],
    farmaci: [], allergie: [{ sostanza: 'Penicillina' }],
  });
  assert.equal(conAllarme.allarme, true);
  assert.equal(conAllarme.dettagli.length, 2);
  assert.ok(conAllarme.dettagli.some((d) => d.chiave === 'cardiopatie' && d.nota === 'stent 2019'));
  assert.ok(conAllarme.dettagli.some((d) => d.titolo === 'Allergia: Penicillina'));
});

const clinicalHistorySource = await source('src/components/PatientClinicalHistory.jsx');

test('REGRESSION GUARD: il salvataggio anamnesi scrive su campi persistiti reali, non più su patient.noteGenerale (mai salvato su DB)', () => {
  assert.doesNotMatch(clinicalHistorySource, /patient\?\.noteGenerale/);
  assert.doesNotMatch(clinicalHistorySource, /noteGenerale:/);
  assert.match(clinicalHistorySource, /anamnesiCompilataIl: new Date\(\)\.toISOString\(\)/);
  assert.match(clinicalHistorySource, /anamnesiNota: section/);
  assert.match(clinicalHistorySource, /anamnesiAllarme: allarme/);
  assert.match(clinicalHistorySource, /anamnesiAllarmeDettagli: dettagli/);
  assert.match(clinicalHistorySource, /computeAnamnesiAlert/);
});

// POL-UI-020: Product Owner — "I tasti azioni veloci in pazienti devono
// essere 6 e messi bene impaginati, metti magari spesa". Da 4 pillole in
// fila a una griglia di 6 tile icona+etichetta, con "Spesa" (riusa
// SpesaModal, associazione paziente precompilata) e "Nuovo piano" (riusa
// l'handler onNuovoPiano già esistente, stesso schema di "Nuovo
// appuntamento").
test('F. Le azioni veloci del paziente sono 6, in una griglia, includono Spesa e Nuovo piano riusando i componenti condivisi', async () => {
  const quick = await source('src/components/PatientQuickActions.jsx');
  assert.match(quick, /gridTemplateColumns: 'repeat\(3, 1fr\)'/);
  const ids = [...quick.matchAll(/\{ id: '([a-z]+)', icon:/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['note', 'recall', 'appointment', 'payment', 'spesa', 'piano']);
  assert.match(quick, /import SpesaModal from '\.\/SpesaModal\.jsx';/);
  assert.match(quick, /<SpesaModal\s*\n\s*initialPazienteId=\{patient\.id\}\s*\n\s*patients=\{\[patient\]\}/);
  assert.match(quick, /onClick: \(\) => onNewPlan\?\.\(patient\.id\)/);

  const scheda = await source('src/components/SchedaPaz.jsx');
  assert.match(scheda, /onNewPlan=\{onNuovoPiano\}/);
  assert.match(scheda, /studioId=\{si\?\.studio_id\}/);
});

test('D-E. Note e richiamo producono aggiornamenti reali', () => {
  const patient = { id: 7, annotazioni: [] };
  assert.equal(patientWithNote(patient, 'anamnesi reale').noteGenerale, 'anamnesi reale');
  const updated = patientWithRecall(patient, 'controllo', '2026-09-01', 8, '2026-08-26');
  assert.deepEqual(updated.annotazioni[0].richiamo, { testo: 'controllo', data: '2026-09-01', fatto: false });
});

test('azioni paziente hanno callback e sincronizzano la scheda aperta', async () => {
  const [quick, app, scheda] = await Promise.all([
    source('src/components/PatientQuickActions.jsx'), source('src/App.jsx'), source('src/components/SchedaPaz.jsx'),
  ]);
  assert.match(quick, /onNewAppointment\?\.\(patient\.id\)/);
  assert.match(quick, /onPatientChange\?\.\(updated\)/);
  assert.match(quick, /setModal\('note'\)/);
  assert.match(quick, /setModal\('recall'\)/);
  assert.match(quick, /setRichiami\?\.\(\(rows\) => \[\.\.\.rows/);
  assert.match(app, /onNuovoAppuntamento=\{\(id\) => \{ setSchedaDashPaz\(null\); goAgendaPaz\(id\); \}\}/);
  assert.match(scheda, /onPatientChange=\{onPatientChange\}/);
});

test('G. SchedaPaz congela il positioning contract di Polyedron durante mount/unmount', async () => {
  const [app, mobile, edge] = await Promise.all([source('src/App.jsx'), source('src/components/poliedron/usePoliedronPosition.js'), source('src/components/poliedron/usePoliedronEdgePosition.js')]);
  assert.match(app, /schedaDashPaz && createPortal\(/);
  assert.match(app, /\), document\.body\)\}/);
  assert.equal((app.match(/<Poliedron\b/g) || []).length, 1);
  assert.match(app, /positionLocked=\{Boolean\(schedaDashPaz\)\}/);
  assert.match(mobile, /lockedPositionRef/);
  assert.match(edge, /lockedPlacementRef/);
});

test('A. Genera PDF resta sopra il dock mobile e usa il generatore storico DocMedico', async () => {
  const doc = await source('src/components/DocMedico.jsx');
  assert.match(doc, /const generaRicetta = \(\) => \{/);
  assert.doesNotMatch(doc, /generaRicettaLegacy|creaRicettaPdf/);
  assert.match(doc, /data-document-scroll="true"[\s\S]*paddingBottom: 'calc\(124px/);
  assert.match(doc, /setPronto\(\{ dataUrl, filename, titolo: 'Ricetta medica'/);
});

test('Foto, fisioterapia e documenti restano lazy/on-demand senza query al mount generale', async () => {
  const scheda = await source('src/components/SchedaPaz.jsx');
  assert.match(scheda, /lazy\(\(\) => import\('\.\/PatientPhotos\.jsx'\)\)/);
  assert.match(scheda, /lazy\(\(\) => import\('\.\/PhysioCartella\.jsx'\)\)/);
  assert.match(scheda, /lazy\(\(\) => import\('\.\/PatientWorkspaceDocuments\.jsx'\)\)/);
  assert.doesNotMatch(scheda.split('export default function SchedaPaz')[0], /supabase\.from/);
});
