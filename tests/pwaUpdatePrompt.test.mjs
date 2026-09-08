import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

// Product Owner re-reported the POL-UI-027 dock-scroll fix as still broken
// after it was verified fixed and deployed (confirmed READY in production
// via Vercel). Root cause: this app is a PWA (vite-plugin-pwa,
// registerType:'autoUpdate') registered via the plugin's default bare
// `navigator.serviceWorker.register(...)` snippet — it never listened for
// an update at all. The generated service worker DOES skipWaiting+claim
// clients as soon as a new version installs, but with nothing listening
// for that on the client, an already-open tab (or, worse, a PWA opened
// from the home screen — resumed from background, never truly reloaded)
// just kept running its old, already-loaded JS forever. Every fix in this
// session could have been silently invisible to an installed PWA session
// this way, not just POL-UI-027.
test('service worker is registered via virtual:pwa-register with an update-triggered reload, not the bare auto-injected script', () => {
  assert.match(viteConfig, /registerType:\s*'autoUpdate'/);
  assert.match(viteConfig, /injectRegister:\s*false/);
  assert.match(app, /import\('virtual:pwa-register'\)/);
  assert.match(app, /onNeedReload:\s*\(\)\s*=>\s*setUpdateReady/);
  assert.match(app, /window\.location\.reload\(\)/);
});

// The reload is user-triggered (a banner tap), never automatic — an
// unprompted reload could silently drop someone's in-progress form. Same
// visual language and safe-area-top handling as the syncError banner
// (POL-UI-028) it sits next to.
test('update-ready banner is dismissible and only reloads when the user taps it', () => {
  assert.match(app, /updateReady &&/);
  assert.match(app, /onClick=\{updateReady\}/);
  assert.match(app, /onClick=\{\(\)\s*=>\s*setUpdateReady\(null\)\}/);
  assert.match(app, /Nuova versione disponibile/);
});
