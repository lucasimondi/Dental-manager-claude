import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SIGNAL_TAXONOMY,
  SIGNAL_TYPE,
  SIGNAL_WEIGHTS,
  clearIntelligenceCache,
  classifyIntelligenceQuery,
  scanPatientOpportunities,
} from '../src/lib/poliedron/intelligence/index.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildIntelligencePermissions } from '../src/lib/poliedron/permissionEngine.js';

const STUDIO_A = 'studio-a';
const STUDIO_B = 'studio-b';
const TODAY = '2026-08-23';
const allPermissions = {
  activeMember: true,
  operations: true,
  clinical: true,
  financial: true,
};

const patient = (id = 'p1', overrides = {}) => ({
  id,
  studio_id: STUDIO_A,
  nome: 'Mario',
  cognome: `Rossi ${id}`,
  ...overrides,
});

test('an unresolved explicit patient relation never falls back to a different name match', () => {
  const result = scan({
    patients: [patient('p1', { nome: 'Anna', cognome: 'Bianchi' })],
    activities: [{
      id: 'task-1',
      studio_id: STUDIO_A,
      pazienteId: 'missing-patient',
      testo: 'Richiamare Anna Bianchi',
      fatto: false,
    }],
  });
  assert.ok(result.results.every((row) => !row.signals.some((signal) => signal.type === SIGNAL_TYPE.OPEN_ACTIVITY)));
});

const acceptedPlan = (patientId = 'p1', overrides = {}) => ({
  id: `plan-${patientId}`,
  studio_id: STUDIO_A,
  pazienteId: patientId,
  stato: 'accettato',
  titolo: 'Piano verificato',
  data: '2026-07-01',
  voci: [{ prestazione: 'Terapia A', eseguita: false }],
  ...overrides,
});

test('hygiene configured for today is due, not falsely described as overdue', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{
        prestazione: 'Igiene orale',
        eseguita: true,
        dataEsec: '2026-02-23',
        richiamoData: TODAY,
      }],
    })],
  });
  assert.ok(!signalsOf(result).some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
});

const scan = (sources, overrides = {}) => scanPatientOpportunities({
  studioId: STUDIO_A,
  today: TODAY,
  vertical: 'dentistico',
  permissions: allPermissions,
  sources,
  useCache: false,
  ...overrides,
});

const signalsOf = (result, patientId = 'p1') => (
  result.results.find((item) => String(item.patientId) === String(patientId))?.signals || []
);

test('A: unfinished accepted treatment without a future appointment is a high opportunity', () => {
  const result = scan({ patients: [patient()], plans: [acceptedPlan()] });
  const row = result.results[0];
  assert.equal(row.contactRecommended, true);
  assert.ok(row.score >= 60);
  assert.ok(row.signals.some((signal) => signal.type === SIGNAL_TYPE.UNFINISHED_TREATMENT));
  assert.ok(row.signals.some((signal) => signal.type === SIGNAL_TYPE.NO_FUTURE_APPOINTMENT));
});

test('B: a future appointment removes the appointment-gap support and contact recommendation', () => {
  const withoutFuture = scan({ patients: [patient()], plans: [acceptedPlan()] }).results[0];
  const withFuture = scan({
    patients: [patient()],
    plans: [acceptedPlan()],
    appointments: [{
      id: 'a1', studio_id: STUDIO_A, pazienteId: 'p1', data: '2026-09-01', ora: '09:00', stato: 'confermato',
    }],
  }).results[0];
  assert.ok(withFuture.score < withoutFuture.score);
  assert.equal(withFuture.contactRecommended, false);
  assert.ok(!withFuture.signals.some((signal) => signal.type === SIGNAL_TYPE.NO_FUTURE_APPOINTMENT));
});

test('C: an overdue open recall without a covering appointment is a candidate', () => {
  const result = scan({
    patients: [patient()],
    recalls: [{
      id: 'r1', studio_id: STUDIO_A, pazienteId: 'p1', stato: 'da_fare', categoria: 'generico',
      motivo: 'Richiamare per controllo', dataScadenza: '2026-08-01',
    }],
  });
  assert.ok(signalsOf(result).some((signal) => signal.type === SIGNAL_TYPE.RECALL_OVERDUE));
  assert.equal(result.results[0].contactRecommended, true);
});

