import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseCommand, COMMAND_INTENT } from '../src/lib/poliedron/planner/commandParser.js';
import { resolvePatient, PATIENT_RESOLUTION_STATUS } from '../src/lib/poliedron/planner/patientResolver.js';
import { resolveProcedure, PROCEDURE_RESOLUTION_STATUS } from '../src/lib/poliedron/planner/procedureResolver.js';
import { createTooth, TOOTH_STATE, isValidToothNumber } from '../src/lib/poliedron/planner/toothModel.js';
import { buildActionPlan, executeActionPlan, PLAN_STEP_TYPE, PRICE_UNRESOLVED } from '../src/lib/poliedron/planner/actionPlanner.js';
import { sanitizeModelSemanticOutput, containsForbiddenAuthoritativeKey, MODEL_SEMANTIC_FIELDS } from '../src/lib/poliedron/planner/modelFallbackContract.js';
import { deriveDataHealthSignalsFromPlan } from '../src/lib/poliedron/planner/dataHealthHandoff.js';

/* POL-AI-005A §21 — the Product Owner's explicit test list for the
   Transactional Action Planner foundation (Phase A: UNDERSTAND -> RESOLVE
   -> PLAN only, no writes). */

const PATIENTS = [
  { id: 1, nome: 'Isa', cognome: 'Bergese', studioId: 's1' },
  { id: 2, nome: 'Fabio', cognome: 'Cincin', studioId: 's1' },
  { id: 3, nome: 'Mario', cognome: 'Rossi', studioId: 's1' },
  { id: 4, nome: 'Marco', cognome: 'Rossi', studioId: 's1' },
  { id: 5, nome: 'Luca', cognome: 'Bianchi', studioId: 's1' },
];

const PRICELIST = [
  { nome: 'Otturazione composita', prezzo: 80 },
  { nome: 'Otturazione in amalgama', prezzo: 70 },
  { nome: 'Devitalizzazione', prezzo: 200 },
  { nome: 'Corona zirconio', prezzo: 500 },
];

const EXISTING_PLANS = [
  { id: 'plan-1', pazienteId: 1, titolo: 'Piano Bergese', voci: [{ prestazione: 'Devitalizzazione', dente: '16', prezzo: 200, eseguita: false }] },
];

const EXISTING_PAYMENTS = [
  { id: 'pay-1', pazienteId: 2, importo: 180, stato: 'sospeso', metodo: 'Contanti' },
];

const fullContext = (overrides = {}) => ({
  patients: PATIENTS, plans: EXISTING_PLANS, payments: EXISTING_PAYMENTS, pricelist: PRICELIST,
  homePermissions: { activeMember: true, capabilities: ['clinical.general'], managementControl: true },
  studioId: 's1',
  ...overrides,
});

// --- deterministic command A/B/C/D/E ---

test('A. "Segna devitalizzazione 16 di Isa Bergese come eseguita" parses deterministically', () => {
  const parsed = parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.MARK_TREATMENT_COMPLETED);
  assert.equal(parsed.patientText, 'Isa Bergese');
  assert.equal(parsed.items[0].procedureText, 'devitalizzazione');
  assert.equal(parsed.items[0].toothText, '16');
});

test('B. "Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46" parses deterministically', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.RECORD_TREATMENT_AND_PENDING_PAYMENT);
  assert.equal(parsed.patientText, 'Fabio Cincin');
  assert.equal(parsed.items[0].procedureText, 'devitalizzazione');
  assert.equal(parsed.items[0].toothText, '46');
  assert.equal(parsed.amount, 180);
  assert.equal(parsed.executionCompleted, true);
});

test('C. "Crea piano di cura per Isa Bergese con otturazione su 36 47, devitalizzazione su 13, perno in fibra su 13, corona zirconio su 13" -> 5 items', () => {
  const parsed = parseCommand('Crea piano di cura per Isa Bergese con otturazione su 36 47, devitalizzazione su 13, perno in fibra su 13, corona zirconio su 13');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.CREATE_TREATMENT_PLAN);
  assert.equal(parsed.patientText, 'Isa Bergese');
  assert.equal(parsed.items.length, 5);
  assert.deepEqual(parsed.items.map((i) => i.toothText), ['36', '47', '13', '13', '13']);
});

