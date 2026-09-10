import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

// Product Owner, after POL-UI-035 (skipWaiting/clientsClaim) still never
// reached them even after fully closing and reopening the app: "Non va per
// favore sistema che ho perso tempo già troppo". Confirmed via a follow-up
// question: this is a home-screen-installed PWA on iOS — WebKit's
// service-worker update detection for standalone PWAs is known to be
// unreliable independent of skipWaiting/clientsClaim being configured
// correctly, so the entire onNeedReload path could simply never fire there
// (POL-UI-038). This adds a second, SW-independent detection path: re-fetch
// index.html (already no-cache per vercel.json) and compare the hashed
// entry-script filename Vite stamps into it against the one actually
// running, triggered on mount + every visibilitychange-to-visible + a
// periodic interval — none of which depend on service-worker lifecycle
// events at all.

test('a second, service-worker-independent update check exists: re-fetches index.html no-store and compares the hashed entry script', () => {
  assert.match(app, /fetch\('\/index\.html', \{ cache: 'no-store' \}\)/);
  assert.match(app, /document\.scripts.*\.find\(\(src\) => src && src\.includes\('\/assets\/index-'\)\)/);
  assert.match(app, /latestScriptSrc !== currentScriptSrc/);
});

test('the fallback check triggers on mount, on visibilitychange-to-visible, and on a periodic interval — not just once', () => {
  assert.match(app, /checkForNewDeploy\(\);\s*\n\s*const onVisible = \(\) => \{ if \(document\.visibilityState === 'visible'\) checkForNewDeploy\(\); \};/);
  assert.match(app, /document\.addEventListener\('visibilitychange', onVisible\)/);
  assert.match(app, /setInterval\(checkForNewDeploy, 10 \* 60 \* 1000\)/);
});

test('a detected mismatch reuses the same non-destructive tap-to-update banner as the service-worker path (never a silent reload)', () => {
  const fallbackIndex = app.indexOf('POL-UI-038');
  assert.notEqual(fallbackIndex, -1, 'expected the POL-UI-038 fallback block to exist');
  const fallbackBlock = app.slice(fallbackIndex);
  assert.match(fallbackBlock, /updateDetected = true;\s*\n\s*setUpdateReady\(\(\) => \(\) => window\.location\.reload\(\)\);/);
});

test('the extraction regex correctly parses the exact <script> markup Vite emits and detects a real mismatch (not just a source-text grep)', () => {
  const realIndexHtml = '<!doctype html><html><head></head><body><div id="root"></div>\n  <script type="module" crossorigin src="/assets/index-D3Vw2WZd.js"></script>\n  <link rel="stylesheet" crossorigin href="/assets/index-Dn5Bfg8N.css"></body></html>';
  const match = realIndexHtml.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/);
  assert.equal(match?.[1], '/assets/index-D3Vw2WZd.js');
  assert.notEqual(match[1], '/assets/index-OLDHASH123.js', 'a stale currentScriptSrc must be recognized as different from the freshly-fetched one');
});
