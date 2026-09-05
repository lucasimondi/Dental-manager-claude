import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDataHealthScore, DATA_HEALTH_SCORE_CHECK } from '../src/lib/domain/dataHealthScore.js';
import { ACTIVITY_KIND } from '../src/lib/domain/dataHealthActivities.js';

const TODAY = '2026-09-05';

const basePatient = (id, overrides = {}) => ({
  id, nome: 'Nome' + id, cognome: 'Cognome' + id,
  telefono: '333', indirizzo: 'Via Roma 1', cf: 'ABC123', email: 'a@b.it',
  ...overrides,
});

test('a fully-compliant single patient scores 100% across every applicable check', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese: [], today: TODAY,
    financialDataAvailable: false,
  });
  assert.equal(result.percentage, 100);
  for (const check of result.checks) {
    if (check.applicable) assert.equal(check.passRate, 1, `${check.id} should pass`);
  }
});

test('missing anagrafica fields, anamnesi, privacy doc, and an overdue payment all drag the score down and list the patient', () => {
  const patients = [basePatient(1, { telefono: '', email: '' })];
  const plans = [{ id: 10, pazienteId: 1 }];
  const result = computeDataHealthScore({
    patients, plans,
    dataHealthFindings: [{ pazienteId: 1, kind: ACTIVITY_KIND.ANAMNESI_MANCANTE }],
    scadenzeScadute: [{ paz: { id: 1 } }],
    documents: [], implants: [], spese: [], today: TODAY, financialDataAvailable: false,
  });
  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.ANAGRAFICA].passRate, 0);
  assert.deepEqual(byId[DATA_HEALTH_SCORE_CHECK.ANAGRAFICA].missingPatients.map((p) => p.pazienteId), [1]);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.ANAMNESI].passRate, 0);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.PRIVACY].passRate, 0);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.PAGAMENTI].passRate, 0);
  assert.ok(result.percentage < 100);
});

test('patients with no plan at all are excluded from every per-patient check (scope = pazienti attivi)', () => {
  const patients = [basePatient(1), basePatient(2, { telefono: '' })];
  const plans = [{ id: 10, pazienteId: 1 }]; // patient 2 has no plan
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese: [], today: TODAY,
    financialDataAvailable: false,
  });
  const anagrafica = result.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.ANAGRAFICA);
  assert.equal(anagrafica.totalCount, 1);
  assert.equal(anagrafica.passedCount, 1);
});

test('implants check only applies to patients who actually have an implant, and requires marca+modello+lotto', () => {
  const patients = [basePatient(1), basePatient(2)];
  const plans = [{ id: 10, pazienteId: 1 }, { id: 11, pazienteId: 2 }];
  const implants = [
    { pazienteId: 1, marca: 'Nobel', modello: 'X1', lotto: 'L123' },
    { pazienteId: 2, marca: 'Straumann', modello: '', lotto: 'L456' },
  ];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: patients.map((p) => ({ paziente_id: p.id, tipo: 'consenso' })),
    implants, spese: [], today: TODAY, financialDataAvailable: false,
  });
  const impiantiCheck = result.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.IMPIANTI);
  assert.equal(impiantiCheck.totalCount, 2);
  assert.equal(impiantiCheck.passedCount, 1);
  assert.deepEqual(impiantiCheck.missingPatients.map((p) => p.pazienteId), [2]);
});

test('a patient with zero implants does not count in the implants check denominator at all', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese: [], today: TODAY,
    financialDataAvailable: false,
  });
  const impiantiCheck = result.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.IMPIANTI);
  assert.equal(impiantiCheck.applicable, false);
  assert.equal(impiantiCheck.totalCount, 0);
});

test('the four spese-based studio checks are excluded from the score entirely when financial data is not available for this role', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese: [], today: TODAY,
    financialDataAvailable: false,
  });
  assert.ok(!result.checks.some((c) => c.scope === 'studio'));
  assert.equal(result.percentage, 100);
});

test('spese-based studio checks look at recency per category with different windows (utenze/condominio/assicurazioni)', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  const spese = [
    { categoria: 'Utenze', data: '2026-08-20' }, // 16 days ago, within 120
    { categoria: 'Condominio', data: '2025-01-01' }, // way over 366 days ago
    // no 'Assicurazioni' row at all
  ];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese, today: TODAY,
    financialDataAvailable: true,
  });
  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.SPESE_AGGIORNATE].passRate, 1);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.BOLLETTE].passRate, 1);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.CONDOMINIO].passRate, 0);
  assert.equal(byId[DATA_HEALTH_SCORE_CHECK.ASSICURAZIONE].passRate, 0);
});

test('BOLLETTE_QUALITA flags a bolletta whose importo deviates from the median of the prior ones, but only once there is enough history to judge', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  // Product Owner approved this exact logic ("Su quella classifica va
  // bene"): median of PRIOR bollette (never the average, which one wild
  // entry would drag along with it), >=3 prior rows needed before a row
  // counts as evaluated, >50% deviation from that median flags it.
  const spese = [
    { categoria: 'Utenze', data: '2026-01-10', importo: 100 },
    { categoria: 'Utenze', data: '2026-03-10', importo: 110 },
    { categoria: 'Utenze', data: '2026-05-10', importo: 90 }, // 3rd row: not yet evaluated (needs 3 PRIOR rows)
    { categoria: 'Utenze', data: '2026-07-10', importo: 105 }, // 4th row: 3 priors exist (median 100) -> within 50% -> normal
    { categoria: 'Utenze', data: '2026-09-01', importo: 500 }, // 5th row: way off the median of priors -> anomalous
  ];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese, today: TODAY,
    financialDataAvailable: true,
  });
  const check = result.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.BOLLETTE_QUALITA);
  assert.equal(check.applicable, true);
  assert.equal(check.totalCount, 2); // only rows 4 and 5 had >=3 priors
  assert.equal(check.passedCount, 1); // row 4 normal, row 5 anomalous
});

test('BOLLETTE_QUALITA is not applicable at all when there is not enough bollette history to judge anything', () => {
  const patients = [basePatient(1)];
  const plans = [{ id: 10, pazienteId: 1 }];
  const spese = [
    { categoria: 'Utenze', data: '2026-08-20', importo: 100 },
    { categoria: 'Utenze', data: '2026-08-25', importo: 105 },
  ];
  const result = computeDataHealthScore({
    patients, plans, dataHealthFindings: [], scadenzeScadute: [],
    documents: [{ paziente_id: 1, tipo: 'consenso' }], implants: [], spese, today: TODAY,
    financialDataAvailable: true,
  });
  const check = result.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.BOLLETTE_QUALITA);
  assert.equal(check.applicable, false);
});

test('with zero active patients and financial data unavailable, there is nothing applicable and percentage is null (not a misleading 0 or 100)', () => {
  const result = computeDataHealthScore({
    patients: [], plans: [], dataHealthFindings: [], scadenzeScadute: [],
    documents: [], implants: [], spese: [], today: TODAY, financialDataAvailable: false,
  });
  assert.equal(result.percentage, null);
});
