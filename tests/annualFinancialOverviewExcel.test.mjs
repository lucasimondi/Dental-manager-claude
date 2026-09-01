import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Product Owner follow-up: "sezione controllo gestione, le voci devono
// essere come un excel più eventualmente cliccabili ma pro" and "vista
// annuale deve contenere tutti i mesi anche con un andamento". Source-level
// regression guard, same convention as tests/planExecutionUi.test.mjs (no
// React render harness in this repo).
const component = fs.readFileSync(new URL('../src/components/AnnualFinancialOverview.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

test('monthly view keeps a month selector, annual view keeps every month plus a trend', () => {
  assert.match(component, /\{view === 'month' && <label>Mese<select/);
  // The 12-month ledger table itself is unconditional (not gated by view),
  // and a Recharts trend now sits above it for the annual view specifically.
  assert.doesNotMatch(component, /\{view === 'year' && <section className="monthly-ledger"/);
  assert.match(component, /view === 'year' && hasTrend/);
  assert.match(component, /ComposedChart data={trendData}/);
});

test('rows stay clickable to open a month\'s detail', () => {
  assert.match(component, /onClick=\{\(\) => openMonth\(index\)\}/);
  assert.match(component, /role="button"/);
});

test('the ledger table has a totals footer, like a real spreadsheet', () => {
  assert.match(component, /<tfoot><tr>/);
  assert.match(component, /Totale \{year\}/);
  assert.match(component, /totalValue\('ebitda_operativo_gestionale'\)/);
});

test('the table reads as an excel sheet: gridlines, zebra rows, sticky header, tabular figures', () => {
  assert.match(css, /\.monthly-ledger--excel th,\.monthly-ledger--excel td\{border-right:1px solid var\(--border-soft\);font-variant-numeric:tabular-nums\}/);
  assert.match(css, /\.monthly-ledger--excel tbody tr:nth-child\(even\)\{background:var\(--surface-base\)\}/);
  assert.match(css, /\.monthly-ledger--excel thead th\{position:sticky;top:0/);
  assert.match(css, /\.monthly-ledger--excel tfoot th,\.monthly-ledger--excel tfoot td\{border-bottom:0;border-top:2px solid var\(--border-medium\)/);
});
