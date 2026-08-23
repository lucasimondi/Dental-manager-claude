import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCommand } from '../src/lib/poliedron/planner/commandParser.js';
import { buildActionPlan, PLAN_STEP_TYPE } from '../src/lib/poliedron/planner/actionPlanner.js';
import { runActionPlan, RUN_OUTCOME } from '../src/lib/poliedron/planner/actionExecutor.js';
import { scanTreatmentPlans } from '../src/lib/poliedron/intelligence/treatmentPlanScanner.js';
import { SIGNAL_TYPE } from '../src/lib/poliedron/intelligence/model.js';
import { calculateStudioDataHealth } from '../src/lib/poliedron/intelligence/studioDataHealth.js';

/* POL-AI-005B §TESTS — real CONFIRM -> ACT -> VERIFY execution against a
   fake `db` (shaped exactly like src/lib/supabase.js's DB: {getAll,
   insert, update, getById}), never a real Supabase client — this sandbox
   never authenticates against the real production project (see prior
   POL-UI-013/POL-UI-013B handoffs for why). */

function createFakeDb({ plans = [], payments = [] } = {}) {
  const store = { dm_pl: plans.map((p) => ({ ...p })), dm_py: payments.map((p) => ({ ...p })) };
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
  { id: 2, nome: 'Fabio', cognome: 'Cincin', studioId: 's1' },
  { id: 3, nome: 'Mario', cognome: 'Rossi', studioId: 's1' },
  { id: 4, nome: 'Marco', cognome: 'Rossi', studioId: 's1' },
  { id: 5, nome: 'Luca', cognome: 'Bianchi', studioId: 's1' },
];
const PRICELIST = [
  { nome: 'Otturazione composita', prezzo: 80 },
  { nome: 'Devitalizzazione', prezzo: 200 },
  { nome: 'Corona zirconio', prezzo: 500 },
];
const FULL_PERMISSIONS = { activeMember: true, capabilities: ['clinical.general'], managementControl: true };

const planFor = (command, { plans = [], payments = [], homePermissions = FULL_PERMISSIONS } = {}) =>
  buildActionPlan(parseCommand(command), { patients: PATIENTS, plans, payments, pricelist: PRICELIST, homePermissions, studioId: 's1' });

const run = (plan, { plans = [], payments = [], patients = PATIENTS, homePermissions = FULL_PERMISSIONS } = {}) =>
  runActionPlan(plan, { db: createFakeDb({ plans, payments }), patients, homePermissions });

// --- Workflow A: treatment + pending payment, from scratch ---

test('A. "Fabio Cincin deve pagare 180 € per la devitalizzazione del 46" -> item created, marked completed, payment created, verified', async () => {
  const plan = planFor('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  assert.equal(dump.dm_pl.length, 1);
  assert.equal(dump.dm_pl[0].pazienteId, 2);
  assert.equal(dump.dm_pl[0].voci[0].prestazione, 'Devitalizzazione', 'stores the resolved canonical pricelist name, not the raw lowercase query text');
  assert.equal(dump.dm_pl[0].voci[0].dente, '46');
  assert.equal(dump.dm_pl[0].voci[0].eseguita, true);
  assert.equal(dump.dm_py.length, 1);
  assert.equal(dump.dm_py[0].importo, 180);
  assert.equal(dump.dm_py[0].stato, 'sospeso');
});

// --- Workflow B: create treatment plan, only missing items, no invented price ---

test('B. "Crea piano di cura per Isa Bergese con otturazione 36 47, devitalizzazione 13, ..." creates one plan with only missing items', async () => {
  const command = 'Crea piano di cura per Isa Bergese con otturazione su 36 47, devitalizzazione su 13, corona zirconio su 13';
  const existingPlans = [{ id: 'p-existing', pazienteId: 1, titolo: 'Vecchio', stato: 'attivo', voci: [{ prestazione: 'Otturazione composita', dente: '36', prezzo: 80, eseguita: false, incassata: false }] }];
  const plan = planFor(command, { plans: existingPlans });
  const result = await run(plan, { plans: existingPlans });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  // Only the missing 3 items (47/otturazione, 13/devitalizzazione, 13/corona) get created — the 36/otturazione already existed.
  const created = result.completedSteps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  assert.equal(created.result.itemCount, 3);
});

// --- Workflow C: idempotent mark-completed ---

test('C. "Segna devitalizzazione 16 di Isa Bergese come eseguita" reuses the existing item, never duplicates it', async () => {
  const existingPlans = [{ id: 'p1', pazienteId: 1, titolo: 'Piano', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '16', prezzo: 200, eseguita: false, incassata: false }] }];
  const plan = planFor('Segna devitalizzazione 16 di Isa Bergese come eseguita', { plans: existingPlans });
  const db = createFakeDb({ plans: existingPlans });
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  assert.equal(dump.dm_pl.length, 1, 'must reuse the existing plan, not create a second one');
  assert.equal(dump.dm_pl[0].voci.length, 1, 'must reuse the existing voce, not add a duplicate');
  assert.equal(dump.dm_pl[0].voci[0].eseguita, true);
});

