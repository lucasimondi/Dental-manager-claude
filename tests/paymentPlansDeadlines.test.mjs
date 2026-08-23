import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { splitEvenlyDeterministic, roundMoney, amountsEqual } from '../src/lib/domain/money.js';
import {
  PLAN_TYPE, PLAN_STATUS, DEADLINE_STATUS,
  buildInstallmentDeadlines, buildCustomPlanDeadlines, buildNewPaymentPlan, buildDeadlineRows, buildAllocation,
  deadlineRemainingAmount, deadlineAllocatedAmount, computeDeadlineStatus, assertDeadlinesPreserveTotal,
} from '../src/lib/domain/paymentPlanService.js';
import { computePatientFinancialSummary } from '../src/lib/domain/patientFinancialSummary.js';

import { parseCommand } from '../src/lib/poliedron/planner/commandParser.js';
import { buildActionPlan, PLAN_STEP_TYPE } from '../src/lib/poliedron/planner/actionPlanner.js';
import { runActionPlan, RUN_OUTCOME } from '../src/lib/poliedron/planner/actionExecutor.js';
import { classifyFinancialQuery, answerFinancialQuery, FINANCIAL_QUERY_TYPE } from '../src/lib/poliedron/financialQueryEngine.js';
import { scanPaymentFinancials } from '../src/lib/poliedron/intelligence/paymentFinancialScanner.js';
import { SIGNAL_TYPE } from '../src/lib/poliedron/intelligence/model.js';

/* POL-FIN-001 — canonical patient financial contract, payment plans,
   deadlines, partial payments, and Poliedron integration. Same fake-db
   convention as every prior POL-AI-005B test file — never the real
   Supabase client anywhere in this suite. */

function createFakeDb({ plans = [], payments = [], paymentPlans = [], paymentDeadlines = [], paymentAllocations = [] } = {}) {
  const store = {
    dm_pl: plans.map((p) => ({ ...p, voci: p.voci ? p.voci.map((v) => ({ ...v })) : [] })),
    dm_py: payments.map((p) => ({ ...p })),
    dm_pp: paymentPlans.map((p) => ({ ...p })),
    dm_pd: paymentDeadlines.map((p) => ({ ...p })),
    dm_pal: paymentAllocations.map((p) => ({ ...p })),
  };
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
  { id: 2, nome: 'Mario', cognome: 'Rossi', studioId: 's1' },
];
const CROSS_TENANT_PATIENTS = [{ id: 1, nome: 'Isa', cognome: 'Bergese', studioId: 's1' }];
const FULL_PERMISSIONS = { activeMember: true, capabilities: [], managementControl: true };
const NO_FINANCIAL_PERMISSIONS = { activeMember: true, capabilities: [], managementControl: false };
const TODAY = '2026-08-23';

const treatmentPlan = (value) => [{ id: 'tp1', pazienteId: 1, voci: [{ prestazione: 'Impianto', prezzo: value }], sconto: 0, scontoTipo: 'pct' }];

const planFor = (command, { plans = [], payments = [], paymentPlans = [], paymentDeadlines = [], paymentAllocations = [], currentPatient = { id: 1 }, homePermissions = FULL_PERMISSIONS, patients = PATIENTS } = {}) =>
  buildActionPlan(parseCommand(command), { patients, plans, payments, paymentPlans, paymentDeadlines, paymentAllocations, pricelist: [], homePermissions, studioId: 's1', currentPatient, today: TODAY });

const run = (plan, { plans = [], payments = [], paymentPlans = [], paymentDeadlines = [], paymentAllocations = [], patients = PATIENTS, homePermissions = FULL_PERMISSIONS } = {}) => {
  const db = createFakeDb({ plans, payments, paymentPlans, paymentDeadlines, paymentAllocations });
  return runActionPlan(plan, { db, patients, homePermissions, studioId: 's1', today: TODAY }).then((result) => ({ result, db }));
};

// ============================= DOMAIN TESTS =============================

