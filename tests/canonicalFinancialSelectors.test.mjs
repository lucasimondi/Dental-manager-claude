import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CANONICAL_FINANCIAL_RPC,
  createCanonicalManagementModel,
  loadCanonicalFinancialSnapshot,
  normalizeManagementControlMode,
} from '../src/lib/canonicalFinancialSelectors.js';

const snapshot = Object.freeze({
  prodotto: 120,
  incassato: 90,
  preventivato_lordo: 200,
  ebitda_operativo_gestionale: 40,
  break_even: 100,
  costo_orario_struttura: 12,
  produzione_ora: 30,
  incasso_ora: 22.5,
  formula_version: 'POL-003A-v1',
  data_quality_status: 'OK',
});

test('mode persistence values normalize fail-closed to base', () => {
  assert.equal(normalizeManagementControlMode('base'), 'base');
  assert.equal(normalizeManagementControlMode('advanced'), 'advanced');
  assert.equal(normalizeManagementControlMode('automatic'), 'base');
  assert.equal(normalizeManagementControlMode(undefined), 'base');
});

test('Base and Advanced switch visibility without changing canonical values', () => {
  const base = createCanonicalManagementModel(snapshot, 'base');
  const advanced = createCanonicalManagementModel(snapshot, 'advanced');
  assert.equal(base.mode, 'base');
  assert.equal(advanced.mode, 'advanced');
  assert.ok(advanced.metrics.length > base.metrics.length);
  assert.equal(base.metrics.find((m) => m.id === 'prodotto').value, 120);
  assert.equal(advanced.metrics.find((m) => m.id === 'prodotto').value, 120);
  assert.equal(snapshot.prodotto, 120);
  assert.equal(base.metrics.find((m) => m.id === 'costi_operativi').available, false);
});

test('canonical loader calls only POL-003 snapshot RPC and never falls back', async () => {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: [snapshot], error: null }; } };
  const result = await loadCanonicalFinancialSnapshot(client, '2026-08-01', '2026-08-31');
  assert.equal(result.snapshot, snapshot);
  assert.deepEqual(calls, [{ name: CANONICAL_FINANCIAL_RPC, args: { p_data_inizio: '2026-08-01', p_data_fine: '2026-08-31' } }]);

  const failed = await loadCanonicalFinancialSnapshot({ rpc: async () => ({ data: null, error: { message: 'not ready' } }) }, '2026-08-01', '2026-08-31');
  assert.equal(failed.snapshot, null);
  assert.equal(failed.error.message, 'not ready');
});

test('selector module contains no legacy financial source or formula implementation', async () => {
  const source = await readFile(new URL('../src/lib/canonicalFinancialSelectors.js', import.meta.url), 'utf8');
  for (const forbidden of ['get_kpi_periodo', 'useControlloDati', ".from('plans')", ".from('payments')", ".from('spese')", '.reduce(']) {
    assert.equal(source.includes(forbidden), false, `forbidden legacy/formula token: ${forbidden}`);
  }
  assert.equal((source.match(/get_financial_snapshot_v1/g) || []).length, 1);
});
