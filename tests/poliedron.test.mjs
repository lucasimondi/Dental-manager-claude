import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NAVIGATION_INDEX, findNavigationById } from '../src/lib/poliedron/navigationIndex.js';
import {
  FEATURE_GATE_BY_NAV_ID, ADMIN_ONLY_NAV_IDS, isNavItemAllowed, filterNavigationIndex, isActionAllowed, filterActions,
} from '../src/lib/poliedron/permissionEngine.js';
import { ACTION_REGISTRY, findAction } from '../src/lib/poliedron/actionRegistry.js';
import { INTENT, classifyIntent, extractAmount } from '../src/lib/poliedron/intentEngine.js';
import { RESULT_GROUP, federatedSearch, suggestedIdle } from '../src/lib/poliedron/searchEngine.js';
import { buildContext, inferPatientHint } from '../src/lib/poliedron/contextEngine.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const patients = [
  { id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: 'RSSMRA80A01H501Z', telefono: '3331234567' },
  { id: 'p2', nome: 'Maria', cognome: 'Verdi', cf: 'VRDMRA85A41H501Y', telefono: '3339876543' },
];

// ---------------------------------------------------------------------------
// §40: intent classification
// ---------------------------------------------------------------------------

test('classifyIntent: NAVIGATE verbs are recognized deterministically', () => {
  const r = classifyIntent('apri agenda', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.NAVIGATE);
  assert.equal(r.entities.target, 'agenda');
});

test('classifyIntent: CREATE verbs are recognized deterministically', () => {
  const r = classifyIntent('nuovo paziente', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.CREATE);
});

test('classifyIntent: UPDATE verbs extract a free-text amount', () => {
  const r = classifyIntent('registra pagamento 350', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.UPDATE);
  assert.equal(r.entities.amount, 350);
});

test('classifyIntent: ANALYZE hints route financial-sounding questions', () => {
  const r = classifyIntent('quanto abbiamo incassato questo mese', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.ANALYZE);
});

test('classifyIntent: ASK hints route open questions', () => {
  const r = classifyIntent('quali pazienti ho oggi?', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.ASK);
});

test('classifyIntent: a bare section name/alias resolves to NAVIGATE, not SEARCH', () => {
  const r = classifyIntent('pagamenti', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.NAVIGATE);
  assert.equal(r.entities.navId, 'paga');
});

test('classifyIntent: an alias synonym also resolves to NAVIGATE', () => {
  const r = classifyIntent('incassi', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, INTENT.NAVIGATE);
  assert.equal(r.entities.navId, 'paga');
});

test('classifyIntent: an empty query classifies as null, not a crash', () => {
  const r = classifyIntent('   ', { navigationIndex: NAVIGATION_INDEX });
  assert.equal(r.type, null);
  assert.equal(r.confidence, 0);
});

test('extractAmount parses common Italian amount phrasings', () => {
  assert.equal(extractAmount('300'), 300);
  assert.equal(extractAmount('€300'), 300);
  assert.equal(extractAmount('300 euro'), 300);
  assert.equal(extractAmount('300,50'), 300.5);
  assert.equal(extractAmount('nessun numero qui'), null);
});

// ---------------------------------------------------------------------------
// §40: navigation search + partial match
// ---------------------------------------------------------------------------

test('navigationIndex wraps the real NAV list, one entry per section, no invented ids', () => {
  assert.ok(NAVIGATION_INDEX.length > 0);
  for (const item of NAVIGATION_INDEX) {
    assert.ok(item.id && item.label && item.page === item.id);
  }
});

test('findNavigationById resolves a known id and returns null for an unknown one', () => {
  assert.equal(findNavigationById('agenda')?.label, 'Agenda');
  assert.equal(findNavigationById('does_not_exist'), null);
});

test('federatedSearch: partial/live match on a section label while typing', () => {
  const { groups } = federatedSearch('pag', { navigationIndex: NAVIGATION_INDEX });
  const sectionGroup = groups.find((g) => g.group === RESULT_GROUP.SECTIONS);
  assert.ok(sectionGroup);
  assert.ok(sectionGroup.items.some((i) => i.id === 'paga'));
});

test('federatedSearch: partial match also works through an alias, not just the label', () => {
  const { groups } = federatedSearch('soldi', { navigationIndex: NAVIGATION_INDEX });
  const sectionGroup = groups.find((g) => g.group === RESULT_GROUP.SECTIONS);
  assert.ok(sectionGroup.items.some((i) => i.id === 'paga'));
});

test('federatedSearch: patient partial match reuses cercaPazienti (typo-tolerant)', () => {
  const { groups } = federatedSearch('Mario Rosi', { patients }); // one-letter typo in "Rossi"
  const patientGroup = groups.find((g) => g.group === RESULT_GROUP.PATIENTS);
  assert.ok(patientGroup);
  assert.ok(patientGroup.items.some((i) => i.id === 'p1'));
});