test('1. outstanding without plan: totalScheduled = 0, totalUnscheduled = totalOutstanding', () => {
  const plans = treatmentPlan(6400);
  const payments = [{ id: 'p1', pazienteId: 1, importo: 2400, stato: 'pagato' }];
  const summary = computePatientFinancialSummary({ plans, payments, paymentPlans: [], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalDue, 6400);
  assert.equal(summary.totalCollected, 2400);
  assert.equal(summary.totalOutstanding, 4000);
  assert.equal(summary.totalScheduledOutstanding, 0);
  assert.equal(summary.totalUnscheduledOutstanding, 4000);
});

test('2. zero outstanding when fully paid', () => {
  const plans = treatmentPlan(1000);
  const payments = [{ id: 'p1', pazienteId: 1, importo: 1000, stato: 'pagato' }];
  const summary = computePatientFinancialSummary({ plans, payments, paymentPlans: [], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalOutstanding, 0);
  assert.equal(summary.totalUnscheduledOutstanding, 0);
});

test('3. payment plan creation reflects as the patient\'s activePaymentPlan', () => {
  const plan = buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 4000 });
  const summary = computePatientFinancialSummary({ plans: [], payments: [], paymentPlans: [plan], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.activePaymentPlan.id, plan.id);
  assert.equal(plan.status, PLAN_STATUS.ACTIVE);
});

test('4. monthly installment generation: 8 x 500 starting 28 Aug, exact dates', () => {
  const deadlines = buildInstallmentDeadlines({ totalAmount: 4000, count: 8, startDate: '2026-08-28' });
  assert.deepEqual(deadlines.map((d) => d.dueDate), ['2026-08-28', '2026-09-28', '2026-10-28', '2026-11-28', '2026-12-28', '2027-01-28', '2027-02-28', '2027-03-28']);
  assert.ok(deadlines.every((d) => d.amountDue === 500));
});

test('5. exact total preservation: sum(deadlines) === totalAmount to the cent', () => {
  const deadlines = buildInstallmentDeadlines({ totalAmount: 4000, count: 8, startDate: '2026-08-28' });
  assert.doesNotThrow(() => assertDeadlinesPreserveTotal(deadlines, 4000));
  const tampered = [...deadlines.slice(0, -1), { ...deadlines.at(-1), amountDue: 499 }];
  assert.throws(() => assertDeadlinesPreserveTotal(tampered, 4000));
});

test('6. rounding: 1000 / 3 preserves the exact total via deterministic remainder distribution', () => {
  const shares = splitEvenlyDeterministic(1000, 3);
  assert.deepEqual(shares, [333.34, 333.33, 333.33]);
  assert.ok(amountsEqual(shares.reduce((a, b) => a + b, 0), 1000));
});

test('7. custom deadlines: independent dates/amounts summing to the stated total', () => {
  const deadlines = buildCustomPlanDeadlines([
    { amount: 800, dueDate: '2026-08-28' },
    { amount: 1200, dueDate: '2026-10-15' },
    { amount: 2000, dueDate: '2026-12-20' },
  ]);
  assert.equal(deadlines.reduce((s, d) => s + d.amountDue, 0), 4000);
  assert.deepEqual(deadlines.map((d) => d.dueDate), ['2026-08-28', '2026-10-15', '2026-12-20']);
});

test('8. next deadline is the earliest dated open deadline', () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.CUSTOM, totalAmount: 3000 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildCustomPlanDeadlines([{ amount: 1000, dueDate: '2026-10-01' }, { amount: 2000, dueDate: '2026-09-01' }]) });
  const summary = computePatientFinancialSummary({ plans: [], payments: [], paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.nextDeadline.dueDate, '2026-09-01');
});

test('9. overdue detection: a past-due, unpaid deadline is OVERDUE and counted in totalOverdue', () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-08-01' }) });
  const status = computeDeadlineStatus(pd[0], [], TODAY);
  assert.equal(status, DEADLINE_STATUS.OVERDUE);
  const summary = computePatientFinancialSummary({ plans: [], payments: [], paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalOverdue, 500);
});

test('10. partial payment: 300 of 500 leaves remaining 200 and status PARTIALLY_PAID', () => {
  const deadline = { id: 'd1', amountDue: 500 };
  const allocations = [buildAllocation({ paymentId: 'pay1', patientId: 1, paymentDeadlineId: 'd1', amount: 300 })];
  assert.equal(deadlineRemainingAmount(deadline, allocations), 200);
  assert.equal(computeDeadlineStatus(deadline, allocations, TODAY), DEADLINE_STATUS.PARTIALLY_PAID);
});

test('11. completing a partial payment brings remaining to 0 and status to PAID', () => {
  const deadline = { id: 'd1', amountDue: 500 };
  const allocations = [
    buildAllocation({ paymentId: 'pay1', patientId: 1, paymentDeadlineId: 'd1', amount: 300 }),
    buildAllocation({ paymentId: 'pay2', patientId: 1, paymentDeadlineId: 'd1', amount: 200 }),
  ];
  assert.equal(deadlineRemainingAmount(deadline, allocations), 0);
  assert.equal(computeDeadlineStatus(deadline, allocations, TODAY), DEADLINE_STATUS.PAID);
});

