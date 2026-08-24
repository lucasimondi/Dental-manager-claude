import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, COMMAND_INTENT } from '../src/lib/poliedron/planner/commandParser.js';
import { buildActionPlan, PLAN_STEP_TYPE, PRICE_UNRESOLVED } from '../src/lib/poliedron/planner/actionPlanner.js';
import { runActionPlan, RUN_OUTCOME } from '../src/lib/poliedron/planner/actionExecutor.js';
import { SIGNAL_TYPE } from '../src/lib/poliedron/intelligence/model.js';
import { scanTreatmentPlans } from '../src/lib/poliedron/intelligence/treatmentPlanScanner.js';

const PATIENTS = [
  { id: 1, nome: 'Isa', cognome: 'Bergese', studioId: 's1' },
  { id: 2, nome: 'Mario', cognome: 'Rossi', studioId: 's1' },
  { id: 3, nome: 'Marco', cognome: 'Rossi', studioId: 's1' },
  { id: 4, nome: 'Valentina', cognome: 'Verdi', studioId: 's1' },
];
const PRICELIST = [
  { nome: 'Devitalizzazione', prezzo: 200 },
  { nome: 'Corona zirconio', prezzo: 500 },
  { nome: 'Perno in fibra', prezzo: 120 },
  { nome: 'Otturazione composita', prezzo: 80 },
];
const PERMISSIONS = { activeMember: true, capabilities: ['clinical.general'], managementControl: false };

const context = (overrides = {}) => ({
  patients: PATIENTS, plans: [], payments: [], pricelist: PRICELIST,
  homePermissions: PERMISSIONS, studioId: 's1', ...overrides,
});

const fakeDb = (initialPlans = []) => {
  let plans = structuredClone(initialPlans);
  return {
    async getAll(key) { return key === 'dm_pl' ? structuredClone(plans) : []; },
    async getById(key, id) { return key === 'dm_pl' ? structuredClone(plans.find((p) => String(p.id) === String(id)) || null) : null; },
    async insert(key, value) { if (key === 'dm_pl') plans.push(structuredClone(value)); return structuredClone(value); },
    async update(key, id, value) { if (key === 'dm_pl') plans = plans.map((p) => String(p.id) === String(id) ? structuredClone(value) : p); },
    dump() { return structuredClone(plans); },
  };
};

test('generic add family parses the required single, multi-treatment, multi-tooth and unknown-tooth examples deterministically', () => {
  const cases = [
    ['Aggiungi devitalizzazione 16 a Isa Bergese.', 1, ['16'], 'Isa Bergese'],
    ['Metti una corona in zirconio sul 13 di Mario Rossi.', 1, ['13'], 'Mario Rossi'],
    ['Aggiungi otturazione 36 e 37 a Valentina.', 2, ['36', '37'], 'Valentina'],
    ['Aggiungi una devitalizzazione al paziente che ho aperto.', 1, [null], null],
    ['Aggiungi una corona, ma non ricordo il dente.', 1, [null], null],
    ['Metti devitalizzazione, perno e corona sul 13.', 3, ['13', '13', '13'], null],
  ];
  for (const [command, count, teeth, patient] of cases) {
    const parsed = parseCommand(command);
    assert.equal(parsed?.commandIntent, COMMAND_INTENT.ADD_TREATMENT_ITEM, command);
    assert.equal(parsed.items.length, count, command);
    assert.deepEqual(parsed.items.map((item) => item.toothText), teeth, command);
    assert.equal(parsed.patientText, patient, command);
  }
});

test('named patient + tooth produces a confirmable Level-2 add plan', () => {
  const plan = buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Isa Bergese.'), context());
  assert.equal(plan.blocked, false);
  assert.equal(plan.entities.patientId, 1);
  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM).length, 1);
});

test('current patient and visual tooth contexts are inherited but canonically resolved', () => {
  const plan = buildActionPlan(parseCommand('Aggiungi devitalizzazione'), context({ currentPatient: { id: 2 }, selectedTooth: '13' }));
  const ensure = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  assert.equal(plan.patientRef.mechanism, 'context');
  assert.equal(plan.entities.patientId, 2);
  assert.equal(ensure.tooth.value, '13');
});

test('three procedures on one tooth remain independent records and one procedure on two teeth becomes two records', () => {
  const multiProcedure = buildActionPlan(parseCommand('Metti devitalizzazione, perno e corona sul 13.'), context({ currentPatient: { id: 1 } }));
  assert.equal(multiProcedure.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM).length, 3);
  const multiTooth = buildActionPlan(parseCommand('Aggiungi otturazione 36 e 37 a Valentina.'), context());
  assert.equal(multiTooth.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM).length, 2);
});

