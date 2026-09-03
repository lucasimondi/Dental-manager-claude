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

const schedaPaz = fs.readFileSync(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8');

// POL-FIN-007f: Product Owner rejected two prior rounds on this bar (a
// wrapping text grid — "troppo ingombrante" — then an icon-only grid —
// "ancora non mi piace... un modo più funzionale e pro"). Replaced with
// the SAME sidebar (desktop) / dropdown (mobile) pattern already shipped
// for ControlloGestione.jsx's own many-sections problem, for visual
// consistency with the rest of the app rather than a bespoke tab strip.
// Never a horizontal scroller either way — that was already tried and
// rejected once before this session (tests/patientQaRecoveryFinal.test.mjs
// "M").
test('patient record navigation is a persistent sidebar (desktop) + dropdown selector (mobile), mirroring ControlloGestione', () => {
  assert.match(schedaPaz, /className="patient-record-nav"/);
  assert.match(schedaPaz, /className="patient-record-nav-mobile"/);
  assert.doesNotMatch(schedaPaz, /className="patient-record-tabs"/);
  assert.match(css, /\.patient-record-nav\{display:flex;flex-direction:column/);
  assert.match(css, /\.patient-record-nav-mobile\{display:none\}/);
  assert.doesNotMatch(css, /\.patient-record-nav[^}]*overflow-x/);
});

test('patient record sidebar buttons use real icons (Ic set), not emoji, matching the rest of the app', () => {
  assert.match(schedaPaz, /<Ic n=\{t\.icon\} s=\{15\} c=\{tab === t\.id \? C\.pri : C\.txm\} \/><span>\{t\.label\}<\/span>/);
  assert.doesNotMatch(schedaPaz, /emoji:/);
  // "Piani" and "Impianti" must not share the same icon.
  assert.match(schedaPaz, /id: 'piani', icon: 'tooth'/);
  assert.match(schedaPaz, /id: 'impl', icon: 'tag'/);
});

// Product Owner: "la scheda paziente hai tasti per moduli un po scritti
// piccoli (mobile)" (earlier round) — the mobile selector must stay a
// legible, full 44px touch target, never shrunk back down.
test('patient record mobile selector keeps a legible, full touch target', () => {
  const mobileBlock = css.match(/@media\(max-width:719px\)\{[^]*?\.patient-record-nav-mobile select\{[^}]*\}/)?.[0] || '';
  assert.ok(mobileBlock, 'expected a mobile .patient-record-nav-mobile select rule');
  const minHeight = Number(mobileBlock.match(/\.patient-record-nav-mobile select\{[^}]*min-height:([\d.]+)px/)?.[1]);
  assert.ok(minHeight >= 44, `mobile selector min-height ${minHeight}px is below the 44px touch target`);
});

// POL-FIN-007e: Product Owner — in "Piani" del paziente la pagina non
// scorreva abbastanza per liberare l'ultimo pulsante ("+ Aggiungi
// prestazione") da sotto il dock mobile fisso (.poliedron-mobile-dock,
// z-index 1100, che "non contribuisce mai all'altezza del layout"). Il
// pannello scrollabile della scheda paziente riserva esplicitamente lo
// stesso spazio già usato altrove (.management-hub/.financial-workspace)
// per lo stesso identico problema — invariato dalla nuova sidebar.
test('the patient record scroll pane reserves space below the fixed mobile dock, not just the nav bar', () => {
  assert.match(schedaPaz, /className="patient-record-content"/);
  assert.match(css, /\.patient-record-content\{flex:1;min-width:0;padding:14px;overflow-y:auto;box-sizing:border-box\}/);
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
