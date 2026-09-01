import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loadProdottoReconciliation,
  PRODOTTO_RECONCILIATION_RPC,
} from '../src/lib/domain/prodottoReconciliationService.js';
import { financialMonthRange } from '../src/lib/poliedron/poliedraCore.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = read('src/components/ProdottoReconciliationModal.jsx');
const annual = read('src/components/AnnualFinancialOverview.jsx');
const management = read('src/components/ControlloGestione.jsx');
const canonicalView = read('src/components/CanonicalManagementView.jsx');
const poliedron = read('src/lib/poliedron/poliedraCore.js');
const migration = read('supabase/migrations/20260901190000_pol_fin_006_live_prodotto_reconciliation.sql');

test('reconciliation loader calls the capability-gated canonical RPC and separates summary from groups', async () => {
  let call;
  const client = {
    async rpc(name, args) {
      call = { name, args };
      return {
        data: [
          { group_kind: 'SUMMARY', prodotto_periodo: 100, incassato_periodo: 70 },
          { group_kind: 'PLAN', group_key: 'plan:1' },
          { group_kind: 'UNALLOCATED', group_key: 'patient:2:unallocated' },
        ],
        error: null,
      };
    },
  };

  const result = await loadProdottoReconciliation(client, {
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    studioId: 'studio-1',
  });
  assert.equal(PRODOTTO_RECONCILIATION_RPC, 'get_prodotto_reconciliation_v1');
  assert.deepEqual(call, {
    name: PRODOTTO_RECONCILIATION_RPC,
    args: {
      p_data_inizio: '2026-01-01',
      p_data_fine: '2026-01-31',
      p_studio_id: 'studio-1',
    },
  });
  assert.equal(result.summary.group_kind, 'SUMMARY');
  assert.deepEqual(result.groups.map((row) => row.group_kind), ['PLAN', 'UNALLOCATED']);
});

test('reconciliation loader fails closed when period or studio is missing', async () => {
  let called = false;
  const result = await loadProdottoReconciliation(
    { rpc: async () => { called = true; } },
    { dateFrom: '2026-01-01', dateTo: '', studioId: 'studio-1' },
  );
  assert.equal(called, false);
  assert.ok(result.error);
  assert.equal(result.summary, null);
});

test('Prodotto click carries the exact annual/monthly period into the responsive reconciliation modal', () => {
  assert.match(annual, /onDrillDown=\{\(field\) => onDrillDown\?\.\(\{ field, \.\.\.selectedPeriod \}\)\}/);
  assert.match(management, /if \(field === 'prodotto'\)/);
  assert.match(management, /<ProdottoReconciliationModal/);
  assert.match(component, /mobileVariant="sheet"/);
  assert.match(component, /Prestazioni eseguite/);
  assert.match(component, /Incassi collegati al piano/);
  assert.match(component, /Pagamento non assegnato a un piano/);
});

test('unavailable Prodotto stays clickable to explain fail-closed data quality', () => {
  assert.match(canonicalView, /const canExplainUnavailable = item\.id === 'prodotto'/);
  assert.match(component, /nessun totale parziale viene presentato come definitivo/);
  assert.match(component, /quality_issues/);
});

test('UI explains scostamento without computing or describing it as patient debt', () => {
  assert.match(component, /Prodotto − Incassato nello stesso periodo/);
  assert.match(component, /non identifica automaticamente un debito del paziente/);
  assert.doesNotMatch(component, /prodotto_periodo\s*-\s*.*incassato_periodo/);
  assert.match(component, /Nessuna quota è attribuita a una singola prestazione/);
});

test('Poliedron reads Prodotto through the existing canonical snapshot path', () => {
  assert.match(poliedron, /\{ re: \/prodott\/i, id: 'prodotto' \}/);
  assert.match(poliedron, /\{ re: \/produzion\.\*ora\|produttivit\.\*ora\/i, id: 'produzione_ora' \}/);
  assert.match(poliedron, /loadCanonicalFinancialSnapshot/);
});

test('Poliedron financial month uses local calendar boundaries without UTC day shifts', () => {
  assert.deepEqual(financialMonthRange(new Date(2026, 8, 15, 23, 30)), {
    from: '2026-09-01',
    to: '2026-09-30',
  });
  assert.doesNotMatch(poliedron, /toISOString\(\)\.slice\(0, 10\)/);
});

test('migration contains one cent-exact largest-remainder read model and no list-price dependency', () => {
  assert.match(migration, /financial_live_plan_line_values_v1/);
  assert.match(migration, /ideal_sold_cents/);
  assert.match(migration, /remainder_rank/);
  assert.match(migration, /line_ordinal ASC/);
  assert.match(migration, /source_table <> 'plans'/);
  assert.match(migration, /source_table <> 'payments'/);
  assert.doesNotMatch(migration, /pricelist/i);
});
