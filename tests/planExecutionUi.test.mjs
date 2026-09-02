import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-FIN-007: Piani.jsx's and SchedaPaz.jsx's own, separate plan-item
// rendering (this test file's previous target) were unified into one
// shared component — Product Owner: "così anche il modulo Piano del
// paziente deve avere la stessa grafica di piani generale, con tutti i
// tastini". Both callers now render PianoDrillDown.jsx, so the execution
// UI regression guards below target that shared component instead.
const source = fs.readFileSync(new URL('../src/components/PianoDrillDown.jsx', import.meta.url), 'utf8');

test('plan execution UI uses the shared domain completion action', () => {
  assert.match(source, /markTreatmentItemCompleted\(candidate, index\)/);
  assert.match(source, /Segna eseguita/); assert.match(source, /Eseguita/);
});

test('marking a prestazione done offers to register the incasso right away, reusing the same IncassoModal everywhere', () => {
  assert.match(source, /Registra incasso adesso/);
  assert.match(source, /import IncassoModal from '\.\/IncassoModal\.jsx';/);
  assert.match(source, /setIncassoPrefill\(\{ pazienteId: String\(pl\.pazienteId\), lockedPianoId: pl\.id, importo: String\(v\.prezzo/);
});

// The richiamo auto-detection side effect (rilevaRichiamo/addMesi) that
// SchedaPaz.jsx's own older toggle used to have must survive the
// unification, not be silently dropped.
test('marking a prestazione done still auto-suggests a richiamo when the procedure name matches a known pattern', () => {
  assert.match(source, /rilevaRichiamo\(already\.prestazione\)/);
  assert.match(source, /richiamoTipo: r\.tipo, richiamoData: addMesi\(today\(\), r\.mesi\)/);
});

test('REGRESSION GUARD: toggleEseguita reads the execution state from the render-time plan, not from inside the setPlans updater', () => {
  assert.match(source, /const toggleEseguita = \(plan, index\) => \{/);
  assert.match(source, /const voce = plan\.voci\[index\];/);
  assert.match(source, /if \(!voce\.eseguita\) \{/);
  const callSite = source.match(/onClick=\{\(\) => toggleEseguita\([^)]*\)\}/);
  assert.ok(callSite, 'expected a toggleEseguita call site');
  assert.match(callSite[0], /toggleEseguita\(pl, i\)/);
});

// POL-FIN-007: completing the last prestazione must never silently
// overwrite an accettato/rifiutato decision — "concluso"/"terminato" is a
// purely computed display label now, never stored back into plan.stato.
test('REGRESSION GUARD: completing a plan never overwrites its accettato/rifiutato decision', () => {
  assert.doesNotMatch(source, /stato:\s*tutteEseguite/);
  assert.doesNotMatch(source, /stato:\s*['"]concluso['"]/);
  assert.match(source, /isTreatmentPlanCompleted/);
});

const service = fs.readFileSync(new URL('../src/lib/domain/treatmentPlanService.js', import.meta.url), 'utf8');

test('REGRESSION GUARD: the shared completion action itself never promotes plan.stato to concluso any more', () => {
  assert.doesNotMatch(service, /stato:\s*tutteEseguite/);
  assert.match(service, /export const isTreatmentPlanCompleted/);
});
