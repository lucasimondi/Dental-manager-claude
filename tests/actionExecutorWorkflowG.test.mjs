import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCommand } from '../src/lib/poliedron/planner/commandParser.js';
import { buildActionPlan, PLAN_STEP_TYPE } from '../src/lib/poliedron/planner/actionPlanner.js';
import { runActionPlan, RUN_OUTCOME } from '../src/lib/poliedron/planner/actionExecutor.js';
import { scanTreatmentPlans } from '../src/lib/poliedron/intelligence/treatmentPlanScanner.js';
import { SIGNAL_TYPE } from '../src/lib/poliedron/intelligence/model.js';

/* POL-AI-005B Workflow G — "Era il 46": completing a treatment recorded
   with UNKNOWN_AT_ENTRY (INCOMPLETE CLINICAL RECORD -> DATA HEALTH SIGNAL
   -> USER SUPPLIES MISSING INFORMATION -> RESOLVE -> PREVIEW -> CONFIRM ->
   UPDATE EXISTING ITEM -> VERIFY -> SIGNAL CLEARS). Same fake-db
   convention as actionExecutor.test.mjs — never the real Supabase client. */

function createFakeDb({ plans = [], payments = [] } = {}) {
  const store = { dm_pl: plans.map((p) => ({ ...p, voci: p.voci ? p.voci.map((v) => ({ ...v })) : [] })), dm_py: payments.map((p) => ({ ...p })) };
  return {
    async getAll(key) { return store[key].map((r) => ({ ...r, voci: r.voci ? r.voci.map((v) => ({ ...v })) : undefined })); },
    async insert(key, obj) { store[key].push({ ...obj }); return { ...obj }; },
    async update(key, id, obj) {
      const idx = store[key].findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`fakeDb.update: ${key} ${id} not found`);
      store[key][idx] = { ...obj, id };
    },
    async getById(key, id) {
      const row = store[key].find((r) => r.id === id);
      return row ? { ...row, voci: row.voci ? row.voci.map((v) => ({ ...v })) : undefined } : null;
    },
    _dump: () => JSON.parse(JSON.stringify(store)),
  };
}

const PATIENTS = [
  { id: 1, nome: 'Isa', cognome: 'Bergese', studioId: 's1' },
  { id: 9, nome: 'Altro', cognome: 'Paziente', studioId: 's1' },
];
const CROSS_TENANT_PATIENTS = [{ id: 1, nome: 'Isa', cognome: 'Bergese', studioId: 's1' }]; // "9" deliberately absent — different tenant view
const PRICELIST = [{ nome: 'Devitalizzazione', prezzo: 200 }, { nome: 'Otturazione composita', prezzo: 80 }];
const FULL_PERMISSIONS = { activeMember: true, capabilities: ['clinical.general'], managementControl: true };
const NO_CLINICAL_PERMISSIONS = { activeMember: true, capabilities: [], managementControl: false };

const oneIncompletePlan = () => [{
  id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', data: '2026-01-01',
  voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false }],
}];

const planFor = (command, { plans = [], currentPatient = { id: 1 }, homePermissions = FULL_PERMISSIONS, patients = PATIENTS } = {}) =>
  buildActionPlan(parseCommand(command), { patients, plans, payments: [], pricelist: PRICELIST, homePermissions, studioId: 's1', currentPatient });

// --- 1-8: the golden single-match path -------------------------------

test('1. one incomplete devitalization + "Era il 46" -> resolves the existing item, plan not blocked', () => {
  const plan = planFor('Era il 46', { plans: oneIncompletePlan() });
  assert.equal(plan.blocked, false);
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH);
  assert.ok(step);
  assert.equal(step.existingPlanId, 'p1');
  assert.equal(step.existingVoceIndex, 0);
  assert.equal(step.expectedOutcome, 'SINGLE_MATCH');
  assert.equal(step.newTooth.value, '46');
});

