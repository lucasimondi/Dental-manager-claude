import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOME_WIDGET_REGISTRY } from '../src/lib/homeWidgetRegistry.js';
import { applyWidgetPermissions, buildHomePermissions, createRolePresetLayout, filterWidgetCatalog, resolveDashboardLayout, resolveHomePeriod } from '../src/lib/homeDashboardModel.js';
import { loadHomeFinancialSnapshot, selectHomeFinancialMetric } from '../src/lib/homeFinancialWidgets.js';

const admin = { ruolo: 'admin', stato: 'attivo', capabilities: ['home.owner','finance.management.read'] };
const user = { ruolo: 'utente', stato: 'attivo', capabilities: ['home.front_desk'] };
const enabled = { controllo_gestione: true };

test('financial widgets use only the canonical RPC and contain no frontend formulas or legacy fallback', () => {
  const files = ['src/lib/homeFinancialWidgets.js', 'src/components/CanonicalFinancialWidget.jsx'].map((path) => fs.readFileSync(path, 'utf8')).join('\n');
  assert.match(files, /loadCanonicalFinancialSnapshot/);
  assert.doesNotMatch(files, /get_kpi_periodo|from\(['"](?:payments|plans|spese|pagamenti_esterni)/);
  assert.doesNotMatch(files, /reduce\(|preventivato\s*[-+*/]|prodotto\s*[-+*/]|incassato\s*[-+*/]/);
});

test('shared period context propagates deterministic date boundaries', () => {
  const now = new Date(2026, 7, 19, 12);
  assert.deepEqual(resolveHomePeriod('current_month', now), { id: 'current_month', label: 'Mese corrente', dateFrom: '2026-08-01', dateTo: '2026-08-31' });
  assert.equal(resolveHomePeriod('previous_month', now).dateFrom, '2026-07-01');
  assert.equal(resolveHomePeriod('current_year', now).dateTo, '2026-12-31');
});

test('owner, front desk and clinician/fisio presets expose different jobs-to-be-done', () => {
  const visible = (layout) => layout.filter((item) => item.visible).map((item) => item.id);
  assert.ok(visible(createRolePresetLayout(['home.owner','finance.management.read'])).includes('fin_prodotto'));
  assert.deepEqual(new Set(visible(createRolePresetLayout(['home.front_desk'])).slice(0, 3)), new Set(['agenda', 'appuntamenti', 'todo']));
  assert.deepEqual(new Set(visible(createRolePresetLayout(['clinical.physiotherapist']))), new Set(['agenda', 'appuntamenti', 'todo']));
  assert.equal(createRolePresetLayout([]), null);
});

test('layout precedence is user, studio, role, platform and role changes do not overwrite user layout', () => {
  const userLayout = [{ id: 'todo', visible: true, size: 'small' }];
  const studioLayout = [{ id: 'agenda', visible: true, size: 'wide' }];
  const roleA = createRolePresetLayout(['home.owner']);
  const roleB = createRolePresetLayout(['clinical.physiotherapist']);
  assert.equal(resolveDashboardLayout({ userLayout, studioLayout, roleLayout: roleA }).source, 'user');
  assert.equal(resolveDashboardLayout({ studioLayout, roleLayout: roleA }).source, 'studio');
  assert.equal(resolveDashboardLayout({ roleLayout: roleA }).source, 'role');
  assert.equal(resolveDashboardLayout({}).source, 'platform');
  assert.deepEqual(resolveDashboardLayout({ userLayout, studioLayout, roleLayout: roleA }).layout, resolveDashboardLayout({ userLayout, studioLayout, roleLayout: roleB }).layout);
});

test('unauthorized and suspended users cause zero financial backend calls', async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return { data: [{}], error: null }; } };
  for (const membership of [user, { ruolo: 'admin', stato: 'sospeso', capabilities:['finance.management.read'] }, { ruolo:'admin',stato:'attivo',capabilities:[] }, null]) {
    const permissions = buildHomePermissions({ membership, features: enabled, vertical: 'dentistico' });
    const result = await loadHomeFinancialSnapshot(client, { authorized: permissions.managementControl, period: resolveHomePeriod('current_month', new Date(2026, 7, 19)) });
    assert.equal(result.skipped, true);
  }
  assert.equal(calls, 0);
});

test('authorized owner performs one canonical request and receives the shared period', async () => {
  let args;
  const client = { rpc: async (name, payload) => { args = { name, payload }; return { data: [{ prodotto: 100 }], error: null }; } };
  await loadHomeFinancialSnapshot(client, { authorized: true, period: resolveHomePeriod('previous_month', new Date(2026, 7, 19)) });
  assert.equal(args.name, 'get_financial_snapshot_v1');
  assert.deepEqual(args.payload, { p_data_inizio: '2026-07-01', p_data_fine: '2026-07-31' });
});

test('missing canonical and zero-denominator metrics are explicitly unavailable, never invented', () => {
  assert.equal(selectHomeFinancialMetric({}, 'fin_accettato').available, false);
  assert.equal(selectHomeFinancialMetric({ accettato: 100 }, 'fin_accettato').value, 100);
  assert.equal(selectHomeFinancialMetric({ produzione_ora: 20, ore_effettivamente_lavorate: 0 }, 'fin_produzione_ora').available, false);
  assert.deepEqual(selectHomeFinancialMetric({ prodotto: 25 }, 'fin_prodotto').value, 25);
});

test('permission-aware catalog is fail closed and tenant membership is evaluated independently', () => {
  const ownerA = buildHomePermissions({ membership: admin, features: enabled, vertical: 'dentistico' });
  const userB = buildHomePermissions({ membership: user, features: enabled, vertical: 'dentistico' });
  assert.ok(filterWidgetCatalog(HOME_WIDGET_REGISTRY, ownerA).some((item) => item.id === 'fin_incassato'));
  assert.ok(!filterWidgetCatalog(HOME_WIDGET_REGISTRY, userB).some((item) => item.id.startsWith('fin_')));
  assert.ok(applyWidgetPermissions(createRolePresetLayout(['home.owner']), HOME_WIDGET_REGISTRY, userB).filter((item) => item.visible).every((item) => !item.id.startsWith('fin_')));
});

test('responsive contract covers 375, 768, 1024 and 1440 breakpoints', () => {
  const css = fs.readFileSync('src/components/WidgetWorkspace.css', 'utf8');
  assert.match(css, /max-width:\s*600px/); // 375: single column
  assert.match(css, /min-width:\s*601px[^}]*max-width:\s*900px/s); // 768: two columns
  assert.match(css, /repeat\(12,/); // 1024/1440: 12-column grid
  assert.match(css, /grid-column:\s*span 4/); // three small widgets at desktop widths
});
