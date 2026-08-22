import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_ACTIONS_CATALOG, DEFAULT_QUICK_ACTION_IDS, resolveQuickActions, filterQuickActionsCatalog, getQuickAction } from '../src/lib/quickActionsCatalog.js';

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

// Regression (POST-MERGE bugfix): "Nuovo paziente" / "Nuovo preventivo" /
// "Pagamento" (and "Paziente e appuntamento") must route through
// ctx.onNavigateNew — the signal Dashboard.jsx/App.jsx use to actually open
// the real creation form (Pazienti/Piani/Pagamenti autoOpenNew), not just
// ctx.onNavigate, which only lands on the list page with no form open.
test('form-opening quick actions call onNavigateNew with the real target page, not just onNavigate', () => {
  const formOpeningActions = [
    ['nuovo_paziente', 'paz'],
    ['nuovo_paziente_appuntamento', 'paz'],
    ['nuovo_preventivo', 'piani'],
    ['pagamento', 'paga'],
    ['richiamo', 'richiami'],
    ['nuova_spesa', 'spese'],
  ];
  for (const [id, expectedTarget] of formOpeningActions) {
    const action = getQuickAction(id);
    assert.ok(action, `${id} must exist in the catalog`);
    let navigateNewCalledWith = null;
    let navigateCalled = false;
    action.run({
      onNavigateNew: (target) => { navigateNewCalledWith = target; },
      onNavigate: () => { navigateCalled = true; },
    });
    assert.equal(navigateNewCalledWith, expectedTarget, `${id} must call onNavigateNew('${expectedTarget}')`);
    assert.equal(navigateCalled, false, `${id} must prefer onNavigateNew over onNavigate when both are available`);
  }
});

test('form-opening quick actions fall back to onNavigate when onNavigateNew is unavailable', () => {
  const action = getQuickAction('nuovo_paziente');
  let navigateCalledWith = null;
  action.run({ onNavigate: (target) => { navigateCalledWith = target; } });
  assert.equal(navigateCalledWith, 'paz');
});

// richiamo has a two-level fallback (onNavigateNew -> onGoRichiami ->
// onNavigate) predating this fix; confirm the full chain still degrades
// gracefully when onNavigateNew specifically is unavailable.
test('richiamo falls back to onGoRichiami, then onNavigate, when onNavigateNew is unavailable', () => {
  const action = getQuickAction('richiamo');
  let goRichiamiCalled = false;
  action.run({ onGoRichiami: () => { goRichiamiCalled = true; }, onNavigate: () => { throw new Error('should not reach onNavigate'); } });
  assert.equal(goRichiamiCalled, true);

  let navigateCalledWith = null;
  action.run({ onNavigate: (target) => { navigateCalledWith = target; } });
  assert.equal(navigateCalledWith, 'richiami');
});