test('a future appointment near the recall target suppresses the duplicate recall need', () => {
  const result = scan({
    patients: [patient()],
    recalls: [{
      id: 'r1', studio_id: STUDIO_A, pazienteId: 'p1', stato: 'da_fare', categoria: 'generico',
      motivo: 'Richiamare per controllo', dataScadenza: '2026-09-01',
    }],
    appointments: [{
      id: 'a1', studio_id: STUDIO_A, pazienteId: 'p1', data: '2026-09-08', stato: 'confermato',
    }],
  });
  assert.ok(!signalsOf(result).some((signal) => signal.type.startsWith('RECALL_')));
});

test('D: patient without a plan is low-confidence Data Quality, never a definite appointment need', () => {
  const result = scan({ patients: [patient()] });
  const row = result.results[0];
  const signal = row.signals.find((item) => item.type === SIGNAL_TYPE.MISSING_TREATMENT_PLAN);
  assert.ok(signal);
  assert.equal(signal.taxonomy, SIGNAL_TAXONOMY.DATA_QUALITY);
  assert.equal(row.contactRecommended, false);
  assert.ok(row.confidence < 0.5);
  assert.ok(!row.signals.some((item) => item.type === SIGNAL_TYPE.NO_FUTURE_APPOINTMENT));
});

test('E: missing performance execution state is Data Quality, not unfinished treatment', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', { voci: [{ prestazione: 'Terapia A' }] })],
  });

  const signals = signalsOf(result);
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.MISSING_EXECUTION_STATUS));
  assert.ok(!signals.some((signal) => signal.type === SIGNAL_TYPE.UNFINISHED_TREATMENT));
});

test('missing plan status does not hide independent execution-state quality issues', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: undefined,
      voci: [{ prestazione: 'Terapia A' }, { prestazione: 'Terapia B' }],
    })],
  });
  const signals = signalsOf(result);
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.MISSING_PLAN_STATUS));
  const execution = signals.find((signal) => signal.type === SIGNAL_TYPE.MISSING_EXECUTION_STATUS);
  assert.equal(execution?.context?.count, 2);
});

test('F: reliable configured hygiene history overdue produces a prevention opportunity', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{
        prestazione: 'Igiene orale',
        eseguita: true,
        dataEsec: '2026-01-10',
        richiamoData: '2026-07-10',
      }],
    })],
  });
  const signal = signalsOf(result).find((item) => item.type === SIGNAL_TYPE.HYGIENE_OVERDUE);
  assert.ok(signal);
  assert.equal(signal.taxonomy, SIGNAL_TAXONOMY.PREVENTION);
});

test('G: unreliable hygiene history creates no fabricated overdue claim', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{ prestazione: 'Igiene orale', eseguita: true, dataEsec: '2026-01-10' }],
    })],
  });

  const signals = signalsOf(result);
  assert.ok(!signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING));
});

test('an undated executed hygiene record makes chronology unreliable instead of producing overdue prevention', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [
        {
          prestazione: 'Igiene orale',
          eseguita: true,
          dataEsec: '2025-01-10',
          richiamoData: '2025-07-10',
        },
        {
          prestazione: 'Igiene orale',
          eseguita: true,
        },
      ],
    })],
  });
  const signals = signalsOf(result);
  assert.ok(!signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING));
});

test('H: an open activity linked by patient ID is attached with high confidence', () => {
  const result = scan({
    patients: [patient()],
    activities: [{
      id: 'task-1', studio_id: STUDIO_A, pazienteId: 'p1', testo: 'Richiamare per completare terapia', fatto: false,
    }],
  });
  const signal = signalsOf(result).find((item) => item.type === SIGNAL_TYPE.OPEN_ACTIVITY);
  assert.ok(signal);
  assert.equal(signal.context.association, 'patient_id');
  assert.ok(signal.confidence > 0.9);
});

test('I: ambiguous name-only activity is never attached', () => {
  const result = scan({
    patients: [
      patient('p1', { nome: 'Mario', cognome: 'Rossi' }),
      patient('p2', { nome: 'Mario', cognome: 'Rossi' }),
    ],
    activities: [{
      id: 'task-1', studio_id: STUDIO_A, testo: 'Richiamare Mario Rossi', fatto: false,
    }],
  });
  assert.ok(result.results.every((row) => !row.signals.some((signal) => signal.type === SIGNAL_TYPE.OPEN_ACTIVITY)));
});

