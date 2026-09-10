import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const impostazioni = readFileSync(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');
const pwaRegisterSrc = readFileSync(new URL('../node_modules/vite-plugin-pwa/dist/index.js', import.meta.url), 'utf8');

// Product Owner: "ogni volta prima di recepire aggiornamenti impiega tanto
// e qualche volta non li aggiorna, tipo adesso sono uscito e rientrato e
// non mi vede ancora tutto quello aggiornato — dobbiamo fare una cosa che
// piuttosto sia manuale?" (POL-UI-035).
//
// Root cause, verified directly in vite-plugin-pwa's own source (not
// guessed): the plugin only auto-sets workbox.skipWaiting/clientsClaim for
// registerType:'autoUpdate' when injectRegister is 'auto' or unset — see
// the exact condition below. POL-UI-029 set injectRegister:false (to
// register the SW ourselves and show an update banner), which silently
// opted back OUT of skipWaiting/clientsClaim too. Confirmed by building
// and inspecting dist/sw.js before this fix: it only listened for a
// SKIP_WAITING postMessage instead of calling it unconditionally at
// install, and never called clientsClaim() — so a new service worker sat
// in "waiting" and only ever activated once every open tab/PWA instance
// of the app was closed simultaneously, which a single reload or a
// logout/login essentially never achieves. That is "impiega tanto e
// qualche volta non aggiorna" exactly.
test('vite-plugin-pwa only auto-sets skipWaiting/clientsClaim when injectRegister is auto/unset — confirms why injectRegister:false needed them set explicitly', () => {
  assert.match(pwaRegisterSrc, /injectRegister === "auto" \|\| injectRegister == null/);
  assert.match(pwaRegisterSrc, /registerType === "autoUpdate"/);
});

test('vite.config.js explicitly restores skipWaiting/clientsClaim, since injectRegister:false opts out of the plugin default', () => {
  assert.match(viteConfig, /injectRegister:\s*false/);
  assert.match(viteConfig, /skipWaiting:\s*true/);
  assert.match(viteConfig, /clientsClaim:\s*true/);
});

// A manual fallback independent of automatic detection — Product Owner's
// own suggested direction ("dobbiamo fare una cosa che piuttosto sia
// manuale?"). registration.update() ignores the service worker script's
// HTTP cache per spec, so this always forces a real check, then reloads.
test('App.jsx captures the SW registration and exposes a manual "check for update" action wired into Impostazioni', () => {
  assert.match(app, /onRegisteredSW:\s*\(_url, registration\)\s*=>\s*\{\s*swRegistrationRef\.current\s*=\s*registration \|\| null;\s*\}/);
  assert.match(app, /const checkForUpdate = \(\) => \{/);
  assert.match(app, /swRegistrationRef\.current\?\.update\(\)\.finally\(\(\) => window\.location\.reload\(\)\)/);
  assert.match(app, /onCheckUpdate=\{checkForUpdate\}/);
});

test('Impostazioni renders a "Controlla aggiornamenti" button in the header next to Esci, calling onCheckUpdate', () => {
  assert.match(impostazioni, /onCheckUpdate && \(/);
  assert.match(impostazioni, /onClick=\{onCheckUpdate\}/);
  assert.match(impostazioni, /Controlla aggiornamenti/);
});