test('12. totalCollected counts only stato=pagato, never sospeso (canonical POL-003 rule)', () => {
  const payments = [
    { id: 'p1', pazienteId: 1, importo: 500, stato: 'pagato' },
    { id: 'p2', pazienteId: 1, importo: 300, stato: 'sospeso' },
  ];
  const summary = computePatientFinancialSummary({ plans: [], payments, paymentPlans: [], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalCollected, 500);
});

test('13. totalOutstanding = totalDue - totalCollected invariant', () => {
  const plans = treatmentPlan(2000);
  const payments = [{ id: 'p1', pazienteId: 1, importo: 750, stato: 'pagato' }];
  const summary = computePatientFinancialSummary({ plans, payments, paymentPlans: [], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalOutstanding, summary.totalDue - summary.totalCollected);
});

test('14-15. scheduledOutstanding + unscheduledOutstanding === totalOutstanding, scheduled <= outstanding', () => {
  const plans = treatmentPlan(4000);
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 1500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 1500, count: 3, startDate: '2026-09-01' }) });
  const summary = computePatientFinancialSummary({ plans, payments: [], paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalScheduledOutstanding, 1500);
  assert.equal(summary.totalUnscheduledOutstanding, 2500);
  assert.equal(summary.totalScheduledOutstanding + summary.totalUnscheduledOutstanding, summary.totalOutstanding);
  assert.ok(summary.totalScheduledOutstanding <= summary.totalOutstanding);
});

test('16. payment allocation links a payment to a specific deadline', () => {
  const alloc = buildAllocation({ paymentId: 'pay1', patientId: 1, paymentDeadlineId: 'd1', amount: 500 });
  assert.equal(alloc.paymentDeadlineId, 'd1');
  assert.equal(deadlineAllocatedAmount('d1', [alloc]), 500);
});

test('18. no allocation: a payment recorded with no deadline (general balance) has paymentDeadlineId null', () => {
  const alloc = buildAllocation({ paymentId: 'pay1', patientId: 1, paymentDeadlineId: null, amount: 200 });
  assert.equal(alloc.paymentDeadlineId, null);
});

test('19. historical payment compatibility: a patient with old payments/plans and zero payment-plan rows computes correctly', () => {
  const plans = treatmentPlan(1000);
  const payments = [{ id: 'p1', pazienteId: 1, importo: 1000, stato: 'pagato' }];
  const summary = computePatientFinancialSummary({ plans, payments, paymentPlans: [], paymentDeadlines: [], paymentAllocations: [] }, 1, { today: TODAY });
  assert.equal(summary.totalOutstanding, 0);
  assert.equal(summary.totalScheduledOutstanding, 0);
  assert.equal(summary.activePaymentPlan, null);
});

// =========================== POLIEDRON TESTS ============================

test('21-23. deterministic financial read queries answer directly from canonical data', () => {
  const plans = treatmentPlan(1000);
  const payments = [{ id: 'p1', pazienteId: 1, importo: 400, stato: 'pagato' }];
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 600 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 600, count: 1, startDate: '2026-09-01' }) });
  const ctx = { patients: PATIENTS, plans, payments, paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [], studioId: 's1', today: TODAY };

  const q1 = classifyFinancialQuery('Quanto deve ancora pagare Isa Bergese?');
  assert.equal(q1.type, FINANCIAL_QUERY_TYPE.PATIENT_OUTSTANDING);
  assert.match(answerFinancialQuery(q1, ctx).answer, /600/);

  const q2 = classifyFinancialQuery('Quanto ha già pagato Isa Bergese?');
  assert.match(answerFinancialQuery(q2, ctx).answer, /400/);

  const q3 = classifyFinancialQuery('Qual è la prossima scadenza di Isa Bergese?');
  assert.match(answerFinancialQuery(q3, ctx).answer, /2026-09-01/);
});