test('unique full-name activity association is conservative and explainable', () => {
  const result = scan({
    patients: [patient('p1', { nome: 'Anna', cognome: 'Bianchi' })],
    activities: [{
      id: 'task-1', studio_id: STUDIO_A, titolo: 'Chiamare Anna Bianchi domani', fatto: false,
    }],
  });

  const signal = signalsOf(result).find((item) => item.type === SIGNAL_TYPE.OPEN_ACTIVITY);
  assert.ok(signal);
  assert.equal(signal.context.association, 'unique_full_name');
  assert.ok(signal.confidence < 0.9);
});

test('ordinary calendar commitments without an explicit open-task state are not contact signals', () => {
  const result = scan({
    patients: [patient('p1', { nome: 'Mario', cognome: 'Rossi' })],
    activities: [{
      id: 'calendar-1',
      studio_id: STUDIO_A,
      titolo: 'Pranzo con Mario Rossi',
      dataInizio: '2025-01-01',
      dataFine: '2025-01-01',
    }],
  });
  assert.ok(result.results.every((row) => !row.signals.some((signal) => signal.type === SIGNAL_TYPE.OPEN_ACTIVITY)));
});

test('J: combined scoring is deterministic and uses documented exact weights', () => {
  const sources = {
    patients: [patient()],
    plans: [acceptedPlan()],
    activities: [{
      id: 'task-1', studio_id: STUDIO_A, pazienteId: 'p1', testo: 'Richiamare', fatto: false,
    }],
  };
  const first = scan(sources).results[0];
  const second = scan(sources).results[0];
  const expected = SIGNAL_WEIGHTS.UNFINISHED_TREATMENT
    + SIGNAL_WEIGHTS.NO_FUTURE_APPOINTMENT
    + SIGNAL_WEIGHTS.OPEN_ACTIVITY;
  assert.equal(first.score, expected);
  assert.deepEqual(first, second);
});

test('K: missing required execution data lowers confidence', () => {
  const complete = scan({ patients: [patient()], plans: [acceptedPlan()] }).results[0];
  const incomplete = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', { voci: [{ prestazione: 'Terapia A' }] })],
  }).results[0];
  assert.ok(incomplete.confidence < complete.confidence);
});

test('L: cross-tenant patients and facts are excluded', () => {
  const result = scan({
    patients: [
      patient(),
      patient('p2', { studio_id: STUDIO_B, nome: 'Tenant', cognome: 'B' }),
    ],
    plans: [
      acceptedPlan(),
      acceptedPlan('p2', { studio_id: STUDIO_B }),
    ],
    recalls: [{
      id: 'r-b', studio_id: STUDIO_B, pazienteId: 'p1', stato: 'da_fare', dataScadenza: '2026-01-01',
    }],
  });
  assert.ok(result.results.every((row) => row.patient.studio_id === STUDIO_A));
  assert.ok(!signalsOf(result).some((signal) => signal.sourceId === 'r-b'));
});

test('M: permission-restricted clinical and financial facts are hidden', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan()],
    recalls: [{
      id: 'r-pay', studio_id: STUDIO_A, pazienteId: 'p1', stato: 'da_fare',
      categoria: 'incasso', motivo: 'Pagamento sospeso di 500 euro', dataScadenza: '2026-08-01',
    }],
  }, {
    permissions: {
      activeMember: true,
      operations: true,
      clinical: false,
      financial: false,
    },
  });

  const signals = signalsOf(result);
  assert.ok(!signals.some((signal) => signal.source === 'treatment_plan'));
  assert.ok(!signals.some((signal) => signal.sourceId === 'r-pay'));
});

test('assignment-bound PT and massage capabilities fail closed without an authoritative patient scope', () => {
  const physicalTrainer = buildIntelligencePermissions({
    activeMember: true,
    capabilities: ['clinical.personal_trainer'],
  });
  const massageTherapist = buildIntelligencePermissions({
    activeMember: true,
    capabilities: ['clinical.massage_therapist'],
  });
  assert.deepEqual(physicalTrainer, {
    activeMember: true,
    operations: false,
    clinical: false,
    financial: false,
  });
  assert.deepEqual(massageTherapist, physicalTrainer);
  for (const permissions of [physicalTrainer, massageTherapist]) {
    const result = scan({ patients: [patient()], plans: [acceptedPlan()] }, { permissions });
    assert.equal(result.results.length, 0);
  }
});

test('front desk receives operational but not clinical facts, while clinical.general is tenant-wide', () => {
  const frontDesk = buildIntelligencePermissions({
    activeMember: true,
    capabilities: ['home.front_desk'],
  });
  const clinician = buildIntelligencePermissions({
    activeMember: true,
    capabilities: ['clinical.general'],
  });
  assert.equal(frontDesk.operations, true);
  assert.equal(frontDesk.clinical, false);
  assert.equal(clinician.operations, true);
  assert.equal(clinician.clinical, true);
});