test('D. "Segna devitalizzazione di Rossi come eseguita, non ricordo il dente" -> tooth unknown at entry', () => {
  const parsed = parseCommand('Segna devitalizzazione di Rossi come eseguita, non ricordo il dente');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.MARK_TREATMENT_COMPLETED);
  assert.equal(parsed.items[0].toothText, null);
  assert.equal(createTooth(parsed.items[0].toothText).state, TOOTH_STATE.UNKNOWN_AT_ENTRY);
});

test('E. "Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti" -> 2 items, unknown teeth, amount 250', () => {
  const parsed = parseCommand('Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti');
  assert.equal(parsed.commandIntent, COMMAND_INTENT.RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT);
  assert.equal(parsed.items.length, 2);
  assert.ok(parsed.items.every((i) => i.toothText === null));
  assert.equal(parsed.amount, 250);
});

// --- unknown tooth / two incomplete fillings preserved as two items ---

test('unknown tooth does not invalidate the treatment: MARK_TREATMENT_COMPLETED plan still proceeds', () => {
  const parsed = parseCommand('Segna devitalizzazione di Mario Rossi come eseguita, non ricordo il dente');
  // Force resolution to the unambiguous "Mario Rossi" full name, not bare "Rossi".
  const plan = buildActionPlan(parsed, fullContext());
  const markStep = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED);
  assert.ok(markStep, 'expected a MARK_TREATMENT_COMPLETED step even with an unknown tooth');
  assert.equal(markStep.tooth.state, TOOTH_STATE.UNKNOWN_AT_ENTRY);
  assert.ok(plan.assumptions.some((a) => a.includes('incompleto')));
});

test('two explicit incomplete fillings are preserved as two distinct planned items, never collapsed', () => {
  const parsed = parseCommand('Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti');
  const plan = buildActionPlan(parsed, fullContext());
  const ensureSteps = plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  assert.equal(ensureSteps.length, 2, 'two incomplete fillings must produce two ENSURE_TREATMENT_ITEM steps, not one');
});

// --- explicit amounts ---

test('explicit €180 amount reaches the plan (workflow A)', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const plan = buildActionPlan(parsed, fullContext());
  const ensurePayment = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT);
  assert.equal(ensurePayment.amount, 180);
});

test('explicit €250 amount reaches the plan (workflow E)', () => {
  const parsed = parseCommand('Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti');
  const plan = buildActionPlan(parsed, fullContext());
  const ensurePayment = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT);
  assert.equal(ensurePayment.amount, 250);
});

// --- patient ambiguity ---

test('patient ambiguity: "Rossi" alone matches two patients -> AMBIGUOUS, no candidate chosen', () => {
  const resolution = resolvePatient('Rossi', PATIENTS, { studioId: 's1' });
  assert.equal(resolution.status, PATIENT_RESOLUTION_STATUS.AMBIGUOUS);
  assert.equal(resolution.candidate, null);
  assert.equal(resolution.candidates.length, 2);
});

test('an ambiguous patient produces a VERIFY_REQUIRED_LATER step and low confidence, never a guessed patientId', () => {
  const parsed = parseCommand('Segna devitalizzazione di Rossi come eseguita, non ricordo il dente');
  const plan = buildActionPlan(parsed, fullContext());
  assert.equal(plan.entities.patientId, null);
  assert.ok(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.VERIFY_REQUIRED_LATER));
  assert.ok(plan.confidence < 0.5);
});

// --- procedure ambiguity ---

test('procedure ambiguity: "otturazione" strong-matches two pricelist rows -> AMBIGUOUS', () => {
  const resolution = resolveProcedure('otturazione', PRICELIST);
  assert.equal(resolution.status, PROCEDURE_RESOLUTION_STATUS.AMBIGUOUS);
  assert.equal(resolution.candidates.length, 2);
});

