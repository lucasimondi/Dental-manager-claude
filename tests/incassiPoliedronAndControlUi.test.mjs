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

// POL-FIN-007e: Product Owner — in "Piani" del paziente la pagina non
// scorreva abbastanza per liberare l'ultimo pulsante ("+ Aggiungi
// prestazione") da sotto il dock mobile fisso (.poliedron-mobile-dock,
// z-index 1100, che "non contribuisce mai all'altezza del layout"). Il
// pannello scrollabile della scheda paziente ora riserva esplicitamente
// lo stesso spazio già usato altrove (.management-hub/.financial-workspace)
// per lo stesso identico problema.
const schedaPaz = fs.readFileSync(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8');

// POL-FIN-007e: Product Owner — "la pagina paziente ha questi tasti che
// portano ai vari sezioni che è un po troppo ingombrante". Compacted by
// splitting emoji from label and hiding the label on mobile (icon-only),
// NOT by reintroducing horizontal scrolling — the test above still
// guards that a wrapping grid, never overflow-x, stays in place.
test('patient record tabs go icon-only on mobile via a hidden label, never by removing a section or adding a scroller', () => {
  assert.match(schedaPaz, /<span aria-hidden="true">\{t\.emoji\}<\/span> <span className="patient-record-tabs__label">\{t\.label\}<\/span>/);
  assert.match(schedaPaz, /title=\{t\.label\} aria-label=\{t\.label\}/);
  assert.match(css, /\.patient-record-tabs__label\{display:none\}/);
  assert.doesNotMatch(css, /\.patient-record-tabs[^}]*overflow-x/);
  // "Piani" and "Impianti" must not share the same icon once reduced to icon-only.
  assert.match(schedaPaz, /id: 'piani', emoji: '🦷'/);
  assert.match(schedaPaz, /id: 'impl', emoji: '🦴'/);
});

test('the patient record scroll pane reserves space below the fixed mobile dock, not just the tab bar', () => {
  assert.match(schedaPaz, /className="patient-record-content"/);
  assert.match(css, /\.patient-record-content\{flex:1;padding:14px;overflow-y:auto;box-sizing:border-box\}/);
  const mobileBlock = css.match(/@media\(max-width:719px\)\{[^]*?\.patient-record-content\{padding-bottom:(\d+)px\}/);
  assert.ok(mobileBlock, 'expected a mobile .patient-record-content padding-bottom rule');
  assert.ok(Number(mobileBlock[1]) >= 92, `mobile bottom padding ${mobileBlock[1]}px is too small to clear the floating dock`);
});

test('management control uses a persistent side navigation and a mobile selector', () => {
  assert.match(control, /className="management-nav"/);
  assert.match(control, /className="management-nav-mobile"/);
  assert.doesNotMatch(control, /management-hub__modules/);
  assert.doesNotMatch(control, /className="pol-tabbar"/);
});
