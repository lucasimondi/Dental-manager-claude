import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClinicalFinancialTimeline, mapLegacyTreatmentStatus, planNetTotal, treatmentsFromPlans } from '../src/lib/patientWorkspaceClinicalFinancial.js';

test('plans.voci diventano TREATMENT con id derivato stabile e mapping legacy', () => {
  const plans = [{ id: 7, titolo: 'Piano A', voci: [
    { prestazione: 'Corona', dente: '26', prezzo: 700, eseguita: true },
    { prestazione: 'Igiene', sede: 'Generale', prezzo: 100, stato: 'in_corso' },
  ] }];
  const rows = treatmentsFromPlans(plans);
  assert.equal(rows[0].id, 'plan:7:item:0');
  assert.equal(rows[0].entityType, 'TREATMENT');
  assert.equal(rows[0].status, 'Eseguita');
  assert.equal(rows[1].status, 'In corso');
  assert.equal(rows[1].site, 'Generale');
});

test('totale preventivo riusa semantica sconto reale pct/eur', () => {
  assert.deepEqual(planNetTotal({ voci: [{ prezzo: 100 }, { prezzo: 50 }], sconto: 10, scontoTipo: 'pct' }), { gross: 150, discount: 15, net: 135 });
  assert.deepEqual(planNetTotal({ voci: [{ prezzo: 100 }], sconto: 200, scontoTipo: 'eur' }), { gross: 100, discount: 100, net: 0 });
});

test('stati legacy sconosciuti restano conservativamente Proposta', () => {
  assert.equal(mapLegacyTreatmentStatus({ statoLabel: 'Richiamo da programmare' }), 'Richiamo da programmare');
  assert.equal(mapLegacyTreatmentStatus({ stato: 'valore-futuro' }), 'Proposta');
});

test('timeline aggrega clinica, pagamenti e appuntamenti in ordine', () => {
  const timeline = buildClinicalFinancialTimeline({
    plans: [{ id: 'p', voci: [{ prestazione: 'Igiene', eseguita: true, dataEsec: '2026-08-20' }] }],
    payments: [{ id: 'x', data: '2026-08-21', importo: 50 }],
    appointments: [{ id: 'a', data: '2026-08-19', tipo: 'Controllo' }],
  });
  assert.deepEqual(timeline.map((event) => event.type), ['PAYMENT_RECORDED', 'TREATMENT_COMPLETED', 'APPOINTMENT']);
});
