// POLIEDRON-RIORDINO / POLIEDRON-RICETTA (PO 2026-11-11): "Il poliedron quando lo apro mi dà una
// serie di sezioni che diventano dei doppioni rispetto a tasto studio … il tasto ricetta crea deve
// essere immediato e completo … dobbiamo aprire con il tasto ricetta il form per la ricetta".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestedIdle } from '../src/lib/poliedron/searchEngine.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { ACTION_REGISTRY, findAction } from '../src/lib/poliedron/actionRegistry.js';
import { resolvePrescriptionRequest } from '../src/lib/poliedron/prescriptionWorkflow.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const poliedron = read('../src/components/poliedron/Poliedron.jsx');
const preview = read('../src/components/poliedron/PoliedronActionPreview.jsx');
const app = read('../src/App.jsx');

test('opening Poliedron shows only quick actions (Ricetta included), no sections', () => {
  const idle = suggestedIdle({ actions: ACTION_REGISTRY, navigationIndex: NAVIGATION_INDEX, context: {} });
  assert.deepEqual(idle.map((g) => g.group), ['AZIONI E WORKFLOW']);
  assert.ok(idle[0].items.some((item) => item.id === 'prescription.create'));
  assert.ok(idle[0].items.every((item) => item.kind === 'action'));
});

test('Ricetta action without a patient opens the prescription form (patient searched inside it)', () => {
  const calls = [];
  findAction('prescription.create').navigate({ openPrescription: (args) => calls.push(args) }, undefined);
  assert.deepEqual(calls, [{ patient: null, drug: '' }]);
  const patient = { id: 7, nome: 'Mario', cognome: 'Rossi' };
  findAction('prescription.create').navigate({ openPrescription: (args) => calls.push(args) }, patient, { drug: 'Amoxicillina' });
  assert.deepEqual(calls[1], { patient, drug: 'Amoxicillina' });
});

test('the Ricetta tile no longer rewrites the query to «crea ricetta»', () => {
  assert.doesNotMatch(poliedron, /setQuery\('crea ricetta'\)/);
});

test('an unrecognised patient no longer yields random patients; the form opens with search', () => {
  const patients = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, nome: `Nome${i}`, cognome: `Cognome${i}` }));
  const result = resolvePrescriptionRequest('crea ricetta', patients);
  assert.deepEqual(result.patientCandidates, []);
  assert.deepEqual(result.patientOptions, []);
  assert.match(preview, /!patient && isPrescription && !entities\?\.drugNeedsClarification && \(\s*<Btn ch="Apri modulo Ricetta" onClick=\{\(\) => onConfirm\(primary, null\)\}/);
  assert.match(poliedron, /const patient = selectedPatient === null \? null : \(selectedPatient \|\| state\?\.entities\?\.patientCandidates\?\.\[0\]\);/);
});

test('App opens RicettaConRicerca when openPrescription has no patient', () => {
  assert.match(app, /if \(!patient\) \{ setRicettaLibera\(\{ prefill, requestId: requestId\(\) \}\); return; \}/);
  assert.match(app, /\{ricettaLibera && \(\s*<RicettaConRicerca/);
  assert.match(app, /initialPrefill=\{ricettaLibera\.prefill\}/);
});