test('federatedSearch: results are grouped by type (patients/sections/actions kept separate)', () => {
  const { groups } = federatedSearch('paga', { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY });
  const names = groups.map((g) => g.group);
  assert.ok(new Set(names).size === names.length, 'each group must appear at most once');
});

test('federatedSearch: caps results per group at the given limit', () => {
  const manyPatients = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, nome: 'Mario', cognome: `Test${i}`, cf: '', telefono: '' }));
  const { groups } = federatedSearch('mario', { patients: manyPatients }, { limit: 3 });
  const patientGroup = groups.find((g) => g.group === RESULT_GROUP.PATIENTS);
  assert.equal(patientGroup.items.length, 3);
});

// ---------------------------------------------------------------------------
// §40: action registry
// ---------------------------------------------------------------------------

test('ACTION_REGISTRY: every entry declares a real, callable navigate() and a valid riskLevel', () => {
  for (const action of ACTION_REGISTRY) {
    assert.equal(typeof action.navigate, 'function', `${action.id} must define navigate()`);
    assert.ok([0, 1, 2, 3].includes(action.riskLevel), `${action.id} must declare a §11 riskLevel`);
    assert.ok(action.label && action.id, `${action.id} must have id and label`);
  }
});

test('ACTION_REGISTRY: open actions are riskLevel 0 and require no confirmation (§11)', () => {
  const opens = ACTION_REGISTRY.filter((a) => a.id.endsWith('.open') || a.id === 'document.search');
  for (const a of opens) {
    assert.equal(a.riskLevel, 0);
    assert.equal(a.confirmationRequired, false);
  }
});

test('ACTION_REGISTRY: create actions reuse the existing quickActionsCatalog run() handler, not a duplicate implementation', () => {
  const paymentCreate = findAction('payment.create');
  assert.ok(paymentCreate);
  assert.equal(paymentCreate.riskLevel, 1);
  assert.equal(typeof paymentCreate.quickAction.run, 'function');
});

test('findAction returns null for an unknown action id (safe fallback, no throw)', () => {
  assert.equal(findAction('not.a.real.action'), null);
});

// ---------------------------------------------------------------------------
// §40: permission filtering (reuses existing RBAC, no second model)
// ---------------------------------------------------------------------------

test('isNavItemAllowed: a feature-gated section is hidden when the studio feature flag is off', () => {
  assert.equal(isNavItemAllowed('spese', { features: { spese: false }, isStudioAdmin: false }), false);
  assert.equal(isNavItemAllowed('spese', { features: { spese: true }, isStudioAdmin: false }), true);
});

test('isNavItemAllowed: agenteai is admin-only regardless of feature flags', () => {
  assert.equal(isNavItemAllowed('agenteai', { features: {}, isStudioAdmin: false }), false);
  assert.equal(isNavItemAllowed('agenteai', { features: {}, isStudioAdmin: true }), true);
});

test('isNavItemAllowed: an ungated section (e.g. home) is always allowed', () => {
  assert.equal(isNavItemAllowed('home', { features: {}, isStudioAdmin: false }), true);
});

test('filterNavigationIndex: drops every section the caller cannot access', () => {
  const filtered = filterNavigationIndex(NAVIGATION_INDEX, { features: {}, isStudioAdmin: false });
  assert.ok(!filtered.some((n) => n.id === 'agenteai'));
  assert.ok(!filtered.some((n) => n.id === 'spese'));
  assert.ok(filtered.some((n) => n.id === 'home'));
});

test('isActionAllowed: a quickAction-backed action defers to isQuickActionAllowed (capability gate)', () => {
  const financeAction = findAction('finance.open'); // navId-gated
  assert.equal(isActionAllowed(financeAction, { features: { controllo_gestione: false }, isStudioAdmin: false }), false);
  assert.equal(isActionAllowed(financeAction, { features: { controllo_gestione: true }, isStudioAdmin: false }), true);
});

test('isActionAllowed: an ungated action (patient.open) is always allowed — RLS on `patients` is the real gate', () => {
  const patientOpen = findAction('patient.open');
  assert.equal(isActionAllowed(patientOpen, { features: {}, isStudioAdmin: false }), true);
});

test('filterActions: never leaks an action the caller is not permitted to see', () => {
  const filtered = filterActions(ACTION_REGISTRY, { features: {}, isStudioAdmin: false });
  assert.ok(!filtered.some((a) => a.navId === 'controllo'));
});

test('FEATURE_GATE_BY_NAV_ID / ADMIN_ONLY_NAV_IDS are the single source of truth (no second copy of these gates)', () => {
  assert.equal(FEATURE_GATE_BY_NAV_ID.controllo, 'controllo_gestione');
  assert.ok(ADMIN_ONLY_NAV_IDS.has('agenteai'));
});

// ---------------------------------------------------------------------------
// §40: context binding
// ---------------------------------------------------------------------------

