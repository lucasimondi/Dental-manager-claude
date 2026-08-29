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

// Product Owner follow-up (payments/incassi architecture audit): "Da
// incassare"/"Incassata" used to be a purely cosmetic per-item flag,
// completely disconnected from the real payments table — clicking it never
// changed what "Incassato"/"Da incassare" showed anywhere else in the app.
// The button must now perform a real action: marking a voce "Incassata"
// registers a real payment (moving the canonical saldo_piano), and
// reverting removes that same payment — in both Piani.jsx and
// SchedaPaz.jsx, which each keep their own separate rendering of plan
// items (see the SchedaPaz test above).
for (const [label, src] of [['Piani.jsx', source], ['SchedaPaz.jsx', schedaPazSource]]) {
  test(`${label}: the Incassata/Da incassare button performs a real payment action, not a cosmetic flag toggle`, () => {
    assert.match(src, /const onIncassataClick = \(plan, itemIndex\) => \{/);
    // Not yet incassata -> opens the same quick-payment form used elsewhere,
    // never a bare flag flip.
    assert.match(src, /if \(!item\.incassata\) \{ openQuickPayment\(plan, itemIndex\); return; \}/);
    // Already incassata -> confirms, then removes the SAME payment that was
    // created for it (no silent/implicit deletion — see paymentId below).
    assert.match(src, /confirm\(/);
    assert.match(src, /Annullare l.{1,2}incasso/);
    assert.match(src, /current\.filter\(\(payment\) => payment\.id !== paymentId\)/);
    assert.match(src, /incassata: false, paymentId: null/);
    // Saving the quick payment must link the created payment back to the
    // voce (paymentId) and flip incassata to true, so the two states can
    // never diverge from what get_saldo_piano/get_saldi_aperti_studio show.
    assert.match(src, /const paymentId = uid\(\);/);
    assert.match(src, /incassata: true, paymentId/);
    // Call site uses the new handler, not the old toggle.
    assert.match(src, /onClick=\{\(\) => onIncassataClick\(pl, i\)\}/);
    assert.equal(/\btoggleIncassata\b/.test(src), false, `${label} must not keep the old cosmetic toggleIncassata`);
  });
}