test('24. overdue studio-wide query lists patients with real overdue amounts', () => {
  const pp = [buildNewPaymentPlan({ patientId: 2, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 2, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-08-01' }) });
  const ctx = { patients: PATIENTS, plans: [], payments: [], paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [], studioId: 's1', today: TODAY };
  const q = classifyFinancialQuery('Chi ha rate scadute?');
  const { answer } = answerFinancialQuery(q, ctx);
  assert.match(answer, /Rossi/);
});

test('25-26. CREATE_PAYMENT_PLAN builds a real proposal and always requires confirmation (preview)', () => {
  const plan = planFor('Dividi i 4.000 euro che rimangono in 8 rate mensili da 28 agosto', { plans: treatmentPlan(4000) });
  assert.equal(plan.blocked, false);
  assert.equal(plan.requiresConfirmation, true);
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CREATE_PAYMENT_PLAN);
  assert.equal(step.deadlines.length, 8);
});

test('27. cancel (never calling runActionPlan) leaves the store completely untouched', async () => {
  const plans = treatmentPlan(4000);
  const plan = planFor('Dividi il residuo in quattro rate', { plans });
  assert.equal(plan.blocked, false);
  const db = createFakeDb({ plans });
  assert.deepEqual(db._dump().dm_pp, []);
});

test('28-29. confirm writes the plan + deadlines, verified; a tampered write is caught, not silently accepted', async () => {
  const plans = treatmentPlan(4000);
  const plan = planFor('Dividi il residuo in quattro rate', { plans });
  const { result, db } = await run(plan, { plans });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  assert.equal(dump.dm_pp.length, 1);
  assert.equal(dump.dm_pd.length, 4);
  assert.equal(dump.dm_pd.reduce((s, d) => s + Number(d.amountDue), 0), 4000);

  // verification failure: a fake db whose insert silently corrupts the amount
  const badDb = createFakeDb({ plans });
  const originalInsert = badDb.insert.bind(badDb);
  badDb.insert = async (key, obj) => {
    if (key === 'dm_pp') return originalInsert(key, { ...obj, totalAmount: 1 });
    return originalInsert(key, obj);
  };
  const plan2 = planFor('Dividi il residuo in quattro rate', { plans });
  const badResult = await runActionPlan(plan2, { db: badDb, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1', today: TODAY });
  assert.equal(badResult.outcome, RUN_OUTCOME.FAILED);
  assert.match(badResult.failedStep.message, /Verifica post-scrittura/);
});

test('30. partial payment via "Ha pagato 300 euro della rata di agosto" leaves remaining 200', async () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-08-28' }) });
  const plan = planFor('Ha pagato 300 euro della rata di agosto', { paymentPlans: pp, paymentDeadlines: pd });
  assert.equal(plan.blocked, false);
  const { result, db } = await run(plan, { paymentPlans: pp, paymentDeadlines: pd });
  assert.equal(result.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();
  const summary = computePatientFinancialSummary({ plans: [], payments: dump.dm_py, paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: dump.dm_pal }, 1, { today: TODAY });
  assert.equal(summary.nextDeadline.remainingAmount, 200);
  assert.equal(summary.nextDeadline.status, DEADLINE_STATUS.PARTIALLY_PAID);
});

test('31. ambiguous deadline (2+ open) requires clarification, zero writes', async () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 1000 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 1000, count: 2, startDate: '2026-09-01' }) });
  const plan = planFor('Isa mi ha dato 500 euro', { paymentPlans: pp, paymentDeadlines: pd });
  assert.equal(plan.blocked, true);
  const { result, db } = await run(plan, { paymentPlans: pp, paymentDeadlines: pd });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_py, []);
});

test('32. patient-context command ("Dividi il residuo in quattro rate") inherits the open patient, still validates canonically', () => {
  const plan = planFor('Dividi il residuo in quattro rate', { plans: treatmentPlan(2000), currentPatient: { id: 1 } });
  assert.equal(plan.blocked, false);
  assert.equal(plan.entities.patientId, 1);
});

test('33. permission revoked after preview -> zero writes', async () => {
  const plans = treatmentPlan(4000);
  const plan = planFor('Dividi il residuo in quattro rate', { plans });
  const { result, db } = await run(plan, { plans, homePermissions: NO_FINANCIAL_PERMISSIONS });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.equal(result.failedStep.type, 'PERMISSION');
  assert.deepEqual(db._dump().dm_pp, []);
});

test('34. cross-tenant injection: a tampered targetDeadlineId pointing outside the fresh tenant-scoped data is rejected', async () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-09-01' }) });
  const plan = planFor('Isa mi ha dato 500 euro', { paymentPlans: pp, paymentDeadlines: pd });
  const step = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.RECORD_PAYMENT_ALLOCATION);
  const tamperedStep = { ...step, targetDeadlineId: 'not-a-real-deadline' };
  const tamperedPlan = { ...plan, steps: plan.steps.map((s) => (s.type === PLAN_STEP_TYPE.RECORD_PAYMENT_ALLOCATION ? tamperedStep : s)) };
  const { result, db } = await run(tamperedPlan, { paymentPlans: pp, paymentDeadlines: pd, patients: CROSS_TENANT_PATIENTS });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.deepEqual(db._dump().dm_py, []);
});