test('buildContext: produces a frozen snapshot with sane defaults', () => {
  const ctx = buildContext({ page: 'paz', vertical: 'dentistico' });
  assert.equal(ctx.page, 'paz');
  assert.equal(ctx.vertical, 'dentistico');
  assert.match(ctx.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Object.isFrozen(ctx));
});

test('buildContext: defaults vertical to dentistico when not provided, never crashes on missing input', () => {
  const ctx = buildContext();
  assert.equal(ctx.vertical, 'dentistico');
  assert.equal(ctx.currentPatient, null);
});

test('inferPatientHint: surfaces the current-page patient as a hint, or null off a patient page', () => {
  const onPatientPage = buildContext({ page: 'schedaPaz', currentPatient: { id: 'p1' } });
  assert.deepEqual(inferPatientHint(onPatientPage), { id: 'p1' });
  const elsewhere = buildContext({ page: 'agenda' });
  assert.equal(inferPatientHint(elsewhere), null);
});

test('processQuery: context is used only as a hint for pre-fill, patient still resolved from real data (§13/§14)', async () => {
  const ctx = buildContext({ page: 'schedaPaz', currentPatient: patients[0] });
  const result = await processQuery({
    query: 'nuovo pagamento 300',
    context: ctx,
    permissions: {},
    sources: { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
  });
  assert.equal(result.entities.amount, 300);
  assert.ok(result.confirmationRequired);
});

// ---------------------------------------------------------------------------
// §40: safe fallback
// ---------------------------------------------------------------------------

test('processQuery: an empty query falls back to the idle/suggested state, never an error', async () => {
  const result = await processQuery({ query: '', context: buildContext(), permissions: {}, sources: { actions: ACTION_REGISTRY } });
  assert.equal(result.intent, null);
  assert.ok(Array.isArray(result.searchResults));
});

test('processQuery: a query matching nothing returns an empty-but-defined result shape, not a throw', async () => {
  const result = await processQuery({
    query: 'zzzzzznonexistentqueryxyz',
    context: buildContext(),
    permissions: {},
    sources: { patients: [], navigationIndex: [], actions: [] },
  });
  assert.deepEqual(result.searchResults, []);
});

test('processQuery: ANALYZE without managementControl fails closed with a clear message, no data leak (§21)', async () => {
  const result = await processQuery({
    query: 'quanto abbiamo incassato questo mese',
    context: buildContext(),
    permissions: { managementControl: false },
    sources: {},
  });
  assert.match(result.answer, /non hai accesso/i);
});

test('suggestedIdle: falls back to low-risk actions when no recent actions are supplied', () => {
  const idle = suggestedIdle({ actions: ACTION_REGISTRY });
  assert.ok(idle.length > 0);
  assert.ok(idle[0].items.every((i) => i.data.riskLevel <= 1));
});

test('suggestedIdle: with no actions at all, returns an empty (never undefined/throwing) result', () => {
  assert.deepEqual(suggestedIdle({ actions: [] }), []);
});

// ---------------------------------------------------------------------------
// §40: provider independence — §15's CRITICAL constraint, enforced structurally
// ---------------------------------------------------------------------------

const POLIEDRON_LIB_DIR = path.join(__dirname, '..', 'src', 'lib', 'poliedron');
const POLIEDRON_COMPONENTS_DIR = path.join(__dirname, '..', 'src', 'components', 'poliedron');
const PROVIDER_PATTERN = /(generative-ai|@google\/genai|@anthropic-ai|openai|GoogleGenerativeAI|new\s+OpenAI\s*\(|Anthropic\s*\()/;

function listJsFiles(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js') || f.endsWith('.jsx'))
    .map((f) => path.join(dir, f));
}

test('provider independence: no poliedron file imports a model-provider SDK directly', () => {
  const files = [...listJsFiles(POLIEDRON_LIB_DIR), ...listJsFiles(POLIEDRON_COMPONENTS_DIR)];
  assert.ok(files.length > 0);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, PROVIDER_PATTERN, `${path.basename(file)} must not reference a model-provider SDK directly`);
  }
});

test('provider independence: modelGateway.js is the only poliedron file that invokes the AI edge function', () => {
  const files = [...listJsFiles(POLIEDRON_LIB_DIR), ...listJsFiles(POLIEDRON_COMPONENTS_DIR)];
  const invokers = files.filter((f) => fs.readFileSync(f, 'utf8').includes("functions.invoke('agente-assistente'"));
  assert.deepEqual(invokers.map((f) => path.basename(f)), ['modelGateway.js']);
});

test('provider independence: runModelTask fails closed (no client / no input) instead of guessing a provider call', async () => {
  const { runModelTask } = await import('../src/lib/poliedron/modelGateway.js');
  const noClient = await runModelTask({ input: 'ciao' });
  assert.equal(noClient.error, 'MODEL_GATEWAY_NO_CLIENT');
  const noInput = await runModelTask({ supabaseClient: {} });
  assert.equal(noInput.error, 'MODEL_GATEWAY_EMPTY_INPUT');
});