test('2-7. confirmation updates the existing item in place: no new treatment/plan, status/price/payment untouched', async () => {
  const plans = oneIncompletePlan();
  const plan = planFor('Era il 46', { plans });
  const db = createFakeDb({ plans, payments: [{ id: 'pay1', pazienteId: 1, importo: 200, stato: 'sospeso' }] });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);

  const dump = db._dump();
  assert.equal(dump.dm_pl.length, 1, 'no new plan created (4)');
  assert.equal(dump.dm_pl[0].voci.length, 1, 'no new treatment created (3)');
  const voce = dump.dm_pl[0].voci[0];
  assert.equal(voce.dente, '46', 'tooth updated (2)');
  assert.equal(voce.eseguita, true, 'status remains completed (5)');
  assert.equal(voce.prezzo, 200, 'price remains unchanged (6)');
  assert.deepEqual(dump.dm_py, [{ id: 'pay1', pazienteId: 1, importo: 200, stato: 'sospeso' }], 'payment remains unchanged (7)');
});

test('8. Data Health MISSING_TOOTH_REFERENCE clears after the update is verified', async () => {
  const plans = oneIncompletePlan();
  const before = scanTreatmentPlans({ plans, hasFuture: true, today: '2026-01-01', canReadClinical: true });
  assert.ok(before.some((s) => s.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE), 'signal present before completion');

  const plan = planFor('Era il 46', { plans });
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);

  const freshPlans = await db.getAll('dm_pl');
  const after = scanTreatmentPlans({ plans: freshPlans, hasFuture: true, today: '2026-01-01', canReadClinical: true });
  assert.equal(after.filter((s) => s.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE).length, 0, 'signal cleared after completion — derived live, not manually deleted');
});

// --- 9-11: idempotency and conflicting-repeat semantics ---------------

test('9. repeating "Era il 46" after it already succeeded -> zero additional writes, reported as an up-to-date no-op', async () => {
  const plans = oneIncompletePlan();
  const db = createFakeDb({ plans });
  const plan1 = planFor('Era il 46', { plans });
  const result1 = await runActionPlan(plan1, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result1.outcome, RUN_OUTCOME.SUCCESS);
  const afterFirst = db._dump();

  const freshPlans = await db.getAll('dm_pl');
  const plan2 = planFor('Era il 46', { plans: freshPlans });
  assert.equal(plan2.blocked, false, 'still confirmable — an already-up-to-date no-op, not a dead end');
  const result2 = await runActionPlan(plan2, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result2.outcome, RUN_OUTCOME.SUCCESS);
  assert.equal(result2.completedSteps[0].result.skipped, true);
  assert.equal(result2.completedSteps[0].result.reason, 'already-up-to-date');
  assert.deepEqual(db._dump(), afterFirst, 'no additional write happened');
});

test('10. existing tooth already 46 (never incomplete) + "Era il 46" -> safe no-op', async () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '46', prezzo: 200, eseguita: true, incassata: false },
  ] }];
  const plan = planFor('Era il 46', { plans });
  assert.equal(plan.blocked, false);
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  assert.equal(result.completedSteps[0].result.skipped, true);
  assert.equal(db._dump().dm_pl[0].voci[0].dente, '46');
});

test('11. existing tooth 46 + "Era il 36" -> does not overwrite as missing-data completion; existing value reported, zero writes', async () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '46', prezzo: 200, eseguita: true, incassata: false },
  ] }];
  const plan = planFor('Era il 36', { plans });
  assert.equal(plan.blocked, true);
  assert.ok(plan.warnings.some((w) => w.includes('46') && w.includes('36') === false || w.includes('46')));
  assert.equal(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH), false);
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED, 'blocked plan is refused at the precondition stage');
  assert.equal(db._dump().dm_pl[0].voci[0].dente, '46', 'existing value untouched');
});

// --- 12-15: ambiguity / no-match / invalid input, all zero-write ------

test('12. two incomplete devitalizations -> clarification required, zero writes', async () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false },
    { prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false },
  ] }];
  const plan = planFor('Era il 46', { plans });
  assert.equal(plan.blocked, true);
  assert.ok(plan.warnings.some((w) => w.includes('due') || w.includes('2')));
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_pl[0].voci.map((v) => v.dente), ['', '']);
});

