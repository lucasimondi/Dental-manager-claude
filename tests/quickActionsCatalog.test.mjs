import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_ACTIONS_CATALOG, DEFAULT_QUICK_ACTION_IDS, resolveQuickActions, filterQuickActionsCatalog } from '../src/lib/quickActionsCatalog.js';

const basePermissions = { activeMember: true, managementControl: false };

test('inactive membership sees zero quick actions, fail closed', () => {
  const result = filterQuickActionsCatalog({ permissions: { activeMember: false }, features: {}, vertical: 'dentistico' });
  assert.equal(result.length, 0);
});

test('capability-gated actions require the exact capability, not just active membership', () => {
  const withoutMgmt = filterQuickActionsCatalog({ permissions: basePermissions, features: {}, vertical: 'dentistico' });
  assert.ok(!withoutMgmt.some((a) => a.id === 'controllo_gestione'));
  const withMgmt = filterQuickActionsCatalog({ permissions: { ...basePermissions, managementControl: true }, features: {}, vertical: 'dentistico' });
  assert.ok(withMgmt.some((a) => a.id === 'controllo_gestione'));
});

test('feature-gated actions require the studio feature flag', () => {
  const withoutFeature = filterQuickActionsCatalog({ permissions: basePermissions, features: { spese: false }, vertical: 'dentistico' });
  assert.ok(!withoutFeature.some((a) => a.id === 'nuova_spesa'));
  const withFeature = filterQuickActionsCatalog({ permissions: basePermissions, features: { spese: true }, vertical: 'dentistico' });
  assert.ok(withFeature.some((a) => a.id === 'nuova_spesa'));
});

test('vertical-gated actions only appear for the matching vertical', () => {
  const dentistico = filterQuickActionsCatalog({ permissions: basePermissions, features: {}, vertical: 'dentistico' });
  assert.ok(!dentistico.some((a) => a.id === 'nuova_seduta_fisio'));
  const fisio = filterQuickActionsCatalog({ permissions: basePermissions, features: {}, vertical: 'fisioterapista' });
  assert.ok(fisio.some((a) => a.id === 'nuova_seduta_fisio'));
});

test('resolveQuickActions preserves the user chosen order and drops duplicates/unknown/disallowed ids', () => {
  const context = { permissions: basePermissions, features: {}, vertical: 'dentistico' };
  const chosen = ['richiamo', 'nuovo_appuntamento', 'richiamo', 'not_a_real_id', 'controllo_gestione'];
  const resolved = resolveQuickActions(chosen, context);
  assert.deepEqual(resolved.map((a) => a.id), ['richiamo', 'nuovo_appuntamento']);
});

test('resolveQuickActions falls back to the filtered default set when nothing is configured', () => {
  const context = { permissions: basePermissions, features: {}, vertical: 'dentistico' };
  const resolved = resolveQuickActions(null, context);
  assert.deepEqual(resolved.map((a) => a.id), DEFAULT_QUICK_ACTION_IDS.filter((id) => id !== 'controllo_gestione'));
});

test('every catalog entry declares a real, callable run handler', () => {
  for (const action of QUICK_ACTIONS_CATALOG) {
    assert.equal(typeof action.run, 'function', `${action.id} must define run()`);
    assert.ok(action.label && action.ic, `${action.id} must have label and icon`);
  }
});
