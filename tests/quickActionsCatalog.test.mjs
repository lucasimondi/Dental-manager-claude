import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { QUICK_ACTIONS_CATALOG, DEFAULT_QUICK_ACTION_IDS, resolveQuickActions, filterQuickActionsCatalog, getQuickAction } from '../src/lib/quickActionsCatalog.js';

const basePermissions = { activeMember: true, managementControl: false };

// POL-UI-017 R2 round 3 — Product Owner caught "Documento" rendering with
// no icon at all: its catalog entry declared `ic: 'doc'`, a key that does
// not exist in Ic.jsx's ICONS map, so `Ic` silently returned null (not a
// visible fallback glyph). `assert.ok(action.ic)` above only checks the
// field is truthy, never that it resolves to a real icon — this regression
// guard reads the actual icon registry and checks every declared id is one
// of its real keys, so a typo'd/renamed icon id fails the suite instead of
// silently rendering blank.
const icSrc = await readFile(new URL('../src/components/ui/Ic.jsx', import.meta.url), 'utf8');
const iconKeys = new Set([...icSrc.matchAll(/^\s{2}(\w+): \(s, c\) => \(/gm)].map((m) => m[1]));

test('REGRESSION GUARD: every catalog icon id is a real key in the Ic.jsx icon registry', () => {
  assert.ok(iconKeys.size > 20, 'sanity check that the icon registry was actually parsed');
  for (const action of QUICK_ACTIONS_CATALOG) {
    assert.ok(iconKeys.has(action.ic), `${action.id} declares ic:'${action.ic}', which does not exist in Ic.jsx and renders nothing`);
  }
});

// Product Owner round 3: the literal "+ " prefix baked into several labels
// read as a stray "+" symbol in the UI — removed from every action, not
// just the ones the Product Owner happened to point at.
test('no quick action label carries a literal "+" prefix', () => {
  for (const action of QUICK_ACTIONS_CATALOG) {
    assert.ok(!action.label.startsWith('+'), `${action.id} label "${action.label}" must not start with "+"`);
  }
});

test('Product Owner round 3 additions: Ricetta, Consenso, Da incassare exist and reuse real destinations', () => {
  const ricetta = getQuickAction('ricetta');
  const consenso = getQuickAction('consenso');
  const daIncassare = getQuickAction('da_incassare');
  assert.ok(ricetta && consenso && daIncassare, 'all three new actions must be registered');
  // Ricetta reuses the exact icon DocMedico.jsx's own TIPI list already
  // uses for id:'ricetta' — same meaning, no new SVG invented.
  assert.equal(ricetta.ic, 'pill');
  // Consenso still lands on Pazienti first — same fallback every other
  // patient-scoped action (nuovo_paziente_appuntamento, nuova_seduta_fisio)
  // already uses — no new routing invented for it.
  const ctxNavigate = { onNavigate: (id) => id };
  assert.equal(consenso.run(ctxNavigate), 'paz');
  // POL-FIN-002 shipped the real module: PR #74's existing action now
  // changes only its handler and navigates to that verified route.
  assert.equal(daIncassare.run(ctxNavigate), 'paga');
});

// Product Owner round 4: "Ricetta deve aprire il tab ricetta, non
// paziente" — a bare navigate('paz') left the destination one manual step
// (find the Doc tab, pick the Ricetta type) short of the real target.
test('ROUND 4: Ricetta opens the patient picker (which then opens DocMedico\'s Ricetta tab directly), not a bare navigate to Pazienti', () => {
  const ricetta = getQuickAction('ricetta');
  let pickerOpened = false;
  const ctx = { openRicettaPicker: () => { pickerOpened = true; }, onNavigate: () => { throw new Error('must not fall through to onNavigate when openRicettaPicker exists'); } };
  ricetta.run(ctx);
  assert.equal(pickerOpened, true);
  // Backward-compatible fallback for any caller that hasn't wired the
  // picker (there is none today, but the contract must not throw).
  assert.equal(ricetta.run({ onNavigate: (id) => id }), 'paz');
});

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
