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

// Product Owner follow-up round 2: "su mobile la tabella sia responsive e
// ci stia nello schermo" — a stacked card per month instead of the same
// 6-column table squeezed down; "cliccare i mesi... si vada in
// visualizzazione mensile dettagliata" — reuse the exact same openMonth
// click-through on both layouts, and actually scroll the detail into view
// so clicking a month is visibly not a no-op; "estrarre il pdf o excel".
test('mobile gets a stacked, tap-friendly card layout instead of the table, same click-through and totals', () => {
  assert.match(component, /const isMobile = useIsMobile\(\);/);
  assert.match(component, /\{isMobile \? \(/);
  assert.match(component, /monthly-ledger__cards/);
  assert.match(component, /onClick=\{\(\) => openMonth\(index\)\}/g);
  assert.match(component, /monthly-ledger__card--totals/);
});

test('clicking a month actually scrolls the detailed monthly view into sight, not just a state flip', () => {
  assert.match(component, /const detailRef = useRef\(null\);/);
  assert.match(component, /detailRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(component, /<div ref=\{detailRef\}>/);
});

test('PDF and Excel export reuse the exact rows/totals already on screen, no separate data path', () => {
  assert.match(component, /import \{ exportAnnualLedgerCsv, exportAnnualLedgerPdf \} from '\.\.\/lib\/annualLedgerExport\.js';/);
  assert.match(component, /const exportCsv = \(\) => exportAnnualLedgerCsv\(\{ year, months, MONTHS, totals \}\);/);
  assert.match(component, /const exportPdf = \(\) => exportAnnualLedgerPdf\(\{ year, months, MONTHS, totals \}\);/);
  assert.match(component, /Btn ch="Esporta PDF"/);
  assert.match(component, /Btn ch="Esporta Excel"/);
});

const exportModule = fs.readFileSync(new URL('../src/lib/annualLedgerExport.js', import.meta.url), 'utf8');

test('export module: no new dependency for Excel (CSV opens directly), jsPDF reused for PDF (already used elsewhere in this app)', () => {
  assert.match(exportModule, /import \{ jsPDF \} from 'jspdf';/);
  assert.match(exportModule, /text\/csv;charset=utf-8/);
  assert.match(exportModule, /export function exportAnnualLedgerCsv/);
  assert.match(exportModule, /export function exportAnnualLedgerPdf/);
});
