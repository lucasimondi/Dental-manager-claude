import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const archivioSource = readFileSync(new URL('../src/components/ArchivioDocs.jsx', import.meta.url), 'utf8');
const premiumCss = readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

test('Documenti KPI cards use a page-scoped responsive grid', () => {
  assert.match(archivioSource, /className="pol-document-stats"/);
  assert.match(premiumCss, /\.pol-document-stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(premiumCss, /@media\s*\(max-width:\s*520px\)\s*\{[^}]*\.pol-document-stats\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test('Documenti currency values stay inside their KPI card without changing shared StatCard defaults', () => {
  assert.match(premiumCss, /\.pol-document-stats\s+\.pol-stat-card__value\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(premiumCss, /(?:^|\n)\.pol-stat-card__value\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
