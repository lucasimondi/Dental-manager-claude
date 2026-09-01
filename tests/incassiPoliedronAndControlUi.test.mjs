import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';
import { suggestedIdle } from '../src/lib/poliedron/searchEngine.js';

const css = fs.readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');
const control = fs.readFileSync(new URL('../src/components/ControlloGestione.jsx', import.meta.url), 'utf8');

test('Poliedron default Naviga includes the unified financial section', () => {
  const groups = suggestedIdle({ navigationIndex: NAVIGATION_INDEX, actions: [], context: {} });
  const sections = groups.find((group) => group.group === 'APRI UNA SEZIONE').items;
  assert.ok(sections.some((item) => item.id === 'paga'));
  assert.ok(!sections.some((item) => item.id === 'incassi'));
});

test('patient record tabs are a wrapping grid, never a horizontal scroller', () => {
  assert.match(css, /\.patient-record-tabs\{display:grid/);
  assert.doesNotMatch(css, /\.patient-record-tabs[^}]*overflow-x/);
});

test('management control uses a persistent side navigation and a mobile selector', () => {
  assert.match(control, /className="management-nav"/);
  assert.match(control, /className="management-nav-mobile"/);
  assert.doesNotMatch(control, /management-hub__modules/);
  assert.doesNotMatch(control, /className="pol-tabbar"/);
});