test('inactive membership and missing tenant identity fail closed', () => {
  const sources = { patients: [patient()], plans: [acceptedPlan()] };
  const inactive = scanPatientOpportunities({
    studioId: STUDIO_A,
    permissions: { ...allPermissions, activeMember: false },
    sources,
  });
  const missingTenant = scanPatientOpportunities({
    studioId: null,
    permissions: allPermissions,
    sources,
  });
  assert.equal(inactive.results.length, 0);
  assert.equal(inactive.studioDataHealth.available, false);
  assert.equal(inactive.studioDataHealth.score, null);
  assert.equal(missingTenant.results.length, 0);
  assert.equal(missingTenant.studioDataHealth.available, false);
});

test('N: intelligence queries make zero Model Gateway or Supabase calls', async () => {
  let calls = 0;
  const forbiddenClient = new Proxy({}, {
    get() {
      calls += 1;
      throw new Error('No gateway/data call is allowed during deterministic scanning.');
    },
  });
  const result = await processQuery({
    query: 'Ci sono pazienti che devono prendere appuntamento?',
    context: { studioId: STUDIO_A, vertical: 'dentistico' },
    permissions: { intelligence: allPermissions },
    sources: { patients: [patient()], plans: [acceptedPlan()] },
    supabaseClient: forbiddenClient,
    allowModel: true,
  });
  assert.equal(result.intent, 'INTELLIGENCE_SCAN');
  assert.equal(result.intelligence.tokenUsage, 0);
  assert.equal(calls, 0);
});

test('semantic intelligence routing recognizes equivalent questions without one exact sentence', () => {
  const queries = [
    'chi devo richiamare?',
    'chi rischiamo di perdere?',
    'ci sono pazienti con cure da finire?',
    'chi non ha un prossimo appuntamento?',
    'ci sono schede incomplete?',
    'mostrami lo Studio Data Health',
  ];
  for (const query of queries) assert.equal(classifyIntelligenceQuery(query)?.type, 'INTELLIGENCE_SCAN', query);
  assert.equal(classifyIntelligenceQuery('apri agenda'), null);
  assert.equal(classifyIntelligenceQuery('quali appuntamenti ho oggi?'), null);
  assert.equal(classifyIntelligenceQuery('chi ha appuntamento oggi?'), null);
  assert.equal(classifyIntelligenceQuery('quali pazienti devono venire all’appuntamento oggi?'), null);
  assert.equal(classifyIntelligenceQuery('chi deve presentarsi all’appuntamento oggi?'), null);
});

test('every returned patient and visible group item has at least one human-readable reason', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan()],
    recalls: [{
      id: 'r1', studio_id: STUDIO_A, pazienteId: 'p1', stato: 'da_fare',
      categoria: 'generico', motivo: 'Controllo', dataScadenza: '2026-08-01',
    }],
  });
  for (const row of result.results) {
    assert.ok(row.signals.length > 0);
    assert.ok(row.signals.every((signal) => typeof signal.reason === 'string' && signal.reason.trim().length > 0));
  }
  for (const group of result.groups) {
    assert.ok(group.items.every((row) => row.visibleSignals.length > 0));
  }
});

test('complete required workflow state has no false Data Quality penalty and optional fields are ignored', () => {
  const result = scan({
    patients: [{ id: 'p1', studio_id: STUDIO_A, nome: 'Solo', cognome: 'Nome' }],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{ prestazione: 'Terapia A', eseguita: true }],
    })],
  });
  assert.equal(result.results.length, 0);
  assert.equal(result.studioDataHealth.score, 100);
  assert.deepEqual(Object.values(result.studioDataHealth.issues), [0, 0, 0, 0, 0]);
});

test('Studio Data Health is non-clinical and deterministic for missing required workflow states', () => {
  const sources = {
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: undefined,
      voci: [{ prestazione: 'Terapia A' }],
    })],
  };
  const first = scan(sources).studioDataHealth;
  const second = scan(sources).studioDataHealth;
  assert.equal(first.name, 'Studio Data Health');
  assert.equal(first.nonClinical, true);
  assert.equal(first.available, true);
  assert.ok(first.score < 100);
  assert.deepEqual(first, second);
});

