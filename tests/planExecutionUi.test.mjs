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
