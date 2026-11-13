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

test('each prestazione is ticked on its own; «Tutte» ticks the rows in view; with several plans each plan has «Tutto il piano»', () => {
  const overview = read('../src/components/PatientDentalOverview.jsx');
  assert.match(overview, /className="patient-dental-pick" checked=\{on\} onChange=\{\(\)=>togglePick\(row\.key\)\}/);
  assert.match(overview, /const togglePick = key => setPicked\(p => p\.includes\(key\) \? p\.filter\(k => k !== key\) : \[\.\.\.p, key\]\);/);
  assert.match(overview, /const toggleAll = \(\) => setPicked\(p => allOn \? p\.filter\(k => !rows\.some\(r => r\.key === k\)\) : \[\.\.\.new Set\(\[\.\.\.p, \.\.\.rows\.map\(r => r\.key\)\]\)\]\);/);
  assert.ok(overview.indexOf('patient-dental-quotebar') < overview.indexOf('<ul>{groups'), 'the quote bar is rendered above the list');
  assert.match(overview, /className="patient-dental-price">\{fmt\(row\.price\)\}/);
  // PO 2026-11-13: quotes may mix plans (no block); the list is split per plan only when there are several.
  assert.doesNotMatch(overview, /pickedPlans\.length !== 1/);
  assert.match(overview, /disabled=\{!pickedRows\.length\} onClick=\{creaPreventivo\}/);
  assert.match(overview, /new Set\(rows\.map\(r => String\(r\.planId\)\)\)\.size > 1/);
  assert.match(overview, /aria-label=\{`Spunta tutto il piano \$\{g\.title\}`\}/);
  assert.match(overview, /sourceRefs: voci\.map\(r => \(\{ planId: r\.planId, index: r\.itemIndex \}\)\)/);
  assert.match(overview, /setPicked\(\[\]\); \/\/ gli indici/);
});

test('«Crea preventivo» opens the quote form filled with the ticked voci (also from several plans); a changed price goes back to its own plan voce', () => {
  const boundary = read('../src/components/PatientWorkspaceBoundary.jsx');
  assert.match(boundary, /sourceRefs:Array\.isArray\(options\?\.sourceRefs\) \? options\.sourceRefs : null/);
  assert.match(boundary, /const ownPlans = \(props\.plans \|\| \[\]\)\.filter\(p => String\(p\.pazienteId\) === String\(props\.paz\.id\)\);/);
  assert.match(boundary, /entry\.sourceRefs\.filter\(r => ownPlans\.some/);
  assert.match(boundary, /String\(c\.planId\) === String\(p\.id\)/);
  assert.match(boundary, /\(plan\.voci\?\.\[c\.index\]\?\.prestazione \|\| 'Prestazione'\) === c\.prestazione \? updateTreatmentItem\(plan, c\.index, \{ prezzo: c\.prezzo \}\) : plan/);
  const entry = read('../src/components/PatientPlanEntry.jsx');
  assert.match(entry, /const selection = !!\(sourcePlan && quote && Array\.isArray\(sourceRefs\) && sourceRefs\.some\(voceRef\)\);/);
  assert.match(entry, /sourcePlanId: r\.planId, sourceIndex: r\.index/);
  assert.match(entry, /\.filter\(c => c\.prezzo !== c\.prima\);/);
  assert.match(entry, /const savedRows = perTooth && !selection \? expandRowsPerTooth\(rows\) : rows;/);
  assert.match(entry, /className="quote-pick-row"/);
});

test('a new prescription is one tap away: header button and a phone window', () => {
  const scheda = read('../src/components/SchedaPaz.jsx');
  assert.match(scheda, /className="patient-clean-rx" onClick=\{\(\) => setDocumentFlow\('ricetta'\)\}/);
  assert.match(scheda, /key="ricetta" className="is-action"[^>]*onClick=\{\(\) => setDocumentFlow\('ricetta'\)\}/);
});

test('on the phone the sections are a grid of windows at the top of the record', () => {
  const scheda = read('../src/components/SchedaPaz.jsx');
  assert.ok(scheda.indexOf('className="patient-record-windows"') < scheda.indexOf('<PatientDentalOverview'), 'section windows come before Denti e cure');
  assert.match(scheda, /onClick=\{\(\) => apriSezione\(t\.id\)\}/);
  assert.match(scheda, /onOpenQuotes=\{\(\) => apriSezione\('preventivi'\)\}/);
  const css = read('../src/components/PatientRecordClean.css');
  assert.match(css, /\.patient-record-windows \{ display:grid; grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