test('Studio Data Health is unavailable when clinical workflow states are not permitted', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan()],
  }, {
    permissions: {
      activeMember: true,
      operations: true,
      clinical: false,
      financial: false,
    },
  });
  assert.equal(result.studioDataHealth.available, false);
  assert.equal(result.studioDataHealth.score, null);
});

test('an unrelated generic recall does not suppress an independent hygiene signal', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{
        prestazione: 'Igiene orale',
        eseguita: true,
        dataEsec: '2026-01-10',
        richiamoData: '2026-07-10',
      }],
    })],
    recalls: [{
      id: 'generic-recall',
      studio_id: STUDIO_A,
      pazienteId: 'p1',
      stato: 'da_fare',
      categoria: 'generico',
      motivo: 'Consegnare un documento',
      dataScadenza: '2026-07-10',
    }],
  });
  const signals = signalsOf(result);
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.RECALL_OVERDUE));
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
});

test('a matching clinical recall suppresses duplicate hygiene scoring for the same due window', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{
        prestazione: 'Igiene orale',
        eseguita: true,
        dataEsec: '2026-01-10',
        richiamoData: '2026-07-10',
      }],
    })],
    recalls: [{
      id: 'clinical-recall',
      studio_id: STUDIO_A,
      pazienteId: 'p1',
      stato: 'da_fare',
      categoria: 'clinico',
      motivo: 'Igiene orale',
      dataScadenza: '2026-07-10',
    }],
  });

  const signals = signalsOf(result);
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.RECALL_OVERDUE));
  assert.ok(!signals.some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
});

test('an unrelated clinical recall in the same window does not suppress hygiene', () => {
  const result = scan({
    patients: [patient()],
    plans: [acceptedPlan('p1', {
      stato: 'concluso',
      voci: [{
        prestazione: 'Igiene orale',
        eseguita: true,
        dataEsec: '2026-01-10',
        richiamoData: '2026-07-10',
      }],
    })],
    recalls: [{
      id: 'orthodontic-recall',
      studio_id: STUDIO_A,
      pazienteId: 'p1',
      stato: 'da_fare',
      categoria: 'clinico',
      motivo: 'Controllo ortodontico',
      dataScadenza: '2026-07-10',
    }],
  });
  assert.ok(signalsOf(result).some((signal) => signal.type === SIGNAL_TYPE.HYGIENE_OVERDUE));
});

test('authoritative DB rows are merged into optimistic local state after insert', () => {
  const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /x\.id === tempId \? \{ \.\.\.x, \.\.\.saved \} : x/);
});

test('cache is fingerprinted and isolated by tenant and scanner context', () => {
  clearIntelligenceCache();
  const sources = { patients: [patient()], plans: [acceptedPlan()] };
  const first = scanPatientOpportunities({
    studioId: STUDIO_A,
    today: TODAY,
    permissions: allPermissions,
    sources,
  });
  const second = scanPatientOpportunities({
    studioId: STUDIO_A,
    today: TODAY,
    permissions: allPermissions,
    sources,
  });
  const otherTenant = scanPatientOpportunities({
    studioId: STUDIO_B,
    today: TODAY,
    permissions: allPermissions,
    sources,
  });
  assert.equal(first.cacheHit, false);
  assert.equal(second.cacheHit, true);
  assert.equal(otherTenant.cacheHit, false);
  assert.equal(otherTenant.results.length, 0);
});

test('large synthetic scan exposes no obvious quadratic behavior', () => {
  const size = 5000;
  const patients = Array.from({ length: size }, (_, index) => patient(`p${index}`, {
    nome: `Nome${index}`,
    cognome: `Cognome${index}`,
  }));
  const plans = patients.map((row, index) => acceptedPlan(row.id, {
    id: `plan-${index}`,
    voci: [{ prestazione: `Prestazione ${index}`, eseguita: index % 2 === 0 }],
  }));
  const appointments = patients.slice(0, size / 2).map((row, index) => ({
    id: `app-${index}`,
    studio_id: STUDIO_A,
    pazienteId: row.id,
    data: '2026-09-01',
    stato: 'confermato',
  }));
  const activities = patients.slice(0, 500).map((row, index) => ({
    id: `activity-${index}`,
    studio_id: STUDIO_A,
    titolo: `Contattare ${row.nome} ${row.cognome}`,
    fatto: false,
  }));
  const started = performance.now();
  const result = scan({ patients, plans, appointments, activities });
  const elapsed = performance.now() - started;
  assert.ok(result.results.length > 0);
  assert.ok(elapsed < 5000, `5000-patient scan took ${elapsed.toFixed(1)}ms`);
});
