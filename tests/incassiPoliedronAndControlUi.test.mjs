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

// Product Owner: "la scheda paziente hai tasti per moduli un po scritti
// piccoli (mobile)" — the tab labels (Info/Anamnesi/Piani/...) dropped to
// 9.5px on phones, unreadably small; bumped to a legible size with a
// proper touch target.
test('patient record tab labels stay legible on mobile, not shrunk to near-illegible size', () => {
  const mobileBlock = css.match(/@media\(max-width:719px\)\{[^]*?\.patient-record-tabs button\{[^}]*\}/)?.[0] || '';
  assert.ok(mobileBlock, 'expected a mobile .patient-record-tabs button rule');
  const fontSize = Number(mobileBlock.match(/\.patient-record-tabs button\{[^}]*font-size:([\d.]+)px/)?.[1]);
  assert.ok(fontSize >= 11, `mobile tab font-size ${fontSize}px is too small to read comfortably`);
  const minHeight = Number(mobileBlock.match(/\.patient-record-tabs button\{[^}]*min-height:([\d.]+)px/)?.[1]);
  assert.ok(minHeight >= 44, `mobile tab min-height ${minHeight}px is below the 44px touch target`);
});

test('management control uses a persistent side navigation and a mobile selector', () => {
  assert.match(control, /className="management-nav"/);
  assert.match(control, /className="management-nav-mobile"/);
  assert.doesNotMatch(control, /management-hub__modules/);
  assert.doesNotMatch(control, /className="pol-tabbar"/);
});
