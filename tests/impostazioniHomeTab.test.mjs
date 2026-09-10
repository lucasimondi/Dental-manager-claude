import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const utils = readFileSync(new URL('../src/lib/utils.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const impostazioni = readFileSync(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');

// Product Owner: "il tasto impostazioni deve essere il tasto setup in cui
// ci sarà anche personalizzazione home, così è tutto più lineare"
// (POL-UI-036) — one consistently-named nav entry, and "Personalizza
// Home" reachable from it too.

test('the NAV entry is labeled "Impostazioni", matching the page it opens (no more "Setup" vs "Impostazioni" mismatch)', () => {
  assert.match(utils, /\{ id: 'set', l: 'Impostazioni', ic: 'set' \}/);
});

test('Impostazioni has a "Home" tab whose button asks Dashboard to open the same "Personalizza Home" editor — not a duplicate implementation', () => {
  assert.match(impostazioni, /\['home', 'home', 'Home'\]/);
  assert.match(impostazioni, /\{sezione === 'home' && \(/);
  assert.match(impostazioni, /onOpenHomeCustomizer && <Btn ic="home" ch="Personalizza Home" onClick=\{onOpenHomeCustomizer\} \/>/);
});

test('App.jsx wires an openHomeCustomizerRequest from Impostazioni to Dashboard, navigating to Home first', () => {
  assert.match(app, /const \[openHomeCustomizerRequest, setOpenHomeCustomizerRequest\] = useState\(null\)/);
  assert.match(app, /onOpenHomeCustomizer=\{\(\) => \{ setPage\('home'\); setOpenHomeCustomizerRequest\(Date\.now\(\)\); \}\}/);
  assert.match(app, /openHomeCustomizerRequest=\{openHomeCustomizerRequest\} onOpenHomeCustomizerRequestHandled=\{\(id\) => setOpenHomeCustomizerRequest\(\(current\) => current === id \? null : current\)\}/);
});

test('Dashboard opens the customizer once the request arrives, but waits for the saved layout to finish loading first (no silently-dropped request on a fresh Home mount)', () => {
  assert.match(dashboard, /if \(!openHomeCustomizerRequest \|\| layoutLoading\) return;/);
  assert.match(dashboard, /openHomeCustomizer\(\);\s*\n\s*onOpenHomeCustomizerRequestHandled\?\.\(openHomeCustomizerRequest\);/);
});