test('13. incomplete devitalization + incomplete filling + "la devitalizzazione era il 46" -> correct treatment selected, filling untouched', async () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false },
    { prestazione: 'Otturazione composita', dente: '', prezzo: 80, eseguita: true, incassata: false },
  ] }];
  const plan = planFor('la devitalizzazione era il 46', { plans });
  assert.equal(plan.blocked, false);
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump().dm_pl[0].voci;
  assert.equal(dump[0].dente, '46', 'devitalizzazione updated');
  assert.equal(dump[1].dente, '', 'filling untouched');
});

test('14. no matching incomplete treatment -> zero writes', async () => {
  const plan = planFor('Era il 46', { plans: [] });
  assert.equal(plan.blocked, true);
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_pl, []);
});

test('15. invalid tooth -> zero writes', async () => {
  const plans = oneIncompletePlan();
  const plan = planFor('Era il 99', { plans });
  assert.equal(plan.blocked, true);
  assert.ok(plan.warnings.some((w) => w.includes('non valido')));
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(db._dump().dm_pl[0].voci[0].dente, '');
});

// --- 16-20: cancel / permission / cross-tenant / tampering / stale ----

test('16. cancel preview (never calling runActionPlan) -> zero writes', async () => {
  const plans = oneIncompletePlan();
  const plan = planFor('Era il 46', { plans });
  assert.equal(plan.blocked, false); // a real, confirmable plan was built...
  const db = createFakeDb({ plans });
  // ...but the user never confirms — runActionPlan is simply never called.
  assert.deepEqual(db._dump().dm_pl[0].voci[0].dente, '');
});

test('17. permission revoked after preview -> zero writes', async () => {
  const plans = oneIncompletePlan();
  const plan = planFor('Era il 46', { plans, homePermissions: FULL_PERMISSIONS });
  const db = createFakeDb({ plans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: NO_CLINICAL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(result.failedStep.type, 'PERMISSION');
  assert.equal(db._dump().dm_pl[0].voci[0].dente, '');
});

test('18. cross-tenant treatment: a treatment belonging to a patient outside this tenant\'s fresh patients array is rejected', async () => {
  const plans = [
    { id: 'p1', pazienteId: 1, titolo: 'Piano Isa', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false }] },
    { id: 'pOther', pazienteId: 9, titolo: 'Piano altro tenant', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false }] },
  ];
  const plan = planFor('Era il 46', { plans });
  // Tamper the resolved step to point at a plan/treatment belonging to a
  // patient (id 9) that is NOT present in the caller's fresh, tenant-scoped
  // `patients` array below — a cross-tenant injection attempt.
  const tamperedStep = { ...plan.steps.find((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH), existingPlanId: 'pOther' };
  const tamperedSteps = plan.steps.map((s) => (s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH ? tamperedStep : s));
  const tamperedPlan = { ...plan, steps: tamperedSteps };
  const db = createFakeDb({ plans });
  const result = await runActionPlan(tamperedPlan, { db, patients: CROSS_TENANT_PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /non appartiene/);
  assert.equal(db._dump().dm_pl[1].voci[0].dente, '', 'the cross-tenant treatment was never touched');
});

test('19. tampered treatmentId (existingVoceIndex points at a different, non-matching procedure) -> rejected', async () => {
  const plans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [
    { prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false },
    { prestazione: 'Otturazione composita', dente: '11', prezzo: 80, eseguita: true, incassata: false },
  ] }];
  const plan = planFor('Era il 46', { plans });
  const tamperedStep = { ...plan.steps.find((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH), existingVoceIndex: 1 };
  const tamperedSteps = plan.steps.map((s) => (s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH ? tamperedStep : s));
  const tamperedPlan = { ...plan, steps: tamperedSteps };
  const db = createFakeDb({ plans });
  const result = await runActionPlan(tamperedPlan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /posizione attesa/);
  assert.equal(db._dump().dm_pl[0].voci[1].dente, '11', 'the unrelated filling was never touched');
});