// --- price unresolved ---

test('a procedure absent from the pricelist resolves to PRICE_UNRESOLVED, never zero or an invented price', () => {
  const parsed = parseCommand('Crea piano di cura per Isa Bergese con perno in fibra su 13');
  const plan = buildActionPlan(parsed, fullContext());
  const ensureStep = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  assert.equal(ensureStep.procedureRef.price, PRICE_UNRESOLVED);
  assert.ok(plan.warnings.some((w) => w.includes('PRICE_UNRESOLVED')));
});

// --- existing treatment reused / missing treatment planned ---

test('existing treatment is reused: no duplicate ENSURE_TREATMENT_ITEM when a matching plan item already exists', () => {
  const parsed = parseCommand('Segna devitalizzazione 16 di Isa Bergese come eseguita');
  const plan = buildActionPlan(parsed, fullContext());
  const checkStep = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CHECK_EXISTING_TREATMENT);
  assert.equal(checkStep.found, true);
  assert.equal(checkStep.existingPlanId, 'plan-1');
  assert.equal(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM), false, 'must reuse, not re-create, the existing item');
  const markStep = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED);
  assert.equal(markStep.existingPlanId, 'plan-1');
  assert.equal(markStep.existingVoceIndex, 0);
});

test('missing treatment is planned: a tooth/procedure combo not already on file gets an ENSURE_TREATMENT_ITEM step', () => {
  const parsed = parseCommand('Segna devitalizzazione 27 di Isa Bergese come eseguita');
  const plan = buildActionPlan(parsed, fullContext());
  const checkStep = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CHECK_EXISTING_TREATMENT);
  assert.equal(checkStep.found, false);
  assert.ok(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM));
});

// --- duplicate pending payment recognized ---

test('a pending payment matching the same patient and amount is recognized and flagged, not silently duplicated', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const plan = buildActionPlan(parsed, fullContext());
  const checkPayment = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CHECK_EXISTING_PENDING_PAYMENT);
  assert.equal(checkPayment.found, true);
  assert.equal(checkPayment.existingPaymentId, 'pay-1');
  assert.ok(plan.warnings.some((w) => w.includes('sospeso')));
  // Still represented explicitly — flagged, not suppressed.
  assert.ok(plan.steps.some((s) => s.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT));
});

// --- permission requirement included ---

test('permission requirement is included per step and satisfied permissions do not block the plan', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const plan = buildActionPlan(parsed, fullContext());
  assert.ok(plan.requiredPermissions.includes('clinical'));
  assert.ok(plan.requiredPermissions.includes('financial'));
  assert.equal(plan.blocked, false);
});

test('missing financial capability blocks the plan with a visible warning, not a silent partial execution', () => {
  const parsed = parseCommand('Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46');
  const plan = buildActionPlan(parsed, fullContext({
    homePermissions: { activeMember: true, capabilities: ['clinical.general'], managementControl: false },
  }));
  assert.equal(plan.blocked, true);
  assert.ok(plan.warnings.some((w) => w.includes('financial')));
});

// --- cross-tenant candidate rejected ---

test('cross-tenant candidate rejected: a patients array scoped to a different studio never resolves', () => {
  const crossTenantOnly = [{ id: 99, nome: 'Isa', cognome: 'Bergese', studioId: 'OTHER_STUDIO' }];
  const resolution = resolvePatient('Isa Bergese', crossTenantOnly, { studioId: 's1' });
  assert.equal(resolution.status, PATIENT_RESOLUTION_STATUS.INVALID);
  assert.equal(resolution.candidate, null);
});

// --- no model call for common commands ---

