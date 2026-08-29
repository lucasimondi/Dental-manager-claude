import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/Piani.jsx', import.meta.url), 'utf8');

test('plan execution UI uses the shared domain completion action', () => {
  assert.match(source, /markTreatmentItemCompleted\(candidate, itemIndex\)/);
  assert.match(source, /Da eseguire/); assert.match(source, /Eseguita/);
});

test('optional quick payment keeps amount date and method editable and records paid state', () => {
  assert.match(source, /Registra pagamento adesso/);
  assert.match(source, /quickPayment\.importo/); assert.match(source, /quickPayment\.data/); assert.match(source, /quickPayment\.metodo/);
  assert.match(source, /stato: 'pagato'/);
});

// Product Owner follow-up: this quick-payment offer was only ever wired
// into Piani.jsx above — SchedaPaz.jsx has its own separate, older
// plan-item rendering (a different "Segna eseguita" toggle, kept for the
// existing richiamo auto-detection side effect) that never got the same
// checkbox, so completing a treatment from the patient record itself never
// offered to register the payment. Same source-level convention as above.
const schedaPazSource = fs.readFileSync(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8');

test('SchedaPaz\'s own plan-item view also offers the quick-payment checkbox after marking a treatment done', () => {
  assert.match(schedaPazSource, /Registra pagamento adesso/);
  assert.match(schedaPazSource, /quickPayment\.importo/); assert.match(schedaPazSource, /quickPayment\.data/); assert.match(schedaPazSource, /quickPayment\.metodo/);
  assert.match(schedaPazSource, /stato: 'pagato'/);
  // The richiamo auto-detection side effect (rilevaRichiamo/addMesi) that
  // makes this toggle different from Piani.jsx's must survive untouched.
  assert.match(schedaPazSource, /rilevaRichiamo\(v\.prestazione\)/);
});

test('REGRESSION GUARD: toggleEseguita computes the offer from the CURRENT execution state, not from a side effect inside the setPlans updater', () => {
  // setPlans's updater function is not guaranteed to run synchronously
  // (React may defer it), so deriving "did this just become executed" as a
  // side effect written inside that updater and read right after calling
  // setPlans would be a real race — nowEseguita must come from the state
  // already available in this render (the wasEseguita argument), not from
  // a variable mutated inside the updater callback.
  assert.match(schedaPazSource, /const toggleEseguita = \(plId, i, wasEseguita\) => \{/);
  assert.match(schedaPazSource, /const nowEseguita = !wasEseguita;/);
  const callSite = schedaPazSource.match(/onClick=\{\(\) => toggleEseguita\([^)]*\)\}/);
  assert.ok(callSite, 'expected a toggleEseguita call site');
  assert.match(callSite[0], /toggleEseguita\(pl\.id, i, v\.eseguita\)/);
});