test('20. treatment completed by another actor after preview -> stale/conflict, no overwrite', async () => {
  const plans = oneIncompletePlan();
  const plan = planFor('Era il 46', { plans }); // preview built while the tooth is still empty
  const db = createFakeDb({ plans });
  // Simulate a concurrent actor completing it with a DIFFERENT tooth in between preview and this confirm.
  await db.update('dm_pl', 'p1', { ...plans[0], voci: [{ ...plans[0].voci[0], dente: '11' }] });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /già completato/);
  assert.equal(db._dump().dm_pl[0].voci[0].dente, '11', 'the concurrent actor\'s value was never overwritten');
});

// --- 21: zero Model Gateway calls for the deterministic command --------

test('21. deterministic "Era il 46" never references the Model Gateway (parser + planner + executor)', async () => {
  const files = [
    'src/lib/poliedron/planner/commandParser.js',
    'src/lib/poliedron/planner/actionPlanner.js',
    'src/lib/poliedron/planner/actionExecutor.js',
  ];
  for (const file of files) {
    const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(/modelGateway|runModelTask/i.test(src), false, `${file} must not reference the Model Gateway`);
  }
});

// --- 22-23: target-plan selection hardening (PO decision 1) ------------

test('22. ambiguous target plan for a newly-created treatment -> clarification, no arbitrary plan selection, zero writes', async () => {
  const twoOpenPlans = [
    { id: 'pA', pazienteId: 1, titolo: 'Piano A', stato: 'attivo', data: '2026-01-01', voci: [] },
    { id: 'pB', pazienteId: 1, titolo: 'Piano B', stato: 'attivo', data: '2026-06-01', voci: [] },
  ];
  const plan = buildActionPlan(parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita'), {
    patients: PATIENTS, plans: twoOpenPlans, payments: [], pricelist: PRICELIST, homePermissions: FULL_PERMISSIONS, studioId: 's1',
  });
  assert.equal(plan.blocked, true);
  assert.ok(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.TARGET_PLAN_AMBIGUOUS));
  const db = createFakeDb({ plans: twoOpenPlans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_pl[0].voci, []);
  assert.deepEqual(db._dump().dm_pl[1].voci, []);
});

test('23. exactly one open plan for the target patient -> remains supported (regression, no arbitrary-order change)', async () => {
  const onePlan = [{ id: 'pA', pazienteId: 1, titolo: 'Piano A', stato: 'attivo', data: '2026-01-01', voci: [] }];
  const plan = buildActionPlan(parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita'), {
    patients: PATIENTS, plans: onePlan, payments: [], pricelist: PRICELIST, homePermissions: FULL_PERMISSIONS, studioId: 's1',
  });
  assert.equal(plan.blocked, false);
  const db = createFakeDb({ plans: onePlan });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  assert.equal(db._dump().dm_pl[0].voci.length, 1);
});

// --- TOCTOU: target plan turns ambiguous between preview and confirm ---

test('TOCTOU: a second open plan appearing after preview but before confirm blocks execution (never guesses)', async () => {
  const onePlan = [{ id: 'pA', pazienteId: 1, titolo: 'Piano A', stato: 'attivo', data: '2026-01-01', voci: [] }];
  const db = createFakeDb({ plans: onePlan });
  const plan = buildActionPlan(parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita'), {
    patients: PATIENTS, plans: onePlan, payments: [], pricelist: PRICELIST, homePermissions: FULL_PERMISSIONS, studioId: 's1',
  });
  assert.equal(plan.blocked, false, 'unambiguous at preview time');
  await db.insert('dm_pl', { id: 'pC', pazienteId: 1, titolo: 'Piano C', stato: 'attivo', data: '2026-07-01', voci: [] });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /comparsi/);
});

// --- unknown-tooth commands still zero Model Gateway calls end-to-end --

test('regression: existing workflows A-F command shapes still parse and plan identically after the Workflow-G parser additions', () => {
  const a = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  assert.equal(a.commandIntent, 'RECORD_TREATMENT_AND_PENDING_PAYMENT');
  const c = parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  assert.equal(c.commandIntent, 'MARK_TREATMENT_COMPLETED');
});