test('no Model Gateway reference anywhere in the deterministic parser/resolver/planner modules', async () => {
  const files = ['commandParser.js', 'patientResolver.js', 'procedureResolver.js', 'actionPlanner.js', 'toothModel.js'];
  for (const file of files) {
    const src = await readFile(new URL(`../src/lib/poliedron/planner/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /modelGateway|runModelTask/, `${file} must never call the Model Gateway for the deterministic path`);
  }
});

test('all five documented command families parse without any modelGateway import at all', () => {
  const commands = [
    'Segna devitalizzazione 16 di Isa Bergese come eseguita',
    'Segna che Fabio Cincin deve pagare 180 € per la devitalizzazione del 46',
    'Crea piano di cura per Isa Bergese con otturazione su 36 47, devitalizzazione su 13, perno in fibra su 13, corona zirconio su 13',
    'Segna devitalizzazione di Rossi come eseguita, non ricordo il dente',
    'Oggi a Bianchi ho fatto due otturazioni e mi deve 250 euro, ma non ricordo i denti',
  ];
  for (const command of commands) assert.ok(parseCommand(command), `expected a deterministic parse for: ${command}`);
});

// --- model fallback contract cannot supply authoritative IDs ---

test('model fallback contract strips any authoritative id-like key from a model response', () => {
  const raw = { intent: 'MARK_TREATMENT_COMPLETED', patientText: 'Isa Bergese', patientId: 42, procedureId: 7 };
  const sanitized = sanitizeModelSemanticOutput(raw);
  assert.ok(!('patientId' in sanitized));
  assert.ok(!('procedureId' in sanitized));
  assert.equal(sanitized.patientText, 'Isa Bergese');
  assert.ok(containsForbiddenAuthoritativeKey(raw));
});

test('MODEL_SEMANTIC_FIELDS contains only semantic text/interpretation fields, no id-shaped field', () => {
  assert.ok(!MODEL_SEMANTIC_FIELDS.some((f) => /id$/i.test(f)));
});

// --- no Supabase write from planner (mandatory regression) ---

test('no Supabase write/mutation call anywhere in the planner module tree', async () => {
  const dir = new URL('../src/lib/poliedron/planner/', import.meta.url);
  const entries = await readdir(dir);
  const writePattern = /\.(insert|upsert|update|delete|rpc)\s*\(|supabaseClient|createClient/;
  for (const entry of entries.filter((f) => f.endsWith('.js'))) {
    const src = await readFile(new URL(entry, dir), 'utf8');
    assert.doesNotMatch(src, writePattern, `${entry} must contain no Supabase write/mutation call`);
  }
});

test('executeActionPlan is a rejecting stub, not a silent no-op', async () => {
  await assert.rejects(() => executeActionPlan({ actionId: 'x' }), /not implemented in Phase A/);
});

// --- tooth model ---

test('createTooth: known/unknown/legacy-incomplete states are distinguished, never invented', () => {
  assert.equal(createTooth('16').state, TOOTH_STATE.KNOWN);
  assert.equal(createTooth(null).state, TOOTH_STATE.UNKNOWN_AT_ENTRY);
  assert.equal(createTooth('99').state, TOOTH_STATE.LEGACY_INCOMPLETE); // not a valid FDI tooth
  assert.equal(isValidToothNumber(16), true);
  assert.equal(isValidToothNumber(99), false);
});

// --- data health handoff (design only, not persisted) ---

test('an incomplete tooth in a finalized plan derives exactly one Data Health signal, matching the real signal shape', () => {
  const parsed = parseCommand('Segna devitalizzazione di Mario Rossi come eseguita, non ricordo il dente');
  const plan = buildActionPlan(parsed, fullContext());
  const signals = deriveDataHealthSignalsFromPlan(plan);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'CLINICAL_METADATA_INCOMPLETE');
  assert.equal(signals[0].taxonomy, 'DATA_QUALITY');
  assert.equal(signals[0].context.field, 'tooth');
});

// --- every plan requires confirmation (Phase A invariant) ---

test('every generated plan requires confirmation — no plan is ever self-executing', () => {
  for (const command of [
    'Segna devitalizzazione 16 di Isa Bergese come eseguita',
    'Crea piano di cura per Isa Bergese con otturazione su 36',
  ]) {
    const plan = buildActionPlan(parseCommand(command), fullContext());
    assert.equal(plan.requiresConfirmation, true);
  }
});
