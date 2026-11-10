// PO 2026-11-10: toccando un dente si aprono le sue prestazioni da fare, ognuna col tasto «Eseguito».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markTreatmentItemCompleted } from '../src/lib/domain/treatmentPlanService.js';
const src = readFileSync(new URL('../src/components/PatientDentalOverview.jsx', import.meta.url), 'utf8');

test('il tocco su un dente con cure da fare mostra «Da eseguire»; il tocco breve seleziona come prima', () => {
  assert.match(src, /if \(!selected\.includes\(d\) && model\.teeth\[d\]\?\.pending > 0\) setFilter\('pending'\);/);
  assert.match(src, /onClick=\{\(\)=>toggle\(d\)\}/);
});

test('«Eseguito» usa la regola canonica dei piani e salva con setPlans', () => {
  assert.match(src, /markTreatmentItemCompleted\(p, row\.itemIndex\)\.plan/);
  assert.match(src, /filter === 'pending' && setPlans \? <button type="button" className="patient-dental-done-button"/);
  assert.match(readFileSync(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8'), /<PatientDentalOverview [^>]*setPlans=\{setPlans\}/);
  const plan = { id: 1, voci: [{ prestazione: 'Otturazione', dente: '36', eseguita: false }, { prestazione: 'Endo', dente: '36', eseguita: false }] };
  const { plan: dopo } = markTreatmentItemCompleted(plan, 0);
  assert.equal(dopo.voci[0].eseguita, true); assert.match(dopo.voci[0].dataEsec, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dopo.voci[1].eseguita, false);
});