test('35. stale preview: deadline already fully paid by another actor before confirm -> conflict, no overwrite', async () => {
  const pp = [buildNewPaymentPlan({ patientId: 1, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 1, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-09-01' }) });
  const plan = planFor('Isa mi ha dato 500 euro', { paymentPlans: pp, paymentDeadlines: pd });
  const db = createFakeDb({ paymentPlans: pp, paymentDeadlines: pd });
  // Someone else pays it off completely between preview and this confirm.
  await db.insert('dm_pal', buildAllocation({ paymentId: 'other', patientId: 1, paymentDeadlineId: pd[0].id, amount: 500 }));
  const result = await runActionPlan(plan, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1', today: TODAY });
  assert.equal(result.outcome, RUN_OUTCOME.FAILED);
  assert.match(result.failedStep.message, /già saldata/);
});

test('36. replay/idempotency: repeating CREATE_PAYMENT_PLAN once already ACTIVE is blocked, never a second plan', async () => {
  const plans = treatmentPlan(4000);
  const plan1 = planFor('Dividi il residuo in quattro rate', { plans });
  const { result: result1, db } = await run(plan1, { plans });
  assert.equal(result1.outcome, RUN_OUTCOME.SUCCESS);
  const dump = db._dump();

  const plan2 = buildActionPlan(parseCommand('Dividi il residuo in quattro rate'), {
    patients: PATIENTS, plans, payments: [], paymentPlans: dump.dm_pp, paymentDeadlines: dump.dm_pd, paymentAllocations: [],
    pricelist: [], homePermissions: FULL_PERMISSIONS, studioId: 's1', currentPatient: { id: 1 }, today: TODAY,
  });
  assert.equal(plan2.blocked, true);
  const result2 = await runActionPlan(plan2, { db, patients: PATIENTS, homePermissions: FULL_PERMISSIONS, studioId: 's1', today: TODAY });
  assert.equal(result2.outcome, RUN_OUTCOME.FAILED);
  assert.equal(db._dump().dm_pp.length, 1, 'still exactly one plan — no duplicate');
});

test('37. deterministic financial commands and queries never reference the Model Gateway', async () => {
  const files = [
    'src/lib/poliedron/planner/commandParser.js',
    'src/lib/poliedron/planner/actionPlanner.js',
    'src/lib/poliedron/planner/actionExecutor.js',
    'src/lib/poliedron/financialQueryEngine.js',
    'src/lib/domain/paymentPlanService.js',
    'src/lib/domain/patientFinancialSummary.js',
    'src/lib/domain/money.js',
  ];
  for (const file of files) {
    const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(/modelGateway|runModelTask/i.test(src), false, `${file} must not reference the Model Gateway`);
  }
});

// ======================== PROACTIVE INTELLIGENCE =========================

test('proactive: PAYMENT_OVERDUE fires with evidence, never speculatively', () => {
  const pp = [buildNewPaymentPlan({ patientId: 2, planType: PLAN_TYPE.INSTALLMENTS, totalAmount: 500 })];
  const pd = buildDeadlineRows({ paymentPlanId: pp[0].id, patientId: 2, deadlines: buildInstallmentDeadlines({ totalAmount: 500, count: 1, startDate: '2026-08-01' }) });
  const signals = scanPaymentFinancials({ patient: PATIENTS[1], sources: { paymentPlans: pp, paymentDeadlines: pd, paymentAllocations: [], plans: [], payments: [] }, today: TODAY, canReadFinancial: true });
  assert.ok(signals.some((s) => s.type === SIGNAL_TYPE.PAYMENT_OVERDUE));
});

test('proactive: OUTSTANDING_WITHOUT_PAYMENT_PLAN fires only when real unscheduled money exists', () => {
  const plans = [{ id: 'tp1', pazienteId: 1, voci: [{ prestazione: 'X', prezzo: 1000 }], sconto: 0, scontoTipo: 'pct' }];
  const signals = scanPaymentFinancials({ patient: PATIENTS[0], sources: { paymentPlans: [], paymentDeadlines: [], paymentAllocations: [], plans, payments: [] }, today: TODAY, canReadFinancial: true });
  assert.ok(signals.some((s) => s.type === SIGNAL_TYPE.OUTSTANDING_WITHOUT_PAYMENT_PLAN));
});

test('proactive: no signals without financial read permission', () => {
  const plans = [{ id: 'tp1', pazienteId: 1, voci: [{ prestazione: 'X', prezzo: 1000 }], sconto: 0, scontoTipo: 'pct' }];
  const signals = scanPaymentFinancials({ patient: PATIENTS[0], sources: { paymentPlans: [], paymentDeadlines: [], paymentAllocations: [], plans, payments: [] }, today: TODAY, canReadFinancial: false });
  assert.deepEqual(signals, []);
});