test('ambiguous patient, ambiguous procedure, ambiguous target plan and invalid tooth all block with zero writes', async () => {
  const ambiguousPricelist = [...PRICELIST, { nome: 'Corona ceramica', prezzo: 450 }];
  const twoPlans = [
    { id: 'a', pazienteId: 1, stato: 'attivo', voci: [] },
    { id: 'b', pazienteId: 1, stato: 'attivo', voci: [] },
  ];
  const plans = [
    buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Rossi.'), context()),
    buildActionPlan(parseCommand('Aggiungi corona 13 a Isa Bergese.'), context({ pricelist: ambiguousPricelist })),
    buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Isa Bergese.'), context({ plans: twoPlans })),
    buildActionPlan(parseCommand('Aggiungi devitalizzazione 99 a Isa Bergese.'), context()),
  ];
  for (const plan of plans) {
    assert.equal(plan.blocked, true);
    const db = fakeDb(twoPlans);
    const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: PERMISSIONS, studioId: 's1' });
    assert.equal(result.outcome, RUN_OUTCOME.FAILED);
    assert.deepEqual(db.dump(), twoPlans);
  }
});

test('duplicate treatment is a verified no-op and a single target plan receives the new item', async () => {
  const existing = [{ id: 'p1', pazienteId: 1, stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '16', prezzo: 200, eseguita: false, incassata: false }] }];
  const duplicatePlan = buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Isa Bergese.'), context({ plans: existing }));
  const duplicateDb = fakeDb(existing);
  assert.equal((await runActionPlan(duplicatePlan, { db: duplicateDb, patients: PATIENTS, homePermissions: PERMISSIONS, studioId: 's1' })).outcome, RUN_OUTCOME.SUCCESS);
  assert.equal(duplicateDb.dump()[0].voci.length, 1);

  const addPlan = buildActionPlan(parseCommand('Aggiungi corona in zirconio sul 13 a Isa Bergese.'), context({ plans: existing }));
  const addDb = fakeDb(existing);
  await runActionPlan(addPlan, { db: addDb, patients: PATIENTS, homePermissions: PERMISSIONS, studioId: 's1' });
  assert.equal(addDb.dump().length, 1);
  assert.equal(addDb.dump()[0].voci.length, 2);
});

test('permission denial/revocation, cross-tenant context and stale target ambiguity fail closed', async () => {
  const denied = buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Isa Bergese.'), context({ homePermissions: { activeMember: true, capabilities: [] } }));
  assert.equal(denied.blocked, true);

  const preview = buildActionPlan(parseCommand('Aggiungi devitalizzazione 16 a Isa Bergese.'), context());
  let db = fakeDb();
  let result = await runActionPlan(preview, { db, patients: PATIENTS, homePermissions: { activeMember: true, capabilities: [] }, studioId: 's1' });
  assert.equal(result.failedStep.type, 'PERMISSION');
  assert.equal(db.dump().length, 0);

  const contextual = buildActionPlan(parseCommand('Aggiungi devitalizzazione 16'), context({ currentPatient: { id: 1 } }));
  db = fakeDb();
  result = await runActionPlan(contextual, { db, patients: PATIENTS.filter((p) => p.id !== 1), homePermissions: PERMISSIONS, studioId: 's1' });
  assert.equal(result.failedStep.type, 'PATIENT_NOT_FOUND');

  db = fakeDb([{ id: 'a', pazienteId: 1, stato: 'attivo', voci: [] }, { id: 'b', pazienteId: 1, stato: 'attivo', voci: [] }]);
  result = await runActionPlan(preview, { db, patients: PATIENTS, homePermissions: PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(db.dump().flatMap((p) => p.voci).length, 0);
});

test('unknown tooth is stored incomplete, price is never invented, and Data Health can surface it once completed', async () => {
  const plan = buildActionPlan(parseCommand('Aggiungi una corona, ma non ricordo il dente.'), context({ currentPatient: { id: 1 }, pricelist: [{ nome: 'Corona zirconio', prezzo: 500 }] }));
  const ensure = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  assert.equal(ensure.tooth.value, null);
  assert.notEqual(ensure.procedureRef.price, PRICE_UNRESOLVED);
  const db = fakeDb();
  await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: PERMISSIONS, studioId: 's1' });
  assert.equal(db.dump()[0].voci[0].dente, '');
  assert.equal(db.dump()[0].voci[0].prezzo, 500);

  const signals = scanTreatmentPlans({ plans: db.dump(), hasFuture: true, today: '2026-08-24', canReadClinical: true });
  assert.ok(signals.some((signal) => signal.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE));
});

test('common generic commands require zero Model Gateway calls', async () => {
  const parsed = parseCommand('Inserisci devitalizzazione 16 a Isa Bergese');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.ADD_TREATMENT_ITEM);
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/lib/poliedron/planner/commandParser.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /runModelTask|modelGateway/);
});