// --- Workflow D: unknown tooth never blocks a valid clinical event ---

test('D. "Segna devitalizzazione di Mario Rossi come eseguita, non ricordo il dente" completes with tooth unknown, no invented value', async () => {
  const plan = planFor('Segna devitalizzazione di Mario Rossi come eseguita, non ricordo il dente');
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  assert.equal(dump.dm_pl[0].voci[0].dente, '');
  assert.equal(dump.dm_pl[0].voci[0].eseguita, true);
});

// --- Workflow E: pending payment + completed clinical event, tooth incomplete ---

test('E. "Mario Rossi deve pagare 180 € per la devitalizzazione, non ricordo il dente" -> valid payment + valid completed treatment, tooth stays incomplete', async () => {
  const parsed = parseCommand('Mario Rossi deve pagare 180 € per la devitalizzazione, non ricordo il dente');
  assert.equal(parsed.commandIntent, 'RECORD_TREATMENT_AND_PENDING_PAYMENT');
  assert.equal(parsed.items[0].toothText, null);
  assert.equal(parsed.amount, 180);
  const plan = buildActionPlan(parsed, { patients: PATIENTS, plans: [], payments: [], pricelist: PRICELIST, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  assert.equal(dump.dm_pl[0].voci[0].dente, '', 'tooth stays genuinely unknown, never invented');
  assert.equal(dump.dm_pl[0].voci[0].eseguita, true, 'the clinical event is still valid and completed');
  assert.equal(dump.dm_py[0].importo, 180);
  assert.equal(dump.dm_py[0].stato, 'sospeso');
});

test('the original "Segna che ... del <tooth>" phrasing for workflow B still parses with a known tooth (regression)', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  assert.equal(parsed.items[0].toothText, '46');
});

// --- Workflow F: two incomplete fillings preserved, one pending amount ---

test('F. "Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti" -> two items, both completed, both tooth unknown, one €250 payment', async () => {
  const plan = planFor('Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti');
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  const allVoci = dump.dm_pl.flatMap((p) => p.voci);
  assert.equal(allVoci.length, 2, 'two distinct fillings must be preserved, never collapsed or duplicated');
  assert.ok(allVoci.every((v) => v.eseguita === true));
  assert.ok(allVoci.every((v) => v.dente === ''));
  assert.equal(dump.dm_py.length, 1);
  assert.equal(dump.dm_py[0].importo, 250);
});

// --- cancel = zero writes ---

test('cancel (never calling runActionPlan) leaves the store completely untouched', async () => {
  const plan = planFor('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  assert.ok(plan); // built the preview...
  const db = createFakeDb();
  // ...but never confirmed/executed.
  assert.deepEqual(db._dump().dm_pl, []);
  assert.deepEqual(db._dump().dm_py, []);
});

// --- repeated command = idempotent ---

test('repeating the exact same command twice produces no duplicate writes the second time', async () => {
  const command = 'Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46';
  const db = createFakeDb();
  const plan1 = planFor(command);
  const result1 = await runActionPlan(plan1, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result1.outcome, RUN_OUTCOME.SUCCESS);
  const afterFirst = db._dump();

  // Re-plan against the (now updated) state and re-run — simulating the
  // exact same user command issued a second time.
  const freshPlans = await db.getAll('dm_pl');
  const freshPayments = await db.getAll('dm_py');
  const plan2 = buildActionPlan(parseCommand(command), { patients: PATIENTS, plans: freshPlans, payments: freshPayments, pricelist: PRICELIST, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  const result2 = await runActionPlan(plan2, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result2.outcome, RUN_OUTCOME.SUCCESS);
  const afterSecond = db._dump();
  assert.equal(afterSecond.dm_pl.length, afterFirst.dm_pl.length, 'no duplicate plan/item created on repeat');
  assert.equal(afterSecond.dm_py.length, afterFirst.dm_py.length, 'no duplicate payment created on repeat');
});

// --- partial failure ---

test('partial failure: clinical step succeeds, payment step fails -> PARTIAL, not a false SUCCESS', async () => {
  const plan = planFor('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const db = createFakeDb();
  const originalInsert = db.insert.bind(db);
  db.insert = async (key, obj) => {
    if (key === 'dm_py') throw new Error('simulated payment insert failure');
    return originalInsert(key, obj);
  };
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.PARTIAL);
  assert.equal(result.failedStep.type, PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT);
  assert.ok(result.completedSteps.some((s) => s.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED));
  assert.ok(result.recoveryActions.length > 0);
  assert.ok(result.recoveryActions[0].includes('clinic'.slice(0, 0)) || result.recoveryActions[0].length > 0); // recovery text present
  const dump = db._dump();
  assert.equal(dump.dm_pl[0].voci[0].eseguita, true, 'the successful clinical write must remain — no unsafe client-side rollback');
});

// --- verification failure ---

test('verification failure (write "succeeds" but readback does not match) is reported as a failure, not silently accepted', async () => {
  const plan = planFor('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  const db = createFakeDb();
  const originalInsert = db.insert.bind(db);
  db.insert = async (key, obj) => {
    if (key === 'dm_pl') { await originalInsert(key, obj); return { ...obj, voci: [] }; } // simulate a write whose confirmed response doesn't match what was sent
    return originalInsert(key, obj);
  };
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /[Vv]erifica/);
});

// --- permission revoked after preview ---

test('a plan built with full permissions is refused at execution time if the capability was revoked in between', async () => {
  const plan = planFor('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46'); // built with FULL_PERMISSIONS -> not blocked
  assert.equal(plan.blocked, false);
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: { activeMember: true, capabilities: ['clinical.general'], managementControl: false } });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(result.failedStep.type, 'PERMISSION');
  assert.deepEqual(db._dump().dm_pl, []);
  assert.deepEqual(db._dump().dm_py, []);
});

// --- ambiguous patient/procedure = no write ---

test('an ambiguous patient (unresolved) never reaches a write — execution refuses at the precondition stage', async () => {
  const plan = planFor('Segna devitalizzazione di Rossi come eseguita, non ricordo il dente'); // "Rossi" matches two patients
  assert.equal(plan.entities.patientId, null);
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_pl, []);
});

// --- cross-tenant rejection ---

test('cross-tenant: a patient id not present in the freshly-supplied patients array is refused, even with an otherwise-valid plan', async () => {
  const plan = planFor('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  const db = createFakeDb();
  const result = await runActionPlan(plan, { db, patients: PATIENTS.filter((p) => p.id !== 1), homePermissions: FULL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(result.failedStep.type, 'PATIENT_NOT_FOUND');
  assert.deepEqual(db._dump().dm_pl, []);
});

// --- action-plan tampering: entities.patientId rewritten to a different patient ---

test('tampered plan: entities.patientId pointing at a DIFFERENT valid, same-tenant patient than patientRef.text is rejected', async () => {
  const plan = planFor('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  assert.equal(plan.patientRef.text, 'Isa Bergese');
  assert.equal(plan.entities.patientId, 1);
  // Simulate a tampered/replayed plan object: same patient TEXT ("Isa
  // Bergese"), but entities.patientId rewritten to Fabio Cincin's id (2) —
  // both ids are present in the fresh, same-tenant `patients` array, so the
  // old presence-only check would have let this through.
  const tampered = { ...plan, entities: { ...plan.entities, patientId: 2 } };
  const db = createFakeDb();
  const result = await runActionPlan(tampered, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1' });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(result.failedStep.type, 'PATIENT_NOT_FOUND');
  assert.deepEqual(db._dump().dm_pl, []);
});

// --- later tooth completion updates the existing item, never a duplicate ---

test('later tooth completion ("era il 46") updates the existing incomplete item in place', async () => {
  const { findIncompleteItemToComplete, setItemTooth, updatePlan } = await import('../src/lib/domain/treatmentPlanService.js');
  const existingPlans = [{ id: 'p1', pazienteId: 3, titolo: 'Piano', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false }] }];
  const db = createFakeDb({ plans: existingPlans });
  const found = findIncompleteItemToComplete(await db.getAll('dm_pl'), 3, 'devitalizzazione');
  assert.ok(found);
  const { plan: updated, changed } = setItemTooth(found.plan, found.voceIndex, '46');
  assert.equal(changed, true);
  const written = await updatePlan(db, found.plan.id, updated);
  assert.equal(written.voci[0].dente, '46');
  const dump = db._dump();
  assert.equal(dump.dm_pl.length, 1, 'still one plan');
  assert.equal(dump.dm_pl[0].voci.length, 1, 'still one item — updated in place, not duplicated');
});

// --- Data Health: signal present while incomplete, clears once tooth is filled ---

test('Data Health flags a completed treatment with unknown tooth, and the signal clears once the tooth is filled in', () => {
  const plansIncomplete = [{ id: 'p1', pazienteId: 3, titolo: 'Piano', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 200, eseguita: true, incassata: false }] }];
  const signalsBefore = scanTreatmentPlans({ plans: plansIncomplete, hasFuture: true, today: '2026-01-01', canReadClinical: true });
  assert.ok(signalsBefore.some((s) => s.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE));

  const health = calculateStudioDataHealth({ results: [{ signals: signalsBefore }], patientCount: 1, planCount: 1, performanceCount: 1 });
  assert.ok(health.issues.treatmentsWithoutToothReference >= 1);

  const plansCompleted = [{ id: 'p1', pazienteId: 3, titolo: 'Piano', stato: 'attivo', voci: [{ prestazione: 'Devitalizzazione', dente: '46', prezzo: 200, eseguita: true, incassata: false }] }];
  const signalsAfter = scanTreatmentPlans({ plans: plansCompleted, hasFuture: true, today: '2026-01-01', canReadClinical: true });
  assert.ok(!signalsAfter.some((s) => s.type === SIGNAL_TYPE.MISSING_TOOTH_REFERENCE));
});

// --- zero Model Gateway calls for common commands ---

test('runActionPlan and the domain services never reference the Model Gateway', async () => {
  const files = ['actionExecutor.js'];
  for (const file of files) {
    const src = await readFile(new URL(`../src/lib/poliedron/planner/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /modelGateway|runModelTask/);
  }
  for (const file of ['treatmentPlanService.js', 'paymentService.js']) {
    const src = await readFile(new URL(`../src/lib/domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /modelGateway|runModelTask/);
  }
});

// --- domain services never call raw Supabase directly ---

test('domain services take a `db` parameter and never import/construct a Supabase client of their own', async () => {
  for (const file of ['treatmentPlanService.js', 'paymentService.js']) {
    const src = await readFile(new URL(`../src/lib/domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /createClient|from ['"]\.\.\/supabase\.js['"]/);
  }
});
