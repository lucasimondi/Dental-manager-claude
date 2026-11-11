// PRESTAZIONI-ELIMINA (PO 2026-11-11): "Le prestazioni devono aver il tasto per cancellarle".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planTotals, paidOnPlan, removeTreatmentItem, treatmentItemRemovalMessage } from '../src/lib/domain/treatmentPlanService.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const plan = { id: 'pl1', sconto: 0, scontoTipo: 'pct', voci: [
  { prestazione: 'Otturazione', dente: '36', prezzo: 100, eseguita: true },
  { prestazione: 'Corona', dente: '46', prezzo: 600, eseguita: false },
] };

test('removing a voce keeps the others and never touches payments', () => {
  const next = removeTreatmentItem(plan, 1);
  assert.deepEqual(next.voci.map((v) => v.prestazione), ['Otturazione']);
  assert.equal(plan.voci.length, 2, 'original plan untouched');
});

test('same totals and paid rule as before (sconto %, €; only «pagato» payments of the plan)', () => {
  assert.deepEqual(planTotals(plan.voci, 10, 'pct'), { sub: 700, scontato: 70, finale: 630 });
  assert.deepEqual(planTotals(plan.voci, 900, 'eur'), { sub: 700, scontato: 700, finale: 0 });
  const payments = [{ pianoId: 'pl1', stato: 'pagato', importo: 300 }, { pianoId: 'pl1', stato: 'da pagare', importo: 50 }, { pianoId: 'x', stato: 'pagato', importo: 99 }];
  assert.equal(paidOnPlan(payments, 'pl1'), 300);
});

test('confirmation warns when the new total falls below what was already paid', () => {
  assert.equal(treatmentItemRemovalMessage(plan, 1, 0), 'Rimuovere questa prestazione dal piano?');
  const msg = treatmentItemRemovalMessage(plan, 1, 300);
  assert.match(msg, /€ 300\.00 di pagamenti collegati/);
  assert.match(msg, /nuovo totale \(€ 100\.00\)/);
  assert.match(msg, /€ 200\.00 diventerà un acconto libero sul piano\. Il pagamento non verrà cancellato\./);
});

test('«Denti e cure» rows have a delete button with confirmation; Piani drill-down uses the same rule', () => {
  const overview = read('../src/components/PatientDentalOverview.jsx');
  assert.match(overview, /className="patient-dental-delete-button"/);
  assert.match(overview, /window\.confirm\(treatmentItemRemovalMessage\(plan, row\.itemIndex, paidOnPlan\(payments, plan\.id\)\)\)/);
  assert.match(overview, /\(voce\.prestazione \|\| 'Prestazione'\) !== row\.name\) return;/);
  assert.match(read('../src/components/SchedaPaz.jsx'), /<PatientDentalOverview patientId=\{paz\.id\} plans=\{patPlans\} payments=\{payments\}/);
  const drill = read('../src/components/PianoDrillDown.jsx');
  assert.match(drill, /confirm\(treatmentItemRemovalMessage\(plan, index, totalePagatoPiano\(plan\.id\)\)\)/);
  assert.match(drill, /const totalePagatoPiano = \(planId\) => paidOnPlan\(payments, planId\);/);
});
