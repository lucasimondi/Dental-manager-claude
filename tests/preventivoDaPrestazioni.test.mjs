// PREVENTIVO-DA-PRESTAZIONI (PO 2026-11-12): "sotto prestazioni deve esserci subito il tasto preventivo,
// devono essere selezionabili tutte insieme o una ad una e con un tasto si genera"; modifica e
// cancellazione restano; il prezzo si cambia sia nelle prestazioni sia nel preventivo; sezioni
// raggiungibili facilmente (finestre in cima alla scheda sul telefono).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { updateTreatmentItem } from '../src/lib/domain/treatmentPlanService.js';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('updateTreatmentItem changes only the given fields of one voce and keeps the rest', () => {
  const plan = { id: 1, voci: [{ prestazione: 'Corona', dente: '46', prezzo: 600, eseguita: true, dataEsec: '2026-11-01' }, { prestazione: 'Igiene', prezzo: 85 }] };
  const dopo = updateTreatmentItem(plan, 0, { prezzo: '550' });
  assert.deepEqual(dopo.voci[0], { prestazione: 'Corona', dente: '46', prezzo: 550, eseguita: true, dataEsec: '2026-11-01' });
  assert.equal(dopo.voci[1], plan.voci[1]);
  assert.equal(plan.voci[0].prezzo, 600, 'the original plan is not mutated');
  assert.deepEqual(updateTreatmentItem(plan, 1, { prestazione: '  Igiene prof. ', dente: ' ', prezzo: '' }).voci[1], { prestazione: 'Igiene prof.', dente: '', prezzo: 0 });
  assert.equal(updateTreatmentItem(plan, 5, { prezzo: 1 }), plan);
});

test('Piani «Modifica» and Denti e cure «Modifica» use the same shared rule', () => {
  assert.match(read('../src/components/PianoDrillDown.jsx'), /updateTreatmentItem\(pl, editingVoce\.index, editVoceForm\)/);
  const overview = read('../src/components/PatientDentalOverview.jsx');
  assert.match(overview, /updateTreatmentItem\(p, row\.itemIndex, \{ prestazione, dente, prezzo \}\)/);
  assert.match(overview, /className="patient-dental-edit-button"/);
  assert.match(overview, /className="patient-dental-delete-button"/);
});

test('each prestazione is ticked on its own; «Tutte» ticks the rows in view; the quote button sits on top of the list', () => {
  const overview = read('../src/components/PatientDentalOverview.jsx');
  assert.match(overview, /className="patient-dental-pick" checked=\{on\} onChange=\{\(\)=>togglePick\(row\.key\)\}/);
  assert.match(overview, /const togglePick = key => setPicked\(p => p\.includes\(key\) \? p\.filter\(k => k !== key\) : \[\.\.\.p, key\]\);/);
  assert.match(overview, /const toggleAll = \(\) => setPicked\(p => allOn \? p\.filter\(k => !rows\.some\(r => r\.key === k\)\) : \[\.\.\.new Set\(\[\.\.\.p, \.\.\.rows\.map\(r => r\.key\)\]\)\]\);/);
  assert.ok(overview.indexOf('patient-dental-quotebar') < overview.indexOf('<ul>{rows.map'), 'the quote bar is rendered above the list');
  assert.match(overview, /className="patient-dental-price">\{fmt\(row\.price\)\}/);
  // One quote comes from one plan; deleting a voce resets the ticks (indexes shift).
  assert.match(overview, /pickedPlans\.length !== 1/);
  assert.match(overview, /sourcePlanId: voci\[0\]\.planId, sourceItems: voci\.map\(r => r\.itemIndex\)/);
  assert.match(overview, /setPicked\(\[\]\); \/\/ gli indici/);
});

test('«Crea preventivo» opens the quote form filled with the ticked voci; a changed price goes back to the plan voce', () => {
  const boundary = read('../src/components/PatientWorkspaceBoundary.jsx');
  assert.match(boundary, /sourcePlanId:options\?\.sourcePlanId \?\? null,sourceItems:Array\.isArray\(options\?\.sourceItems\)/);
  assert.match(boundary, /String\(p\.pazienteId\) === String\(props\.paz\.id\)/);
  assert.match(boundary, /\(plan\.voci\?\.\[c\.index\]\?\.prestazione \|\| 'Prestazione'\) === c\.prestazione \? updateTreatmentItem\(plan, c\.index, \{ prezzo: c\.prezzo \}\) : plan/);
  const entry = read('../src/components/PatientPlanEntry.jsx');
  assert.match(entry, /const selection = !!\(sourcePlan && quote && Array\.isArray\(sourceItems\)/);
  assert.match(entry, /sourceIndex: i \}\)\)/);
  assert.match(entry, /\.filter\(c => c\.prezzo !== c\.prima\);/);
  assert.match(entry, /const savedRows = perTooth && !selection \? expandRowsPerTooth\(rows\) : rows;/);
  assert.match(entry, /className="quote-pick-row"/);
});

test('on the phone the sections are a grid of windows at the top of the record', () => {
  const scheda = read('../src/components/SchedaPaz.jsx');
  assert.ok(scheda.indexOf('className="patient-record-windows"') < scheda.indexOf('<PatientDentalOverview'), 'section windows come before Denti e cure');
  assert.match(scheda, /onClick=\{\(\) => apriSezione\(t\.id\)\}/);
  assert.match(scheda, /onOpenQuotes=\{\(\) => apriSezione\('preventivi'\)\}/);
  const css = read('../src/components/PatientRecordClean.css');
  assert.match(css, /\.patient-record-windows \{ display:grid; grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
